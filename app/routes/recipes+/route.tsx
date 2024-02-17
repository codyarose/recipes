import { MagnifyingGlassIcon, PlusCircledIcon } from '@radix-ui/react-icons'
import {
	ClientActionFunctionArgs,
	ClientLoaderFunctionArgs,
	Outlet,
	json,
	useLoaderData,
	useNavigate,
	useSubmit,
} from '@remix-run/react'
import localforage from 'localforage'
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

export async function clientLoader({}: ClientLoaderFunctionArgs) {
	// if (import.meta.env.MODE === 'development') {
	// 	tempRecipes.forEach(async item => {
	// 		await localforage.setItem(item.id, item)
	// 	})
	// }

	const keys = await localforage.keys()
	const savedRecipes = await Promise.all(
		keys.map(key => localforage.getItem(key)),
	)

	return json({
		savedRecipes: zodFilteredArray(zSavedRecipe).parse(savedRecipes),
	} as const)
}

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const submission = parseWithZod(formData, {
		schema: z.object({
			recipeUrl: z.string().url({ message: 'Invalid recipe URL' }),
		}),
	})

	if (submission.status !== 'success') {
		return json({ submission: submission.reply(), data: null }, { status: 400 })
	}

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
				},
				{ status: 400 },
			)
		}
		const { recipe, organization } = await getRecipeFromUrl(
			submission.value.recipeUrl,
		)
		return json({ submission, data: { recipe, organization } } as const)
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
				},
				{ status: 500 },
			)
		}

		console.error('Unknown error', error)
		throw new Response('Unknown error', { status: 500 })
	}
}

export async function clientAction({ serverAction }: ClientActionFunctionArgs) {
	const { data, submission } = await serverAction<typeof action>()
	if (!data) {
		return { data, submission }
	}
	const id = formatRecipeId(data)
	await localforage.setItem(id, { id, ...data })
	return redirect(`/recipes/${id}`)
}

export function HydrateFallback() {
	return null
}

export default function Recipes() {
	const submit = useSubmit()
	const { savedRecipes } = useLoaderData<typeof clientLoader>()
	const isRecipesEmpty = savedRecipes.length === 0
	const navigate = useNavigate()
	const recipeData = useRecipeClientLoader()
	const [isCommandOpen, setIsCommandOpen] = useState(false)
	const [search, setSearch] = useState('')
	const isSearchUrl = z.string().url().safeParse(search).success
	const currentRecipeId = recipeData?.id
	const isCommandDialogOpen = !recipeData || isCommandOpen

	return (
		<div className="grid">
			<div>
				{Boolean(recipeData) ? (
					<div className="container sticky left-0 right-0 top-0 z-10 border-b bg-white/85 py-3 backdrop-blur-sm">
						<TopBarContent />
					</div>
				) : null}

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
										submit({ recipeUrl: val }, { method: 'POST' })
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
										navigate(`/recipes/${val}`)
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
