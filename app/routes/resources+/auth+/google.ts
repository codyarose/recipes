import { ActionFunctionArgs, redirect } from '@remix-run/cloudflare'
import { authenticator } from '~/services/authenticator.server'

export async function loader() {
	return redirect('/login')
}

export async function action({ request, context }: ActionFunctionArgs) {
	return await authenticator(context).authenticate('google', request)
}
