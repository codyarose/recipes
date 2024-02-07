import { createCookieSessionStorage } from '@remix-run/cloudflare'

export const sessionStorage = createCookieSessionStorage({
	cookie: {
		name: '__session',
		sameSite: 'lax',
		path: '/',
		httpOnly: true,
		secrets: ['secret!'],
		secure: false,
		// secure: process.env.NODE_ENV === 'production',
	},
})
