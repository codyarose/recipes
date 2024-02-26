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
} from '@remix-run/react'
import { parseWithZod } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { match, P } from 'ts-pattern'
import { GeneralErrorBoundary } from '~/components/GeneralErrorBoundary'
import { database } from '~/services/idb/database'
import { Organization } from '~/services/idb/organization'
import { Recipe } from '~/services/idb/recipe'
import { Tab } from '~/services/idb/tab'
import { TabRecipe } from '~/services/idb/tab-recipe'
import { TimeoutError, withTimeout, zodFilteredArray } from '~/utils/misc'
import { checkUrl, getRecipeFromUrl } from '~/utils/parse-schema-graph'
import { tempRecipes } from '~/utils/temp'
import { CommandDialog } from './CommandDialog'
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

	const [savedRecipes, allTabs, allTabRecipes] = await Promise.all([
		Recipe.list(db).then(recipes =>
			zodFilteredArray(Recipe.Info).parse(recipes),
		),
		Tab.list(db),
		TabRecipe.list(db),
	])
	const recipeMap = new Map(savedRecipes.map(recipe => [recipe.id, recipe]))
	const tabRecipesMap = allTabRecipes.reduce<Record<string, TabRecipe.Info[]>>(
		(acc, tabRecipe) => {
			if (!acc[tabRecipe.tabId]) {
				acc[tabRecipe.tabId] = []
			}
			acc[tabRecipe.tabId].push(tabRecipe)
			return acc
		},
		{},
	)
	const tabsWithItems = allTabs.map(tab => ({
		...tab,
		items: (tabRecipesMap[tab.id] || [])
			.map(tabRecipe => {
				const recipe = recipeMap.get(tabRecipe.recipeId)
				return recipe ? { recipeId: recipe.id, name: recipe.name } : null
			})
			.filter((item): item is { recipeId: string; name: string } =>
				Boolean(item),
			),
	}))

	return json({
		savedRecipes,
		tabs: tabsWithItems,
	} as const)
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
				invariantResponse(isWorkingUrl, 'The recipe URL is not reachable')

				const { recipe, organization } = await getRecipeFromUrl(input.recipeUrl)
				return json({
					lastResult: submission.reply(),
					data: { recipe, organization },
				} as const)
			})
			.with({ _action: P.union('add-tab', 'remove-tab') }, () => {
				return json({ lastResult: submission.reply(), data: null } as const)
			})
			.exhaustive()
	} catch (error) {
		if (error instanceof Response) throw error
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
			const org = await Organization.createIfNotExists(db, {
				name: data.organization.name ?? 'Unknown',
				url: data.organization.name ? data.organization.url : null,
			})
			invariantResponse(org, 'Failed to create organization')
			const recipe = await Recipe.createIfNotExists(db, {
				...data.recipe,
				orgId: org.id,
			})
			invariantResponse(recipe, 'Failed to create recipe')
			const tabId = await Tab.create(db)
			await TabRecipe.create(db, { tabId, recipeId: recipe.id })

			return redirect(`/recipes/${tabId}`)
		})
		.with({ _action: 'add-tab' }, async input => {
			if (input.currentTabId && input.recipeIds.length > 1) {
				const tabId = input.currentTabId
				const [_currentRecipe, ...rest] = input.recipeIds
				await Promise.all(
					rest.map(id => TabRecipe.create(db, { tabId, recipeId: id })),
				)
				return redirect(`/recipes/${tabId}`)
			}

			const tabId = await Tab.create(db)
			await Promise.all(
				input.recipeIds.map(id =>
					TabRecipe.create(db, { tabId, recipeId: id }),
				),
			)
			return redirect(`/recipes/${tabId}`)
		})
		.with({ _action: 'remove-tab' }, async input => {
			await Tab.remove(db, input.id)
			const tabChildren = await TabRecipe.fromTabId(db, { tabId: input.id })
			await Promise.all(
				tabChildren.map(tabChild => TabRecipe.remove(db, tabChild.id)),
			)
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
		<div className="grid">
			<div className="grid grid-rows-[min-content_1fr]">
				<div className="no-scrollbar pointer-events-auto fixed left-0 right-0 top-0 z-50 flex h-12 gap-1 overflow-x-auto px-1 pb-2 pt-1 text-sm">
					<TabList />
				</div>

				<Outlet />
			</div>

			<CommandDialog />
		</div>
	)
}

export function ErrorBoundary() {
	return (
		<div className="container pb-12 pt-6">
			<GeneralErrorBoundary />
		</div>
	)
}
