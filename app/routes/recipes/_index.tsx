import {
	Cross2Icon,
	MagnifyingGlassIcon,
	PlusCircledIcon,
} from '@radix-ui/react-icons'
import {
	ClientActionFunctionArgs,
	ClientLoaderFunctionArgs,
	NavLink,
	Outlet,
	json,
	useFetcher,
	useLoaderData,
	useParams,
	useSubmit,
} from '@remix-run/react'
import { useState } from 'react'
import { zSavedRecipe } from '~/schema'
import {
	TimeoutError,
	formatRecipeId,
	withTimeout,
	zodFilteredArray,
} from '~/utils/misc'
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from '~/components/ui/command'
import { z } from 'zod'
import { Button } from '~/components/ui/button'
import { tempRecipes } from '~/utils/temp'
import { ActionFunctionArgs, redirect } from '@remix-run/cloudflare'
import { parseWithZod } from '@conform-to/zod'
import { checkUrl, getRecipeFromUrl } from '~/utils/parse-schema-graph'
import { GeneralErrorBoundary } from '~/components/GeneralErrorBoundary'
import { useRecipeClientLoader } from '../recipes.$key'
import { Recipe } from '~/services/localforage/recipe'
import { Tab } from '~/services/localforage/tab'
import { actionSchema } from './validators'

