import { PropsWithChildren } from 'react'
import {
	ActionFunctionArgs,
	MetaFunction,
	redirect,
} from '@remix-run/cloudflare'
import {
	ClientActionFunctionArgs,
	ClientLoaderFunctionArgs,
	json,
	Outlet,
	useRouteLoaderData,
} from '@remix-run/react'
import { parseWithZod } from '@conform-to/zod'
import { match, P } from 'ts-pattern'
import { GeneralErrorBoundary } from '~/components/GeneralErrorBoundary'
import { database } from '~/services/idb/database'
import { Recipe } from '~/services/idb/recipe'
import { Tab } from '~/services/idb/tab'
import { TimeoutError, withTimeout, zodFilteredArray } from '~/utils/misc'
import { checkUrl, getRecipeFromUrl } from '~/utils/parse-schema-graph'
import { CommandDialog, CommandProvider } from './CommandDialog'
import { addRecipe, addTab, collateTabs, removeTab } from './queries.client'
import { TabList } from './TabList'
import { actionSchema } from './validators'

export const meta: MetaFunction = () => {
	return [{ title: 'Recipes' }]
}

export async function clientLoader({}: ClientLoaderFunctionArgs) {
	const db = await database()
	// if (import.meta.env.MODE === 'development') {
	// 	tempRecipes.forEach(async item => {
	// 		const org = await Organization.createIfNotExists(db, {
	// 			name: item.organization.name,
	// 			url: item.organization.url,
	// 		})
	// 		// @ts-expect-error temporary
	// 		await Recipe.createIfNotExists(db, { ...item.recipe, orgId: org.id })
	// 	})
	// }

	const recipes = await Recipe.list(db).then(recipes =>
		zodFilteredArray(Recipe.Info).parse(recipes),
	)
	const tabs = await collateTabs(db, recipes)

	return json({
		savedRecipes: recipes,
		tabs,
	} as const)
}

export function useRecipeIndexLoaderData() {
	return useRouteLoaderData<typeof clientLoader>('routes/recipes/_index')
}

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const submission = parseWithZod(formData, {
		schema: actionSchema,
	})

	if (submission.status !== 'success') {
		return json({ lastResult: submission.reply(), data: null } as const, {
			status: submission.status === 'error' ? 400 : 200,
		})
	}

	try {
		return match(submission.value)
			.with({ _action: 'add-recipe' }, async input => {
				const isWorkingUrl = await withTimeout(checkUrl(input.recipeUrl), 5000)
				if (!isWorkingUrl) {
					return json({
						lastResult: submission.reply({
							fieldErrors: {
								recipeUrl: [
									'That recipe URL was not reachable. Please check the URL and try again.',
								],
							},
						}),
						data: null,
					})
				}

				try {
					const { recipe, organization } = await getRecipeFromUrl(
						input.recipeUrl,
					)
					return json({
						lastResult: submission.reply(),
						data: { recipe, organization },
					} as const)
				} catch (error) {
					if (error instanceof Response) {
						const message =
							error.status >= 400
								? 'No recipe found. Please check the URL and try again.'
								: 'An unexpected error occurred. Please try again.'
						return json({
							lastResult: submission.reply({
								fieldErrors: {
									recipeUrl: [message],
								},
							}),
							data: null,
						})
					}
					throw error
				}
			})
			.with({ _action: P.union('add-tab', 'remove-tab') }, () => {
				return json({ lastResult: submission.reply(), data: null } as const)
			})
			.exhaustive()
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'An unexpected error occurred'
		const status = error instanceof TimeoutError ? 504 : 400
		return json(
			{
				lastResult: submission.reply({
					fieldErrors: { recipeUrl: [message] },
				}),
				data: null,
			} as const,
			{ status },
		)
	}
}

export async function clientAction({ serverAction }: ClientActionFunctionArgs) {
	const { data, lastResult } = await serverAction<typeof action>()
	if (lastResult.status !== 'success') {
		return { data, lastResult }
	}

	const db = await database()

	const originalSubmission = actionSchema.parse(lastResult.initialValue)
	return match(originalSubmission)
		.with({ _action: 'add-recipe' }, async () => {
			if (!data) return { data, lastResult }
			const tabId = await addRecipe(db, data)
			return redirect(`/recipes/${tabId}`)
		})
		.with({ _action: 'add-tab' }, async input => {
			const tabId = await addTab(db, input)
			return redirect(`/recipes/${tabId}`)
		})
		.with({ _action: 'remove-tab' }, async input => {
			await removeTab(db, input)
			if (input.id !== input.currentTabId) {
				return redirect(`/recipes/${input.currentTabId}`)
			}
			const lastVisitedTab = await Tab.lastVisited(db)
			if (!lastVisitedTab) {
				return redirect('/recipes')
			}
			return redirect(`/recipes/${lastVisitedTab.id}`)
		})
		.exhaustive()
}

export function HydrateFallback() {
	return null
}

export default function Recipes() {
	return (
		<RecipesIndexLayout>
			<Outlet />
		</RecipesIndexLayout>
	)
}

function RecipesIndexLayout({ children }: PropsWithChildren) {
	return (
		<div className="grid">
			<div className="grid grid-rows-[min-content_1fr]">
				<div className="no-scrollbar pointer-events-auto fixed left-0 right-0 top-0 z-50 flex h-12 gap-1 overflow-x-auto px-1 pb-2 pt-1 text-sm">
					<TabList />
				</div>

				{children}
			</div>

			<CommandProvider>
				<CommandDialog />
			</CommandProvider>
		</div>
	)
}

export function ErrorBoundary() {
	return (
		<RecipesIndexLayout>
			<GeneralErrorBoundary />
		</RecipesIndexLayout>
	)
}
