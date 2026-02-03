import { mysqlTable, int, varchar, uniqueIndex } from 'drizzle-orm/mysql-core';

export const keyStore = mysqlTable(
	'key_store',
	{
		id: int('id').autoincrement().primaryKey(),
		key: varchar('key', { length: 255 }).notNull(),
		value: varchar('value', { length: 255 }).notNull()
	},
	(t) => ({
		keyUnique: uniqueIndex('key_store_key_unique').on(t.key)
	})
);
