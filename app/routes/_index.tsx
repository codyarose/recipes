import { json, redirect } from '@remix-run/cloudflare'
import {
	ClientActionFunctionArgs,
	ClientLoaderFunctionArgs,
	Form,
	Link,
	useFetcher,
	useLoaderData,
} from '@remix-run/react'
import { z } from 'zod'
import { Label } from '~/components/ui/label'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import localforage from 'localforage'
import { loader as recipeLoader } from '~/routes/resources+/recipe'
import { getRecipeKey, zodFilteredArray } from '~/utils/misc'
import { zSavedRecipe } from '~/schema'
import { RecipeCard } from '~/components/RecipeCard'

export async function clientLoader({}: ClientLoaderFunctionArgs) {
	const keys = await localforage.keys()
	const savedRecipes = await Promise.all(
		keys.map(key => localforage.getItem(key)),
	)

	return json({
		savedRecipes: zodFilteredArray(zSavedRecipe).parse(savedRecipes),
	} as const)
}

export async function clientAction({ request }: ClientActionFunctionArgs) {
	const formData = await request.formData()
	const recipeUrl = z.string().parse(formData.get('recipeUrl'))
	const recipeStringData = z.string().parse(formData.get('data'))
	const recipeData = zSavedRecipe.parse(JSON.parse(recipeStringData))
	const key = getRecipeKey(recipeUrl)
	await localforage.setItem(key, recipeData)

	return redirect(`/recipe/${key}`)
}

export default function Index() {
	const { savedRecipes } = useLoaderData<typeof clientLoader>()
	const fetcher = useFetcher<typeof recipeLoader>()

	return (
		<div className="container flex max-w-xl flex-col gap-12 pt-6">
			<fetcher.Form method="GET" action="/resources/recipe">
				<Label>
					Recipe URL:
					<Input type="text" name="recipeUrl" />
				</Label>
			</fetcher.Form>

			<div>
				<h2>Saved recipes</h2>
				<ul className="text-sm">
					{savedRecipes.map(({ recipe, organization }) => (
						<li key={recipe.url}>
							<Link
								to={`/recipe/${getRecipeKey(recipe.url)}`}
								className="text-slate-600 hover:underline"
							>
								<span>{recipe.name}</span>{' '}
								<span className="text-xs text-slate-400">
									({organization.name})
								</span>
							</Link>
						</li>
					))}
				</ul>
			</div>

			{fetcher.data ? (
				<div className="flex flex-col gap-4">
					<RecipeCard
						recipe={fetcher.data.recipe}
						organization={fetcher.data.organization}
					/>
					<Form method="POST">
						<input
							type="hidden"
							name="recipeUrl"
							value={fetcher.data.recipe.url}
						/>
						<input
							type="hidden"
							name="data"
							value={JSON.stringify(fetcher.data)}
						/>
						<Button size="lg" type="submit" className="w-full">
							Save
						</Button>
					</Form>
				</div>
			) : null}
		</div>
	)
}
