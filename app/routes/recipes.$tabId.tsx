import { Fragment } from 'react'
import { MetaFunction } from '@remix-run/cloudflare'
import {
	ClientActionFunctionArgs,
	ClientLoaderFunctionArgs,
	json,
	Link,
	redirect,
	useLoaderData,
	useRouteLoaderData,
	useSubmit,
} from '@remix-run/react'
import { invariantResponse } from '@epic-web/invariant'
import { ElementScrollRestoration } from '@epic-web/restore-scroll'
import {
	ClockIcon,
	CrossCircledIcon,
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
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '~/components/ui/resizable'
import { Separator } from '~/components/ui/separator'
import { database } from '~/services/idb/database'
import { Organization } from '~/services/idb/organization'
import { Recipe } from '~/services/idb/recipe'
import { Tab } from '~/services/idb/tab'
import { TabRecipe } from '~/services/idb/tab-recipe'
import { useMedia, zodFilteredArray } from '~/utils/misc'

export const meta: MetaFunction<typeof clientLoader> = ({ data }) => {
	const parsed = z
		.object({
			recipes: z.array(
				z.object({
					recipe: z.object({
						name: z.string(),
					}),
				}),
			),
		})
		.safeParse(data)
	return [
		{
			title: parsed.success
				? parsed.data.recipes.map(recipe => recipe.recipe.name).join(' / ')
				: 'Recipes',
		},
	]
}

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
	const tabId = z.string().safeParse(params.tabId)
	invariantResponse(tabId.success, 'Invalid tab id')

	const db = await database()
	const tab = await Tab.fromId(db, tabId.data)
	invariantResponse(tab, 'Tab not found', { status: 404 })

	const tabRecipes = await TabRecipe.fromTabId(db, { tabId: tabId.data })
	if (tabRecipes.length === 0) {
		// If there are no recipes in the tab, remove the tab and redirect to the recipes page
		await Tab.remove(db, tabId.data)
		return redirect('/recipes')
	}

	const recipeIds = tabRecipes.map(tabRecipe => tabRecipe.recipeId)
	const recipes = await Promise.all(recipeIds.map(id => Recipe.fromId(db, id)))
	const orgIds = [
		// Get all unique organization ids from the recipes
		...new Set(
			zodFilteredArray(Recipe.Info)
				.parse(recipes)
				.map(recipe => recipe?.orgId),
		),
	]
	const orgs = await Promise.all(orgIds.map(id => Organization.fromId(db, id)))
	const orgMap = orgs.reduce<Record<string, Organization.Info>>((acc, org) => {
		// Create a map of organization ids to organization info
		if (org) {
			acc[org.id] = org
		}
		return acc
	}, {})
	const recipesWithOrgs = recipes.map(recipe => ({
		// Combine the recipe and organization info
		recipe: recipe ?? null,
		organization: orgMap[recipe?.orgId ?? ''] || null,
	}))

	await Tab.updateLastVisitedTimestamp(db, tabId.data)

	return json({
		tabId: tabId.data,
		recipes: recipesWithOrgs,
	} as const)
}

export function useRecipeClientLoader() {
	return useRouteLoaderData<typeof clientLoader>('routes/recipes.$tabId')
}

export async function clientAction({
	request,
	params,
}: ClientActionFunctionArgs) {
	const tabId = z.string().parse(params.tabId)
	const formData = await request.formData()
	const recipeId = z.string().parse(formData.get('recipeId'))

	const db = await database()
	await Recipe.remove(db, recipeId) // Remove the recipe from the recipe store
	await TabRecipe.removeAllFromRecipeId(db, recipeId) // Remove the recipe from the tab-recipe store
	const removedIds = await Tab.removeAllUnreferenced(db) // Remove any tabs that are no longer referenced by a tab-recipe
	if (removedIds.includes(tabId)) {
		return redirect('/recipes') // Redirect to the recipes page if the current tab was removed
	}

	return null // Return null to stay on the current page
}

export default function RecipeComponent() {
	const { recipes } = useLoaderData<typeof clientLoader>()

	return recipes.length > 1 ? (
		<SplitRecipePageLayout />
	) : (
		<SingleRecipePageLayout />
	)
}

function SingleRecipePageLayout() {
	const { recipes } = useLoaderData<typeof clientLoader>()
	const data = recipes[0]

	return (
		<div className="pt-16">
			{data.recipe ? (
				<RecipeLayout recipe={data.recipe} organization={data.organization} />
			) : (
				<RecipeNotFound />
			)}
		</div>
	)
}

