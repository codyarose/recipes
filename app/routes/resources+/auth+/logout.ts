import { ActionFunctionArgs } from '@remix-run/cloudflare'
import { authenticator } from '~/services/authenticator.server'

export async function action({ request, context }: ActionFunctionArgs) {
	await authenticator(context).logout(request, { redirectTo: '/' })
}
