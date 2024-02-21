import { Fragment } from 'react'
import {
	ClientActionFunctionArgs,
	ClientLoaderFunctionArgs,
	Form,
	json,
	Link,
	redirect,
	useLoaderData,
	useParams,
	useRouteLoaderData,
	useSubmit,
} from '@remix-run/react'
import { invariantResponse } from '@epic-web/invariant'
import {
	ClockIcon,
	DotsHorizontalIcon,
	ExternalLinkIcon,
	TrashIcon,
} from '@radix-ui/react-icons'
import { z } from 'zod'
import { Button } from '~/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Separator } from '~/components/ui/separator'
import { zSavedRecipe } from '~/schema'
import { Recipe } from '~/services/localforage/recipe'
import { Tab } from '~/services/localforage/tab'

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
	// Remove the recipe from the tab and recipe store
	await Promise.all([Tab.remove(recipeId), Recipe.remove(recipeId)])
	// Retrieve all tabs, then filter to get those that contain the recipe (split tabs)
	const tabs = await Tab.list()
	const splitTabsToUpdate = tabs.filter(tab => tab.items.includes(recipeId))
	// Remove the split tabs and create new tabs with its remaining recipe
	await Promise.all(
		splitTabsToUpdate.map(async tab => {
			// Remove the split tab
			await Tab.remove(tab.id)
			// Create new tabs for remaining items excluding the deleted recipe
			const remainingItems = tab.items.filter(id => id !== recipeId)
			return Promise.all([
				remainingItems.map(id => Tab.create({ id, items: [id] })),
			])
		}),
	)
	// Redirect to the recipes page
	return redirect('/recipes')
}

export default function RecipeComponent() {
	const recipeData = useLoaderData<typeof clientLoader>()

	return (
		<div className="pt-11">
			<RecipeLayout {...recipeData} />
		</div>
	)
}

export function RecipeLayout({ id, recipe, organization }: zSavedRecipe) {
	const submit = useSubmit()
	const params = useParams()
	const recipeTimes = [
		recipe.prepTime ? { label: 'Prep Time', value: recipe.prepTime } : null,
		recipe.cookTime ? { label: 'Cook Time', value: recipe.cookTime } : null,
		recipe.totalTime ? { label: 'Total Time', value: recipe.totalTime } : null,
	].filter(Boolean)

	return (
		<div className="w-full mx-auto px-3 pt-4 pb-20 text-sm max-w-prose">
			<div className="px-2 flex flex-col">
				<div className="grid grid-cols-[1fr_min-content] items-start">
					<h1 className="text-3xl font-semibold leading-tight text-balance">
						{recipe.name}
					</h1>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								size="icon"
								variant="secondary"
								className="h-5 bg-indigo-50/70 hover:bg-indigo-100/70 focus-visible:ring-indigo-400"
							>
								<DotsHorizontalIcon />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent collisionPadding={12} align="end">
							<DropdownMenuItem
								className="focus:bg-red-100"
								onSelect={() => submit({ recipeId: id }, { method: 'POST' })}
							>
								<Form method="POST">
									<input type="hidden" name="recipeId" value={id} />
									<input
										type="hidden"
										name="currentTabId"
										value={Object.values(params).join('-')}
									/>
									<button type="submit" className="flex items-center gap-1">
										<TrashIcon />
										Delete Recipe
									</button>
								</Form>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<Link
					to={recipe.sourceUrl}
					target="_blank"
					className="text-sm text-muted-foreground hover:underline mt-1 flex gap-1 items-baseline self-start"
				>
					{organization.name}
					<ExternalLinkIcon width={12} height={12} />
				</Link>

				<p className="text-pretty mt-3">{recipe.description}</p>
			</div>

			<div className="aspect-video overflow-hidden my-7">
				<img
					src={recipe.thumbnailUrl}
					alt={recipe.name}
					className="h-full w-full object-cover object-center rounded-sm"
				/>
			</div>

			<div className="flex justify-between px-2">
				{recipeTimes.map((time, index, arr) => (
					<Fragment key={time?.label}>
						<div className="flex flex-col items-center">
							<span className="font-semibold">{time?.label}</span>
							<div className="flex items-center gap-1">
								<ClockIcon />
								{time?.value.label}
							</div>
						</div>
						{arr.length - 1 !== index ? (
							<Separator orientation="vertical" className="h-auto" />
						) : null}
					</Fragment>
				))}
			</div>

			<div className="mt-7 flex flex-col gap-4 px-2">
				<h2 className="text-xl font-semibold">Ingredients</h2>
				<ul className="pl-5 flex flex-col gap-2 list-disc">
					{recipe.ingredients.map((ingredient, index) => (
						<li
							key={index}
							className="pl-1.5 marker:text-muted-foreground border-b pb-2 border-dashed last:border-b-0"
						>
							<p className="text-pretty">{ingredient}</p>
						</li>
					))}
				</ul>
			</div>

			<div className="mt-7 flex flex-col gap-4 px-2">
				<h2 className="text-xl font-semibold">Instructions</h2>
				<ol className="pl-5 flex flex-col gap-2 list-decimal text-base">
					{recipe.instructions.map((step, index) => (
						<li
							key={index}
							className="pl-1.5 marker:text-muted-foreground border-b pb-2 border-dashed last:border-b-0"
						>
							<p className="text-pretty">{step.text}</p>
						</li>
					))}
				</ol>
			</div>
		</div>
	)
}
