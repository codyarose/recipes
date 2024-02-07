/// <reference types="@remix-run/cloudflare" />
/// <reference types="vite/client" />

import type { KVNamespace } from '@cloudflare/workers-types'

declare module '@remix-run/cloudflare' {
	interface AppLoadContext {
		env: {
			cache: KVNamespace
			DB: D1Database
			GOOGLE_CLIENT_ID: string
			GOOGLE_CLIENT_SECRET: string
		}
	}
}
