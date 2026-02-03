import { mysqlTable, int, varchar } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { connector } from './connector';

export const location = mysqlTable('location', {
	id: int('id').primaryKey().autoincrement(),

	name: varchar('name', { length: 191 }).notNull(),
	country: varchar('country', { length: 191 }).notNull()
});

export const locationRelations = relations(location, ({ many }) => ({
	connectors: many(connector)
}));
