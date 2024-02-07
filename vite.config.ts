import {
	unstable_vitePlugin as remix,
	unstable_cloudflarePreset as cloudflare,
} from '@remix-run/dev'
import { flatRoutes } from 'remix-flat-routes'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
	plugins: [
		remix({
			presets: [cloudflare()],
			ignoredRouteFiles: ['**/*'],
			routes: async defineRoutes => {
				return flatRoutes('routes', defineRoutes)
			},
		}),
		tsconfigPaths(),
	],
	ssr: {
		resolve: {
			externalConditions: ['workerd', 'worker'],
		},
	},
})
