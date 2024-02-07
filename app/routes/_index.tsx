import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare'
import { Link, useLoaderData } from '@remix-run/react'
import { authenticator } from '~/services/authenticator.server'

export async function loader({ request, context }: LoaderFunctionArgs) {
	const user = await authenticator(context).isAuthenticated(request)
	return json({ user })
}

export default function Index() {
	const { user } = useLoaderData<typeof loader>()
	return (
		<div>
			<h1>Notebook</h1>
			{user ? 'Hello' : <Link to="login">Log in</Link>}
		</div>
	)
}
