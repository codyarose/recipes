import {
	ClientActionFunctionArgs,
	ClientLoaderFunctionArgs,
	Form,
	json,
	redirect,
	useLoaderData,
} from '@remix-run/react'
import localforage from 'localforage'
import { z } from 'zod'
import { RecipeCard } from '~/components/RecipeCard'
import { Button } from '~/components/ui/button'
import { zSavedRecipe } from '~/schema'
import { getRecipeKey } from '~/utils/misc'

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
	const key = z.string().safeParse(params.key)
	if (!key.success) throw new Response('Invalid recipe key', { status: 400 })

	const savedRecipe = zSavedRecipe.safeParse(
		await localforage.getItem(key.data),
	)
	if (!savedRecipe.success)
		throw new Response('Recipe not found', { status: 404 })

	return json({
		recipe: savedRecipe.data.recipe,
		organization: savedRecipe.data.organization,
	} as const)
}

export async function clientAction({ request }: ClientActionFunctionArgs) {
	const formData = await request.formData()
	const recipeKey = z.string().parse(formData.get('recipeKey'))
	await localforage.removeItem(recipeKey)

	return redirect('/')
}

export default function Recipe() {
	const { recipe, organization } = useLoaderData<typeof clientLoader>()

	return (
		<div className="container flex max-w-xl flex-col gap-4 pt-6">
			<RecipeCard recipe={recipe} organization={organization} />

			<Form method="POST">
				<input
					type="hidden"
					name="recipeKey"
					value={getRecipeKey(recipe.url)}
				/>
				<Button
					variant="destructive"
					size="lg"
					type="submit"
					className="w-full"
				>
					Remove
				</Button>
			</Form>
		</div>
	)
}