import { defineConfig } from 'drizzle-kit';

const { DATABASE_USER, DATABASE_PASSWORD, DATABASE_HOST, DATABASE_PORT, DATABASE_NAME } =
	process.env;

if (!DATABASE_USER || !DATABASE_PASSWORD || !DATABASE_HOST || !DATABASE_NAME) {
	throw new Error('Missing required DATABASE_* environment variables');
}

const url = `mysql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT ?? 3306}/${DATABASE_NAME}`;

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'mysql',
	dbCredentials: { url },
	verbose: true,
	strict: true
});