export async function clientLoader({}: ClientLoaderFunctionArgs) {
	// if (import.meta.env.MODE === 'development') {
	// 	tempRecipes.forEach(async item => {
	// 		// @ts-expect-error temporary
	// 		await Recipe.create(item)
	// 	})
	// }

	const savedRecipes = await Recipe.list()
	const tabs = (await Tab.list()).map(tab => ({
		...tab,
		name: savedRecipes.find(recipe => recipe.id === tab.id)?.recipe.name ?? '',
	}))

	return json({
		savedRecipes: zodFilteredArray(zSavedRecipe).parse(savedRecipes),
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

	const { _action } = submission.value

	try {
		switch (_action) {
			case 'add-recipe':
				const isWorkingUrl = await withTimeout(
					checkUrl(submission.value.recipeUrl),
					5000,
				)
				if (!isWorkingUrl) {
					throw new Error('Invalid recipe URL')
				}
				const { recipe, organization } = await getRecipeFromUrl(
					submission.value.recipeUrl,
				)
				return json({
					lastResult: submission.reply(),
					data: { recipe, organization },
				} as const)
			case 'add-tab':
			case 'remove-tab':
				return json({ lastResult: submission.reply(), data: null } as const)
			default:
				throw new Error(`Unknown action: ${_action}`)
		}
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
	const { _action } = originalSubmission

	if (_action === 'add-recipe') {
		if (!data) return { data, lastResult }
		const id = formatRecipeId(data)
		const path = `/recipes/${id}`
		await Recipe.create({ id, ...data })
		await Tab.create({ id, path: path })
		return redirect(path)
	} else if (_action === 'add-tab') {
		const { id } = originalSubmission
		const path = `/recipes/${id}`
		await Tab.create({ id, path: path })
		return redirect(path)
	} else if (_action === 'remove-tab') {
		const { id, currentTabId } = originalSubmission
		await Tab.remove(id)
		const remainingTabs = await Tab.list()
		if (remainingTabs.length === 0) {
			return redirect('/recipes') // Redirect to the recipes index if no tabs are left
		}
		if (id !== currentTabId) {
			return null // No need to redirect if the removed tab is not the current tab
		}
		const previouslyActiveTab = remainingTabs.reduce((prev, current) =>
			prev.lastVisitedTimestamp > current.lastVisitedTimestamp ? prev : current,
		)
		return redirect(previouslyActiveTab.path) // Redirect to the previously active tab
	}
}

export function HydrateFallback() {
	return null
}

export default function Recipes() {
	const submit = useSubmit()
	const fetcher = useFetcher()
	const params = useParams()
	const { savedRecipes, tabs } = useLoaderData<typeof clientLoader>()
	const isRecipesEmpty = savedRecipes.length === 0
	const recipeData = useRecipeClientLoader()
	const [isCommandOpen, setIsCommandOpen] = useState(false)
	const [search, setSearch] = useState('')
	const isSearchUrl = z.string().url().safeParse(search).success
	const currentRecipeId = recipeData?.id
	const isCommandDialogOpen = !recipeData || isCommandOpen

	return (
		<div className="grid">
			<div className="grid grid-rows-[min-content_1fr]">
				<div className="no-scrollbar pointer-events-auto sticky left-0 right-0 top-0 z-50 flex gap-1 overflow-x-auto px-1 py-1 text-sm">
					{tabs.map(tab => (
						<div
							key={tab.id}
							className="relative grid w-full min-w-36 max-w-52 flex-[0_0_auto] grid-cols-[1fr_min-content] items-center rounded-sm bg-indigo-50/70 px-3 py-2 backdrop-blur-sm transition-colors hover:bg-indigo-100/70 has-[.active]:bg-indigo-200/70"
						>
							<NavLink
								to={tab.path}
								className="line-clamp-1 after:absolute after:inset-0"
							>
								{tab.name}
							</NavLink>
							<fetcher.Form method="POST" className="z-10">
								<input type="hidden" name="id" value={tab.id} />
								<input type="hidden" name="currentTabId" value={params.key} />
								<Button
									type="submit"
									size="icon"
									variant="ghost"
									className="h-4 w-4 hover:bg-black/5"
									name="_action"
									value="remove-tab"
								>
									<Cross2Icon />
								</Button>
							</fetcher.Form>
						</div>
					))}
				</div>

				<Outlet />
			</div>

			<Button
				onClick={() => setIsCommandOpen(prev => !prev)}
				variant="secondary"
				data-open={isCommandDialogOpen}
				className="fixed bottom-3 h-12 w-20 justify-self-center rounded-full bg-indigo-400/30 p-0 text-indigo-500 backdrop-blur-sm transition-all hover:scale-105 hover:bg-indigo-400/40 active:scale-90 active:bg-indigo-400/70 data-[open=true]:scale-95 data-[open=true]:bg-indigo-400/60 data-[open=true]:hover:scale-95"
			>
				<MagnifyingGlassIcon width={20} height={20} />
			</Button>

			<CommandDialog
				open={isCommandDialogOpen}
				onOpenChange={setIsCommandOpen}
				shouldFilter={!isSearchUrl}
			>
				<CommandInput
					placeholder={
						isRecipesEmpty
							? 'Paste a recipe URL here'
							: 'Search recipes or paste a URL...'
					}
					value={search}
					onValueChange={setSearch}
				/>
				<CommandList>
					<CommandEmpty>No results found.</CommandEmpty>
					{isSearchUrl ? (
						<>
							<CommandGroup>
								<CommandItem
									value={search}
									onSelect={val => {
										submit(
											{ _action: 'add-recipe', recipeUrl: val },
											{ method: 'POST' },
										)
										setSearch('')
										setIsCommandOpen(false)
									}}
									className="line-clamp-1 flex flex-nowrap gap-2 text-nowrap"
								>
									<PlusCircledIcon />
									Get recipe from URL
								</CommandItem>
							</CommandGroup>
							<CommandSeparator />
						</>
					) : null}

					{savedRecipes.length ? (
						<CommandGroup heading="Recipes">
							{savedRecipes.map(item => (
								<CommandItem
									key={item.id}
									value={item.id}
									data-currently-selected={currentRecipeId === item.id}
									onSelect={val => {
										if (currentRecipeId === val) return
										submit({ _action: 'add-tab', id: val }, { method: 'POST' })
										setIsCommandOpen(false)
									}}
									className="line-clamp-1 data-[currently-selected=true]:bg-black/10"
								>
									{item.recipe.name}
								</CommandItem>
							))}
						</CommandGroup>
					) : null}
				</CommandList>
			</CommandDialog>
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
