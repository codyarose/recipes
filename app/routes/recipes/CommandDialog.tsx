import { useLoaderData, useSubmit } from '@remix-run/react'
import { clientLoader } from './_index'
import { useRecipeClientLoader } from '../recipes.$key'
import { ComponentProps, useState } from 'react'
import { z } from 'zod'
import { Button } from '~/components/ui/button'
import {
	CommandDialog as CommandDialogComponent,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from '~/components/ui/command'
import { MagnifyingGlassIcon, PlusCircledIcon } from '@radix-ui/react-icons'

export function CommandDialog() {
	const { savedRecipes } = useLoaderData<typeof clientLoader>()
	const submit = useSubmit()
	const recipeData = useRecipeClientLoader()
	const [isCommandOpen, setIsCommandOpen] = useState(false)
	const [search, setSearch] = useState('')
	const isRecipesEmpty = savedRecipes.length === 0
	const isSearchUrl = z.string().url().safeParse(search).success
	const currentRecipeId = recipeData?.id
	const isCommandDialogOpen = !recipeData || isCommandOpen

	return (
		<>
			<Button
				onClick={() => setIsCommandOpen(prev => !prev)}
				variant="secondary"
				data-open={isCommandDialogOpen}
				className="fixed bottom-3 h-12 w-20 justify-self-center rounded-full bg-indigo-400/30 p-0 text-indigo-500 backdrop-blur-sm transition-all hover:scale-105 hover:bg-indigo-400/40 active:scale-90 active:bg-indigo-400/70 data-[open=true]:scale-95 data-[open=true]:bg-indigo-400/60 data-[open=true]:hover:scale-95"
			>
				<MagnifyingGlassIcon width={20} height={20} />
			</Button>

			<CommandDialogComponent
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
						<CommandAddRecipe
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
						/>
					) : null}

					{savedRecipes.length ? (
						<CommandGroup heading="Recipes">
							{savedRecipes.map(item => {
								const prefetch = () => {
									if (item.recipe.thumbnailUrl) {
										const img = new Image()
										img.src = item.recipe.thumbnailUrl
									}
								}
								return (
									<CommandItem
										key={item.id}
										value={item.id}
										data-currently-selected={currentRecipeId === item.id}
										onMouseEnter={prefetch}
										onFocus={prefetch}
										onSelect={val => {
											if (currentRecipeId === val) return
											submit(
												{ _action: 'add-tab', id: val },
												{ method: 'POST' },
											)
											setIsCommandOpen(false)
										}}
										className="line-clamp-1 data-[currently-selected=true]:bg-black/10"
									>
										{item.recipe.name}
									</CommandItem>
								)
							})}
						</CommandGroup>
					) : null}
				</CommandList>
			</CommandDialogComponent>
		</>
	)
}

function CommandAddRecipe(props: ComponentProps<typeof CommandItem>) {
	return (
		<>
			<CommandGroup>
				<CommandItem {...props}>
					<PlusCircledIcon />
					Get recipe from URL
				</CommandItem>
			</CommandGroup>
			<CommandSeparator />
		</>
	)
}
