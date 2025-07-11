import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

// Blocklist entries table
export const blocklistEntries = sqliteTable(
	'blocklist_entries',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		domain: text('domain').notNull().unique(),
		source: text('source'), // e.g., 'pi-hole', 'manual', etc.
		addedAt: integer('added_at')
			.notNull()
			.default(sql`(unixepoch())`),
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	},
	(table) => ({
		domainIdx: index('blocklist_domain_idx').on(table.domain),
	})
);

// DNS query logs table
export const dnsQueryLogs = sqliteTable(
	'dns_query_logs',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		queryId: integer('query_id').notNull(), // DNS packet ID
		timestamp: integer('timestamp')
			.notNull()
			.default(sql`(unixepoch())`),
		clientIp: text('client_ip'),
		queryType: text('query_type').notNull(), // 'query' or 'response'
		blocked: integer('blocked', { mode: 'boolean' }).notNull().default(false),
		processingTimeMs: integer('processing_time_ms'),
	},
	(table) => ({
		timestampIdx: index('dns_logs_timestamp_idx').on(table.timestamp),
		blockedIdx: index('dns_logs_blocked_idx').on(table.blocked),
	})
);

// DNS questions table (related to query logs)
export const dnsQuestions = sqliteTable(
	'dns_questions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		logId: integer('log_id')
			.notNull()
			.references(() => dnsQueryLogs.id, { onDelete: 'cascade' }),
		name: text('name').notNull(), // domain name
		type: text('type').notNull(), // A, AAAA, CNAME, etc.
		class: text('class').notNull().default('IN'),
	},
	(table) => ({
		logIdIdx: index('dns_questions_log_id_idx').on(table.logId),
		nameIdx: index('dns_questions_name_idx').on(table.name),
	})
);

// DNS answers table (for responses)
export const dnsAnswers = sqliteTable(
	'dns_answers',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		logId: integer('log_id')
			.notNull()
			.references(() => dnsQueryLogs.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		type: text('type').notNull(),
		class: text('class').default('IN'),
		ttl: integer('ttl').notNull(),
		data: text('data'), // JSON string of answer data
	},
	(table) => ({
		logIdIdx: index('dns_answers_log_id_idx').on(table.logId),
	})
);

// Blocked domains tracking (for statistics and analysis)
export const blockedDomainsLog = sqliteTable(
	'blocked_domains_log',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		domain: text('domain').notNull(),
		blockedAt: integer('blocked_at')
			.notNull()
			.default(sql`(unixepoch())`),
		reason: text('reason').notNull(),
		exactMatch: integer('exact_match', { mode: 'boolean' }).notNull(),
		parentDomain: text('parent_domain'), // if blocked due to parent domain
		queryLogId: integer('query_log_id').references(() => dnsQueryLogs.id, { onDelete: 'set null' }),
	},
	(table) => ({
		domainIdx: index('blocked_domains_domain_idx').on(table.domain),
		blockedAtIdx: index('blocked_domains_blocked_at_idx').on(table.blockedAt),
	})
);

// System statistics and cache
export const systemStats = sqliteTable('system_stats', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	key: text('key').notNull().unique(), // e.g., 'total_queries', 'total_blocked', 'blocklist_size'
	value: text('value').notNull(), // JSON string for complex values
	updatedAt: integer('updated_at')
		.notNull()
		.default(sql`(unixepoch())`),
});
