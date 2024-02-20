import { json, LoaderFunctionArgs } from '@remix-run/cloudflare'
import { Form, useLoaderData } from '@remix-run/react'
import { users } from 'drizzle/users.sql'
import { Button } from '~/components/ui/button'
import { authenticator } from '~/services/authenticator.server'
import { db } from '~/services/db.server'

export async function loader({ request, context }: LoaderFunctionArgs) {
	const user = await authenticator(context).isAuthenticated(request)
	const allUsers = await db(context.env.DB).select().from(users)
	return json({ user, allUsers })
}

export default function Login() {
	const { user } = useLoaderData<typeof loader>()
	return (
		<div>
			{Boolean(user) ? (
				<Form action="/resources/auth/logout" method="POST">
					<Button>Log out</Button>
				</Form>
			) : (
				<Form action="/resources/auth/google" method="POST">
					<Button>Login with Google</Button>
				</Form>
			)}
		</div>
	)
}
