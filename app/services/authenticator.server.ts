import { AppLoadContext, SessionStorage } from '@remix-run/cloudflare'
import { users } from 'drizzle/users.sql'
import { Authenticator } from 'remix-auth'
import { GoogleStrategy } from 'remix-auth-google'
import { sessionStorage } from './session.server'
import { db } from './db.server'

type User = Pick<typeof users.$inferSelect, 'userId' | 'email' | 'username'>

export class Auth {
	protected authenticator: Authenticator<User>
	protected sessionStorage: SessionStorage

	public authenticate: Authenticator<User>['authenticate']
	public isAuthenticated: Authenticator<User>['isAuthenticated']
	public logout: Authenticator<User>['logout']

	constructor(context: AppLoadContext) {
		this.sessionStorage = sessionStorage
		this.authenticator = new Authenticator<User>(this.sessionStorage, {
			throwOnError: true,
		})

		const database = db(context.env.DB)

		this.authenticator.use(
			new GoogleStrategy(
				{
					clientID: context.env.GOOGLE_CLIENT_ID,
					clientSecret: context.env.GOOGLE_CLIENT_SECRET,
					callbackURL: '/resources/auth/google/callback',
				},
				async ({ accessToken, refreshToken, extraParams, profile }) => {
					const { email, given_name } = profile._json
					const [user] = await database
						.insert(users)
						.values({
							email,
							username: given_name,
						})
						.onConflictDoUpdate({
							target: users.email,
							set: { email },
						})
						.returning({
							userId: users.userId,
							email: users.email,
							username: users.username,
						})

					return user
				},
			),
		)

		this.authenticate = this.authenticator.authenticate.bind(this.authenticator)
		this.isAuthenticated = this.authenticator.isAuthenticated.bind(
			this.authenticator,
		)
		this.logout = this.authenticator.logout.bind(this.authenticator)
	}
}

export function authenticator(context: AppLoadContext) {
	return new Auth(context)
}
