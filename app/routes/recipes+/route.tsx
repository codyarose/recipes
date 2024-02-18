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
	useLoaderData,
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
import { useRecipeClientLoader } from './$key'
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
import { recipeStore, tabStore } from '~/services/localforage.client'

export async function clientLoader({}: ClientLoaderFunctionArgs) {
	// if (import.meta.env.MODE === 'development') {
	// 	tempRecipes.forEach(async item => {
	// 		await recipeStore.setItem(item.id, item)
	// 	})
	// }

	const recipeKeys = await recipeStore.keys()
	const savedRecipes = await Promise.all(
		recipeKeys.map(key => recipeStore.getItem(key)),
	)
	const tabKeys = await tabStore.keys()
	const tabs = await Promise.all(
		tabKeys.map(async key => {
			const tabData = await tabStore.getItem(key)
			return {
				...tabData,
				name:
					savedRecipes.find(recipe => recipe.id === tabData.id)?.recipe.name ??
					'',
			}
		}),
	)

	return json({
		savedRecipes: zodFilteredArray(zSavedRecipe).parse(savedRecipes),
		tabs,
	} as const)
}

const actionSchema = z.discriminatedUnion('_action', [
	z.object({
		_action: z.literal('add-recipe'),
		recipeUrl: z.string().url({ message: 'Invalid recipe URL' }),
	}),
	z.object({
		_action: z.literal('add-tab'),
		id: z.string(),
	}),
	z.object({
		_action: z.literal('remove-tab'),
		id: z.string(),
	}),
])

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const submission = parseWithZod(formData, {
		schema: actionSchema,
	})

	if (submission.status !== 'success') {
		return json(
			{ submission: submission.reply(), data: null, _action: null },
			{ status: 400 },
		)
	}
	const { _action } = submission.value

	if (_action === 'add-recipe') {
		try {
			const isWorkingUrl = await withTimeout(
				checkUrl(submission.value.recipeUrl),
				5000,
			)
			if (!isWorkingUrl) {
				return json(
					{
						submission: submission.reply({
							fieldErrors: { recipeUrl: ['Invalid recipe URL'] },
						}),
						data: null,
						_action,
					},
					{ status: 400 },
				)
			}
			const { recipe, organization } = await getRecipeFromUrl(
				submission.value.recipeUrl,
			)
			return json({
				submission,
				data: { recipe, organization },
				_action,
			} as const)
		} catch (error) {
			if (error instanceof Response) throw error
			if (error instanceof Error)
				throw new Response(error.message, { status: 500 })
			if (error instanceof TimeoutError) {
				return json(
					{
						submission: submission.reply({
							fieldErrors: { recipeUrl: ['Unable to fetch recipe from URL'] },
						}),
						data: null,
						_action,
					},
					{ status: 500 },
				)
			}

			console.error('Unknown error', error)
			throw new Response('Unknown error', { status: 500 })
		}
	} else if (_action === 'add-tab') {
		return json({ submission, data: null, _action } as const)
	} else if (_action === 'remove-tab') {
		return json({ submission, data: null, _action } as const)
	}

	throw new Response(`Unknown action: ${_action}`, { status: 400 })
}

export async function clientAction({ serverAction }: ClientActionFunctionArgs) {
	const { data, submission, _action } = await serverAction<typeof action>()
	if (submission.status !== 'success') {
		return { data, submission }
	}

	if (_action === 'add-recipe') {
		if (!data) return { data, submission }
		const id = formatRecipeId(data)
		await recipeStore.setItem(id, { id, ...data })
		await tabStore.setItem(id, {
			id: id,
			path: `/recipes/${id}`,
		})
		return redirect(`/recipes/${id}`)
	} else if (_action === 'add-tab' && submission.value._action === 'add-tab') {
		const id = submission.value.id
		await tabStore.setItem(id, {
			id: id,
			path: `/recipes/${id}`,
		})
		return redirect(`/recipes/${id}`)
	} else if (
		_action === 'remove-tab' &&
		submission.value._action === 'remove-tab'
	) {
		await tabStore.removeItem(submission.value.id)
		// TODO use a fetcher to submit the action to avoid document reload when tab is removed
		return null
	}
}

export function HydrateFallback() {
	return null
}

export default function Recipes() {
	const submit = useSubmit()
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
							<Button
								size="icon"
								variant="ghost"
								className="z-10 h-4 w-4 hover:bg-black/5"
								onClick={() =>
									submit(
										{ _action: 'remove-tab', id: tab.id },
										{ method: 'POST' },
									)
								}
							>
								<Cross2Icon />
							</Button>
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
										// tabStore.setItem(val, { id: val, path: `/recipes/${val}` })
										// navigate(`/recipes/${val}`)
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

function TopBarContent() {
	const data = useRecipeClientLoader()
	const title = data?.recipe?.name ?? ''

	return (
		<div>
			<h1 className="line-clamp-1 text-xl font-medium">{title}</h1>
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
