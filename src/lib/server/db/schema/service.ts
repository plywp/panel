import {
	mysqlTable,
	int,
	varchar,
	text,
	timestamp,
	boolean,
	uniqueIndex,
	index
} from 'drizzle-orm/mysql-core';

export const wpSite = mysqlTable(
	'wp_site',
	{
		id: int('id').autoincrement().primaryKey(),

		organizationId: varchar('organization_id', { length: 36 }).notNull(), // better-auth org.id

		internalId: varchar('internal_id', { length: 36 }).notNull(),
		name: varchar('name', { length: 255 }).notNull(),
		description: text('description'),

		domain: varchar('domain', { length: 255 }).notNull(),
		docroot: varchar('docroot', { length: 1024 }).notNull(),

		diskLimitMb: int('disk_limit_mb').notNull(),
		suspended: boolean('suspended').notNull().default(false),

		dbHost: varchar('db_host', { length: 255 }).notNull().default('127.0.0.1'),
		dbName: varchar('db_name', { length: 255 }).notNull(),
		dbUser: varchar('db_user', { length: 255 }).notNull(),
		dbPassword: varchar('db_password', { length: 255 }).notNull(), // ideally encrypted
		tablePrefix: varchar('table_prefix', { length: 32 }).notNull().default('wp_'),

		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().notNull()
	},
	(t) => ({
		internalUq: uniqueIndex('wp_site_internal_uq').on(t.internalId),
		domainUq: uniqueIndex('wp_site_domain_uq').on(t.domain),
		orgIdx: index('wp_site_org_idx').on(t.organizationId)
	})
);
