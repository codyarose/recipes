import {
	ClientActionFunctionArgs,
	ClientLoaderFunctionArgs,
	json,
	redirect,
	useLoaderData,
	useRouteLoaderData,
} from '@remix-run/react'
import { invariantResponse } from '@epic-web/invariant'
import { ElementScrollRestoration } from '@epic-web/restore-scroll'
import { CrossCircledIcon } from '@radix-ui/react-icons'
import { z } from 'zod'
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '~/components/ui/resizable'
import { zSavedRecipe } from '~/schema'
import { Recipe } from '~/services/localforage/recipe'
import { Tab } from '~/services/localforage/tab'
import { useMedia } from '~/utils/misc'
import { RecipeLayout } from './recipes.$key'

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
	const leftKey = z.string().safeParse(params.key)
	const rightKey = z.string().safeParse(params.key2)
	invariantResponse(leftKey.success && rightKey.success, 'Invalid recipe key')

	const [leftSavedRecipe, rightSavedRecipe] = await Promise.all([
		Recipe.fromId(leftKey.data).then(data => zSavedRecipe.safeParse(data)),
		Recipe.fromId(rightKey.data).then(data => zSavedRecipe.safeParse(data)),
	])

	await Tab.updateLastVisitedTimestamp([leftKey.data, rightKey.data].join('-'))

	return json([
		leftSavedRecipe.success
			? {
					id: leftSavedRecipe.data.id,
					recipe: leftSavedRecipe.data.recipe,
					organization: leftSavedRecipe.data.organization,
				}
			: null,
		rightSavedRecipe.success
			? {
					id: rightSavedRecipe.data.id,
					recipe: rightSavedRecipe.data.recipe,
					organization: rightSavedRecipe.data.organization,
				}
			: null,
	] as const)
}
export function useRecipeClientLoader() {
	return useRouteLoaderData<typeof clientLoader>('routes/recipes.$key')
}

export async function clientAction({
	request,
	params,
}: ClientActionFunctionArgs) {
	const formData = await request.formData()
	const recipeId = z.string().parse(formData.get('recipeId'))
	const currentTab = await Tab.fromId(Object.values(params).join('-'))

	if (!currentTab) return redirect('/recipes')

	await Recipe.remove(recipeId)

	const filteredItems = currentTab.items.filter(id => id !== recipeId)
	if (filteredItems.length === 0) {
		// If somehow there are no items left, remove the tab and redirect to the recipes page
		await Tab.remove(currentTab.id)
		return redirect('/recipes')
	}
	await Tab.remove(currentTab.id) // Remove the old tab
	await Tab.remove(recipeId) // Remove any other tabs with the same id
	const [newTabId] = filteredItems
	await Tab.create({ id: newTabId, items: [newTabId] }) // Create a new tab for the other recipe
	return redirect(`/recipes/${newTabId}`) // Redirect to the new tab
}

export default function RecipeComponent() {
	const [leftRecipe, rightRecipe] = useLoaderData<typeof clientLoader>()
	const isDesktop = useMedia('(min-width: 768px)')
	const panelGroupId = `${leftRecipe?.id}-${rightRecipe?.id}`
	const leftPanelId = `${panelGroupId}-left`
	const rightPanelId = `${panelGroupId}-right`

	return (
		<ResizablePanelGroup
			autoSaveId={panelGroupId}
			direction={isDesktop ? 'horizontal' : 'vertical'}
			className="-mt-px md:mt-0 !h-dvh md:h-auto"
		>
			<ResizablePanel
				key={leftPanelId}
				id={leftPanelId}
				order={1}
				className="!overflow-y-auto h-full pt-11"
				minSize={20}
			>
				{leftRecipe ? <RecipeLayout {...leftRecipe} /> : <RecipeNotFound />}
			</ResizablePanel>
			<ElementScrollRestoration elementQuery={`#${leftPanelId}`} />

			<ResizableHandle
				withHandle
				className="bg-indigo-300/70 [&>div]:bg-indigo-100 [&>div]:border-indigo-400/20 [&>div]:text-indigo-500 [&>div]:hover:bg-indigo-200 [&>div]:transition-colors hover:[&>div]:bg-indigo-200"
			/>

			<ResizablePanel
				key={rightPanelId}
				id={rightPanelId}
				order={2}
				className="!overflow-y-auto h-full md:pt-11"
				minSize={20}
			>
				{rightRecipe ? <RecipeLayout {...rightRecipe} /> : <RecipeNotFound />}
			</ResizablePanel>
			<ElementScrollRestoration elementQuery={`#${rightPanelId}`} />
		</ResizablePanelGroup>
	)
}

function RecipeNotFound() {
	return (
		<div className="w-full h-full flex justify-center items-center">
			<div className="w-full max-w-sm max-h-sm mx-4 text-center px-6 py-12 justify-center flex items-center gap-2 text-xl text-red-800 bg-red-50 rounded-md">
				<CrossCircledIcon width={20} height={20} />
				Recipe not found
			</div>
		</div>
	)
}
