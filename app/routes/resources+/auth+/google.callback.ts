import { LoaderFunctionArgs } from '@remix-run/cloudflare'
import { authenticator } from '~/services/authenticator.server'

export async function loader({ request, context }: LoaderFunctionArgs) {
	return await authenticator(context).authenticate('google', request, {
		successRedirect: '/',
		failureRedirect: '/login',
	})
}
