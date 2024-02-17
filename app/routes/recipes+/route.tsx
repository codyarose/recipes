import { MagnifyingGlassIcon, PlusCircledIcon } from '@radix-ui/react-icons'
import {
	ClientLoaderFunctionArgs,
	Outlet,
	json,
	useLoaderData,
	useNavigate,
} from '@remix-run/react'
import localforage from 'localforage'
import { useState } from 'react'
import { zSavedRecipe } from '~/schema'
import { zodFilteredArray } from '~/utils/misc'
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
import { useRecipeIndexLoader } from './_index/route'

export async function clientLoader({}: ClientLoaderFunctionArgs) {
	const keys = await localforage.keys()
	const savedRecipes = await Promise.all(
		keys.map(key => localforage.getItem(key)),
	)

	return json({
		savedRecipes: zodFilteredArray(zSavedRecipe).parse(savedRecipes),
	} as const)
}

export function HydrateFallback() {
	return null
}

export default function Recipes() {
	const { savedRecipes } = useLoaderData<typeof clientLoader>()
	const isRecipesEmpty = savedRecipes.length === 0
	const navigate = useNavigate()
	const fetchedRecipeSchema = useRecipeIndexLoader()
	const recipeData = useRecipeClientLoader()
	const hasRecipeSchemaData =
		fetchedRecipeSchema?.submission.status !== 'error' &&
		Boolean(fetchedRecipeSchema?.data?.recipe)
	const [isCommandOpen, setIsCommandOpen] = useState(false)
	const [search, setSearch] = useState('')
	const isSearchUrl = z.string().url().safeParse(search).success
	const currentRecipeId = recipeData?.id
	const isCommandDialogOpen = Boolean(recipeData)
		? isCommandOpen
		: hasRecipeSchemaData
			? isCommandOpen
			: true

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
				modal
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
										navigate(`/recipes?recipeUrl=${encodeURIComponent(val)}`)
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
