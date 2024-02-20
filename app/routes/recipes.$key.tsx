import {
	ClientActionFunctionArgs,
	ClientLoaderFunctionArgs,
	Form,
	json,
	redirect,
	useLoaderData,
	useRouteLoaderData,
} from '@remix-run/react'
import { z } from 'zod'
import { RecipeCard } from '~/components/RecipeCard'
import { Button } from '~/components/ui/button'
import { zSavedRecipe } from '~/schema'
import { Recipe } from '~/services/localforage/recipe'
import { Tab } from '~/services/localforage/tab'
import { invariantResponse } from '@epic-web/invariant'

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
	const key = z.string().safeParse(params.key)
	invariantResponse(key.success, 'Invalid recipe key')

	const savedRecipe = zSavedRecipe.safeParse(await Recipe.fromId(key.data))
	invariantResponse(savedRecipe.success, 'Recipe not found', { status: 404 })

	await Tab.updateLastVisitedTimestamp(savedRecipe.data.id)

	return json({
		id: savedRecipe.data.id,
		recipe: savedRecipe.data.recipe,
		organization: savedRecipe.data.organization,
	} as const)
}
export function useRecipeClientLoader() {
	return useRouteLoaderData<typeof clientLoader>('routes/recipes.$key')
}

export async function clientAction({ request }: ClientActionFunctionArgs) {
	const formData = await request.formData()
	const recipeId = z.string().parse(formData.get('recipeId'))
	await Recipe.remove(recipeId)

	return redirect('/recipes')
}

export default function RecipeComponent() {
	const { id, recipe, organization } = useLoaderData<typeof clientLoader>()

	return (
		<div className="container flex flex-col gap-4 pt-6">
			<RecipeCard recipe={recipe} organization={organization} />

			<Form method="POST">
				<input type="hidden" name="recipeId" value={id} />
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
