import { DurableObject } from 'cloudflare:workers';
import { drizzle, type DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';
import { eq, and, sql } from 'drizzle-orm';
import { blocklistEntries, systemStats } from '../db/schema.js';
import { COMPILED_BLOCKLIST } from 'virtual:compiled-blocklist';

export class DNSStorage extends DurableObject {
	private db: DrizzleSqliteDODatabase<any>;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.db = drizzle(ctx.storage, { logger: false });

		// Make sure all migrations complete before accepting queries
		ctx.blockConcurrencyWhile(async () => {
			await this._migrate();
			await this._migrateBlocklist();
		});
	}

	private async _migrate() {
		try {
			await this._ensureTablesExist();
		} catch (error) {
			console.error('Migration failed:', error);
		}
	}

	private async _ensureTablesExist() {
		try {
			await this.db.select({ key: systemStats.key }).from(systemStats).limit(1);
			console.log('Database tables already exist.');
			return;
		} catch (e) {
			console.log('Database tables not found, creating them...');
		}

		// prettier-ignore
		const schema = `
CREATE TABLE \`blocked_domains_log\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`domain\` text NOT NULL,
	\`blocked_at\` integer DEFAULT (unixepoch()) NOT NULL,
	\`reason\` text NOT NULL,
	\`exact_match\` integer NOT NULL,
	\`parent_domain\` text,
	\`query_log_id\` integer,
	FOREIGN KEY (\`query_log_id\`) REFERENCES \`dns_query_logs\`(\`id\`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE \`blocklist_entries\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`domain\` text NOT NULL,
	\`source\` text,
	\`added_at\` integer DEFAULT (unixepoch()) NOT NULL,
	\`is_active\` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`dns_answers\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`log_id\` integer NOT NULL,
	\`name\` text NOT NULL,
	\`type\` text NOT NULL,
	\`class\` text DEFAULT 'IN',
	\`ttl\` integer NOT NULL,
	\`data\` text,
	FOREIGN KEY (\`log_id\`) REFERENCES \`dns_query_logs\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE \`dns_query_logs\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`query_id\` integer NOT NULL,
	\`timestamp\` integer DEFAULT (unixepoch()) NOT NULL,
	\`client_ip\` text,
	\`query_type\` text NOT NULL,
	\`blocked\` integer DEFAULT false NOT NULL,
	\`processing_time_ms\` integer
);
--> statement-breakpoint
CREATE TABLE \`dns_questions\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`log_id\` integer NOT NULL,
	\`name\` text NOT NULL,
	\`type\` text NOT NULL,
	\`class\` text DEFAULT 'IN' NOT NULL,
	FOREIGN KEY (\`log_id\`) REFERENCES \`dns_query_logs\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE \`system_stats\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`key\` text NOT NULL,
	\`value\` text NOT NULL,
	\`updated_at\` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX \`blocked_domains_domain_idx\` ON \`blocked_domains_log\` (\`domain\`);
--> statement-breakpoint
CREATE INDEX \`blocked_domains_blocked_at_idx\` ON \`blocked_domains_log\` (\`blocked_at\`);
--> statement-breakpoint
CREATE UNIQUE INDEX \`blocklist_entries_domain_unique\` ON \`blocklist_entries\` (\`domain\`);
--> statement-breakpoint
CREATE INDEX \`blocklist_domain_idx\` ON \`blocklist_entries\` (\`domain\`);
--> statement-breakpoint
CREATE INDEX \`dns_answers_log_id_idx\` ON \`dns_answers\` (\`log_id\`);
--> statement-breakpoint
CREATE INDEX \`dns_logs_timestamp_idx\` ON \`dns_query_logs\` (\`timestamp\`);
--> statement-breakpoint
CREATE INDEX \`dns_logs_blocked_idx\` ON \`dns_query_logs\` (\`blocked\`);
--> statement-breakpoint
CREATE INDEX \`dns_questions_log_id_idx\` ON \`dns_questions\` (\`log_id\`);
--> statement-breakpoint
CREATE INDEX \`dns_questions_name_idx\` ON \`dns_questions\` (\`name\`);
--> statement-breakpoint
CREATE UNIQUE INDEX \`system_stats_key_unique\` ON \`system_stats\` (\`key\`);
`;

		const statements = schema.split('--> statement-breakpoint');
		for (const statement of statements) {
			if (statement.trim()) {
				await this.db.run(sql.raw(statement));
			}
		}

		console.log('Database tables created manually.');
	}

	private async _migrateBlocklist() {
		// Check if blocklist has already been migrated
		const existingStats = await this.db.select().from(systemStats).where(eq(systemStats.key, 'blocklist_migrated')).limit(1);

		if (existingStats.length === 0) {
			console.log('Initializing blocklist system...');

			await this.db.insert(systemStats).values([
				{ key: 'blocklist_migrated', value: 'true' },
				{ key: 'total_queries', value: '0' },
				{ key: 'total_blocked', value: '0' },
				{ key: 'blocklist_size', value: '0' },
			]);

			console.log(`Using in-memory compiled blocklist with ${COMPILED_BLOCKLIST?.size || 0} domains`);

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

	private async _incrementStat(key: string): Promise<void> {
		const current = await this.db.select({ value: systemStats.value }).from(systemStats).where(eq(systemStats.key, key)).limit(1);

		const currentValue = current.length > 0 ? parseInt(current[0].value) : 0;
		const newValue = currentValue + 1;

		await this.db
			.insert(systemStats)
			.values({ key, value: newValue.toString() })
			.onConflictDoUpdate({
				target: systemStats.key,
				set: {
					value: newValue.toString(),
					updatedAt: sql`(unixepoch())`,
				},
			});
	}
}