function SplitRecipePageLayout() {
	const { tabId, recipes } = useLoaderData<typeof clientLoader>()
	const isDesktop = useMedia('(min-width: 768px)')

	return (
		<ResizablePanelGroup
			autoSaveId={tabId}
			direction={isDesktop ? 'horizontal' : 'vertical'}
			className="-mt-px !h-dvh md:mt-0 md:h-auto [&_[data-panel]]:pt-4 first:[&_[data-panel]]:pt-16 md:[&_[data-panel]]:pt-16"
		>
			{recipes.map((recipeData, index, arr) => {
				const panelId = tabId + index
				return (
					<Fragment key={panelId}>
						<ResizablePanel
							id={panelId}
							order={index + 1}
							className="h-full !overflow-y-auto"
							minSize={20}
						>
							{recipeData.recipe ? (
								<RecipeLayout
									recipe={recipeData.recipe}
									organization={recipeData.organization}
								/>
							) : (
								<RecipeNotFound />
							)}
						</ResizablePanel>
						<ElementScrollRestoration
							key={panelId}
							elementQuery={`#${panelId}`}
						/>

						{index === arr.length - 1 ? null : (
							<ResizableHandle
								withHandle
								className="bg-slate-300 [&>div]:border-slate-300 [&>div]:bg-slate-100 [&>div]:text-slate-400 [&>div]:transition-colors [&>div]:hover:bg-slate-200/80 hover:[&>div]:bg-slate-200/90"
							/>
						)}
					</Fragment>
				)
			})}
		</ResizablePanelGroup>
	)
}

function RecipeNotFound() {
	return (
		<div className="flex h-full w-full items-center justify-center">
			<div className="max-h-sm mx-4 flex w-full max-w-sm items-center justify-center gap-2 rounded-md bg-red-50 px-6 py-12 text-center text-xl text-red-800">
				<CrossCircledIcon width={20} height={20} />
				Recipe not found
			</div>
		</div>
	)
}

export function RecipeLayout({
	recipe,
	organization,
}: {
	recipe: Recipe.Info
	organization?: Organization.Info | null
}) {
	const submit = useSubmit()
	const recipeTimes = [
		recipe.prepTime ? { label: 'Prep Time', value: recipe.prepTime } : null,
		recipe.cookTime ? { label: 'Cook Time', value: recipe.cookTime } : null,
		recipe.totalTime ? { label: 'Total Time', value: recipe.totalTime } : null,
	].filter(Boolean)

	return (
		<div className="mx-auto w-full max-w-prose px-3 pb-20 pt-4 text-sm text-slate-950 md:text-base">
			<div className="flex flex-col px-2">
				<div className="grid grid-cols-[1fr_min-content] items-start">
					<h1 className="text-balance font-serif text-3xl font-semibold leading-tight md:text-5xl">
						{recipe.name}
					</h1>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								size="icon"
								variant="ghost"
								className="h-5 text-slate-950 transition-colors hover:bg-slate-200/40 focus-visible:ring-slate-700/50 aria-expanded:bg-slate-200/80"
							>
								<DotsHorizontalIcon width={20} height={20} />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent collisionPadding={12} align="end">
							<DropdownMenuItem
								className="flex items-center gap-1 focus:bg-red-100"
								onSelect={() =>
									submit({ recipeId: recipe.id }, { method: 'POST' })
								}
							>
								<TrashIcon />
								Delete Recipe
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{organization ? (
					<Link
						to={recipe.sourceUrl}
						target="_blank"
						className="mt-2 flex items-baseline gap-1 self-start text-sm hover:underline"
					>
						{organization.name}
						<ExternalLinkIcon width={12} height={12} />
					</Link>
				) : null}

				<p className="mt-6 text-pretty">{recipe.description}</p>
			</div>

			<div className="my-7 aspect-video overflow-hidden">
				<img
					src={recipe.thumbnailUrl}
					alt={recipe.name}
					className="h-full w-full rounded-sm object-cover object-center"
				/>
			</div>

			<div className="flex justify-between px-2">
				{recipeTimes.map((time, index, arr) => (
					<Fragment key={time?.label}>
						<div className="flex flex-col items-center">
							<span className="font-serif font-semibold md:text-lg">
								{time?.label}
							</span>
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
				<h2 className="font-serif text-xl font-semibold md:text-3xl">
					Ingredients
				</h2>
				<ul className="flex list-disc flex-col gap-2 pl-5">
					{recipe.ingredients.map((ingredient, index) => (
						<li
							key={index}
							className="border-b border-dashed pb-2 pl-1.5 marker:text-slate-800/80 last:border-b-0"
						>
							<p className="text-pretty">{ingredient}</p>
						</li>
					))}
				</ul>
			</div>

			<div className="mt-7 flex flex-col gap-4 px-2">
				<h2 className="font-serif text-xl font-semibold md:text-3xl">
					Instructions
				</h2>
				<ol className="flex list-decimal flex-col gap-2 pl-5 text-base">
					{recipe.instructions.map((step, index) => (
						<li
							key={index}
							className="border-b border-dashed pb-2 pl-1.5 marker:text-slate-800/80 last:border-b-0"
						>
							<p className="text-pretty">{step.text}</p>
						</li>
					))}
				</ol>
			</div>
		</div>
	)
}
