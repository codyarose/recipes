import { Fragment } from 'react'
import { MetaFunction } from '@remix-run/cloudflare'
import {
	ClientActionFunctionArgs,
	ClientLoaderFunctionArgs,
	json,
	redirect,
	useLoaderData,
	useRouteLoaderData,
} from '@remix-run/react'
import { parseWithZod } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { ElementScrollRestoration } from '@epic-web/restore-scroll'
import { CrossCircledIcon } from '@radix-ui/react-icons'
import { match } from 'ts-pattern'
import { z } from 'zod'
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '~/components/ui/resizable'
import { database } from '~/services/idb/database'
import { RecipeProgress } from '~/services/idb/recipe-progress'
import { Tab } from '~/services/idb/tab'
import { TabRecipe } from '~/services/idb/tab-recipe'
import { useMedia } from '~/utils/misc'
import {
	actionSchema,
	deleteRecipe,
	getRecipesWithMetadata,
} from './queries.client'
import { RecipeLayout } from './RecipeLayout'

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

	const tabRecipes = await TabRecipe.fromTabId(db, { tabId: tab.id })
	if (tabRecipes.length === 0) {
		// If there are no recipes in the tab, remove the tab and redirect to the recipes page
		await Tab.remove(db, tab.id)
		return redirect('/recipes')
	}

	const recipes = await getRecipesWithMetadata(db, tabRecipes)
	await Tab.updateLastVisitedTimestamp(db, tabId.data)

	return json({
		tabId: tabId.data,
		recipes,
	} as const)
}

export function useRecipeClientLoader() {
	return useRouteLoaderData<typeof clientLoader>('routes/recipes.$tabId/route')
}

export async function clientAction({
	request,
	params,
}: ClientActionFunctionArgs) {
	const tabId = z.string().parse(params.tabId)
	const formData = await request.formData()
	const submission = parseWithZod(formData, {
		schema: actionSchema,
	})

	if (submission.status !== 'success') {
		return json({ lastResult: submission.reply() })
	}

	const db = await database()

	return match(submission.value)
		.with({ _action: 'update-progress' }, async input => {
			const progress = await RecipeProgress.upsert(db, {
				recipeId: input.recipeId,
				currentStep: input.currentStep,
				checkedIngredients: input.checkedIngredients,
			})
			return json({ progress })
		})
		.with({ _action: 'delete-recipe' }, async input => {
			const result = await deleteRecipe(db, {
				recipeId: input.recipeId,
				currentTabId: tabId,
			})

			if (result) {
				return redirect(
					result.lastVisitedTabId
						? `/recipes/${result.lastVisitedTabId}`
						: '/recipes',
				)
			}

			return null // Return null to stay on the current page
		})
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
	const {
		tabId,
		recipes: [first],
	} = useLoaderData<typeof clientLoader>()

	return (
		<div className="pt-16">
			{first.recipe ? (
				<RecipeLayout
					tabId={tabId}
					recipe={first.recipe}
					organization={first.organization}
					progress={first.progress}
				/>
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
			className="fixed top-0 -mt-px !h-dvh md:mt-0 md:h-auto [&_[data-panel]]:pt-4 first:[&_[data-panel]]:pt-16 md:[&_[data-panel]]:pt-16"
		>
			{recipes.map((recipeData, index, arr) => {
				const panelId = CSS.escape(tabId + index)
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
									tabId={tabId}
									recipe={recipeData.recipe}
									organization={recipeData.organization}
									progress={recipeData.progress}
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
