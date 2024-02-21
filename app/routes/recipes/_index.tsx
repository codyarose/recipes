import { ActionFunctionArgs, redirect } from '@remix-run/cloudflare'
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
import { zSavedRecipe } from '~/schema'
import { Recipe } from '~/services/localforage/recipe'
import { Tab } from '~/services/localforage/tab'
import {
	formatRecipeId,
	TimeoutError,
	withTimeout,
	zodFilteredArray,
} from '~/utils/misc'
import { checkUrl, getRecipeFromUrl } from '~/utils/parse-schema-graph'
import { tempRecipes } from '~/utils/temp'
import { CommandDialog } from './CommandDialog'
import { TabList } from './TabList'
import { actionSchema } from './validators'

export async function clientLoader({}: ClientLoaderFunctionArgs) {
	// if (import.meta.env.MODE === 'development') {
	// 	tempRecipes.forEach(async item => {
	// 		// @ts-expect-error temporary
	// 		await Recipe.create(item)
	// 	})
	// }

	const savedRecipes = zodFilteredArray(zSavedRecipe).parse(await Recipe.list())
	const tabs = (await Tab.list())
		.map(tab => ({
			...tab,
			items: tab.items.map(id => {
				const recipe = savedRecipes.find(recipe => recipe.id === id)
				return recipe
					? {
							id: recipe.id,
							name: recipe.recipe.name,
						}
					: {
							id,
							name: 'Unknown',
						}
			}),
		}))
		.sort((a, b) => b.createdAt - a.createdAt)

	return json({
		savedRecipes,
		tabs,
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
				invariantResponse(isWorkingUrl, 'Invalid recipe URL')
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
		const message = error instanceof Error ? error.message : 'Unknown error'
		const status = error instanceof TimeoutError ? 500 : 400
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

	const originalSubmission = actionSchema.parse(lastResult.initialValue)
	return match(originalSubmission)
		.with({ _action: 'add-recipe' }, async () => {
			if (!data) return { data, lastResult }
			const id = formatRecipeId(data)
			await Recipe.create(data)
			await Tab.create({ id, items: [id] })
			return redirect(`/recipes/${id}`)
		})
		.with({ _action: 'add-tab' }, async input => {
			await Tab.create({ id: input.ids.join('-'), items: input.ids })
			if (input.ids.length > 1) {
				await Tab.remove(input.ids[0])
			}
			return redirect(`/recipes/${input.ids.join('/')}`)
		})
		.with({ _action: 'remove-tab' }, async input => {
			await Tab.remove(input.id)
			if (input.id !== input.currentTabId) {
				return null // No need to redirect if the removed tab is not the current tab
			}
			const remainingTabs = await Tab.list()
			if (!remainingTabs.length) {
				return redirect('/recipes') // Redirect to the recipes index if no tabs are left
			}
			const previouslyActiveTab = remainingTabs.reduce((prev, current) =>
				prev.lastVisitedTimestamp > current.lastVisitedTimestamp
					? prev
					: current,
			)
			return redirect(`/recipes/${previouslyActiveTab.items.join('/')}`) // Redirect to the previously active tab
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
				<div className="no-scrollbar pointer-events-auto fixed left-0 right-0 top-0 z-50 flex gap-1 h-11 overflow-x-auto px-1 py-1 text-sm">
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
