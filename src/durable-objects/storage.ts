import { DurableObject } from 'cloudflare:workers';
import { drizzle, type DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';
import { eq, and, sql } from 'drizzle-orm';
import { blocklistEntries, systemStats } from '../db/schema.js';
import { COMPILED_BLOCKLIST } from 'virtual:compiled-blocklist';
import { migrate } from 'drizzle-orm/durable-sqlite/migrator';
import migrations from '../../drizzle/migrations.js';

export class DNSStorage extends DurableObject {
	private db: DrizzleSqliteDODatabase<any>;
	env: Env;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.env = env;
		this.db = drizzle(ctx.storage, { logger: false });

		// Make sure all migrations complete before accepting queries
		ctx.blockConcurrencyWhile(async () => {
			await this._migrate();
			await this._migrateBlocklist();
		});
	}

	private async _migrate() {
		try {
			await migrate(this.db, migrations);
		} catch (error) {
			console.error('Migration failed:', error);
		}
	}

	private async _migrateBlocklist() {
		// Check if blocklist has already been migrated
		const existingStats = await this.db.select().from(systemStats).where(eq(systemStats.key, 'blocklist_migrated')).limit(1);

		if (existingStats.length === 0) {
			await this.db.insert(systemStats).values([
				{ key: 'blocklist_migrated', value: 'true' },
				{ key: 'total_queries', value: '0' },
				{ key: 'total_blocked', value: '0' },
				{ key: 'blocklist_size', value: '0' },
			]);

			await this._updateBlocklistSize();
		}
	}

	async addBlocklistEntry(domain: string, source: string = 'manual'): Promise<void> {
		await this.db.insert(blocklistEntries).values({ domain: domain.toLowerCase(), source }).onConflictDoNothing();

		await this._updateBlocklistSize();
	}

	async removeBlocklistEntry(domain: string): Promise<void> {
		await this.db.delete(blocklistEntries).where(eq(blocklistEntries.domain, domain.toLowerCase()));

		await this._updateBlocklistSize();
	}

	async isInBlocklist(domain: string): Promise<{
		isBlocked: boolean;
		exactMatch: boolean;
		parentDomain?: string;
		reason?: string;
	}> {
		const normalizedDomain = domain.toLowerCase();

		const parts = normalizedDomain.split('.');
		for (let i = 1; i < parts.length; i++) {
			const parentDomain = parts.slice(i).join('.');
			const parentMatchDb = await this.db
				.select({ domain: blocklistEntries.domain })
				.from(blocklistEntries)
				.where(and(eq(blocklistEntries.domain, parentDomain), eq(blocklistEntries.isActive, true)))
				.limit(1);

			if (parentMatchDb.length > 0) {
				return {
					isBlocked: true,
					exactMatch: false,
					parentDomain,
					reason: `Subdomain of blocked domain: ${parentDomain}`,
				};
			}
		}

		if (COMPILED_BLOCKLIST && COMPILED_BLOCKLIST.has(normalizedDomain)) {
			return {
				isBlocked: true,
				exactMatch: true,
				reason: 'Domain is in in-memory compiled blocklist',
			};
		}

		for (let i = 1; i < parts.length; i++) {
			const parentDomain = parts.slice(i).join('.');
			if (COMPILED_BLOCKLIST && COMPILED_BLOCKLIST.has(parentDomain)) {
				return {
					isBlocked: true,
					exactMatch: false,
					parentDomain,
					reason: `Subdomain of blocked domain in compiled blocklist: ${parentDomain}`,
				};
			}
		}

		const exactMatchDb = await this.db
			.select({ domain: blocklistEntries.domain })
			.from(blocklistEntries)
			.where(and(eq(blocklistEntries.domain, normalizedDomain), eq(blocklistEntries.isActive, true)))
			.limit(1);

		if (exactMatchDb.length > 0) {
			return {
				isBlocked: true,
				exactMatch: true,
				reason: 'Domain exactly matches blocklist entry',
			};
		}

		return {
			isBlocked: false,
			exactMatch: false,
		};
	}

	async checkDomains(domains: string[]): Promise<{
		blocked: boolean;
		blockedDomains: Array<{
			domain: string;
			reason: string;
			exactMatch: boolean;
			parentDomain?: string;
		}>;
	}> {
		const blockedDomains = [];

		for (const domain of domains) {
			const result = await this.isInBlocklist(domain);
			if (result.isBlocked) {
				blockedDomains.push({
					domain,
					reason: result.reason || 'Listed in blocklist',
					exactMatch: result.exactMatch,
					parentDomain: result.parentDomain,
				});
			}
		}

		return {
			blocked: blockedDomains.length > 0,
			blockedDomains,
		};
	}

	async getBlocklistEntries(limit: number = 100, offset: number = 0) {
		return await this.db.select().from(blocklistEntries).where(eq(blocklistEntries.isActive, true)).limit(limit).offset(offset);
	}

	async getStatistics() {
		const stats = await this.db.select().from(systemStats);
		const statsObj: Record<string, string> = {};

		for (const stat of stats) {
			statsObj[stat.key] = stat.value;
		}

		return statsObj;
	}

	private async _updateBlocklistSize(): Promise<void> {
		const dbResult = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(blocklistEntries)
			.where(eq(blocklistEntries.isActive, true));
		const dbCount = dbResult[0].count;
		const compiledCount = COMPILED_BLOCKLIST?.size || 0;
		const totalCount = dbCount + compiledCount;

		await this.db
			.insert(systemStats)
			.values({ key: 'blocklist_size', value: totalCount.toString() })
			.onConflictDoUpdate({
				target: systemStats.key,
				set: {
					value: totalCount.toString(),
					updatedAt: sql`(unixepoch())`,
				},
			});
	}
}
