import type { Config } from 'drizzle-kit'

export default {
	schema: 'drizzle/**/*.sql.ts',
	out: 'migrations',
	driver: 'd1',
	dbCredentials: {
		wranglerConfigPath: 'wrangler.toml',
		dbName: 'notebook-db',
	},
} satisfies Config
