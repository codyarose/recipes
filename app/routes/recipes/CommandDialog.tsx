import {
	createContext,
	Dispatch,
	ReactNode,
	SetStateAction,
	useContext,
	useState,
} from 'react'
import { useActionData, useNavigate, useSubmit } from '@remix-run/react'
import {
	Cross2Icon,
	MagnifyingGlassIcon,
	PlusCircledIcon,
	ViewHorizontalIcon,
	ViewVerticalIcon,
} from '@radix-ui/react-icons'
import { z } from 'zod'
import { ErrorList } from '~/components/ErrorList'
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
import { useMedia } from '~/utils/misc'
import { useRecipeClientLoader } from '../recipes.$tabId/route'
import { clientAction, useRecipeIndexLoaderData } from './_index'

const CommandContext = createContext<{
	recipeIndexData: NonNullable<ReturnType<typeof useRecipeIndexLoaderData>>
	currentTab:
		| NonNullable<ReturnType<typeof useRecipeIndexLoaderData>>['tabs'][number]
		| undefined
	isCommandOpen: boolean
	setIsCommandOpen: Dispatch<SetStateAction<boolean>>
	search: string
	setSearch: Dispatch<SetStateAction<string>>
}>({
	recipeIndexData: {
		savedRecipes: [],
		tabs: [],
	},
	currentTab: undefined,
	isCommandOpen: false,
	setIsCommandOpen: () => {},
	search: '',
	setSearch: () => {},
})

export function CommandProvider({ children }: { children: ReactNode }) {
	const [isCommandOpen, setIsCommandOpen] = useState(false)
	const [search, setSearch] = useState('')
	const recipeIndexData = useRecipeIndexLoaderData()
	const recipeData = useRecipeClientLoader()
	const currentTab = recipeIndexData?.tabs.find(
		tab => tab.id === recipeData?.tabId,
	)

	if (!recipeIndexData) return null

	return (
		<CommandContext.Provider
			value={{
				recipeIndexData,
				currentTab: currentTab,
				isCommandOpen: !currentTab || isCommandOpen,
				setIsCommandOpen,
				search,
				setSearch,
			}}
		>
			{children}
		</CommandContext.Provider>
	)
}

function useCommand() {
	const context = useContext(CommandContext)
	if (context === undefined) {
		throw new Error('useCommand must be used within a CommandProvider')
	}
	return context
}

export function CommandDialog() {
	const {
		isCommandOpen,
		setIsCommandOpen,
		search,
		setSearch,
		recipeIndexData,
	} = useCommand()
	const actionData = useActionData<typeof clientAction>()
	const error = actionData?.lastResult.error?.['recipeUrl']
	console.log(error)

	return (
		<>
			<SearchButton />

			<CommandDialogComponent
				open={isCommandOpen}
				onOpenChange={setIsCommandOpen}
				shouldFilter={!z.string().url().safeParse(search).success}
				className="relative bg-slate-200 text-slate-950 shadow-lg shadow-slate-700/40"
			>
				<div className="pointer-events-none absolute inset-0 before:absolute before:inset-[1px] before:rounded-[7px] before:bg-white/80 before:shadow-[inset_0px_0px_2px_0px_rgb(0_0_0_/_0.05)] before:shadow-white after:absolute after:inset-0 after:bg-gradient-to-t after:from-slate-50/40 after:via-transparent" />
				<CommandInput
					placeholder={
						recipeIndexData.savedRecipes.length === 0
							? 'Paste a recipe URL here'
							: 'Search recipes or paste a URL...'
					}
					value={search}
					onValueChange={setSearch}
					className="z-[1]"
				/>
				<ErrorList errors={error} className="z-[1] px-4 italic" />

				<CommandList className="z-[1]">
					<CommandEmpty>No results found.</CommandEmpty>

					<CommandAddRecipe />

					<CommandTabsGroup />
					<CommandRecipesGroup />
				</CommandList>
			</CommandDialogComponent>
		</>
	)
}

function SearchButton() {
	const { isCommandOpen, setIsCommandOpen } = useCommand()
	return (
		<Button
			onClick={() => setIsCommandOpen(prev => !prev)}
			variant="secondary"
			data-open={isCommandOpen}
			className="group fixed bottom-4 z-50 h-11 w-full max-w-xs justify-start gap-2 justify-self-center overflow-hidden rounded-2xl bg-slate-100 px-5 text-slate-950 shadow-lg shadow-slate-900/20 transition-all hover:scale-[1.01] hover:bg-slate-200 hover:shadow-slate-900/25 active:translate-y-[2px] data-[open=true]:translate-y-full data-[open=true]:opacity-0"
		>
			<div className="absolute inset-0 before:absolute before:inset-[1px] before:rounded-[14.5px] before:bg-white/70 before:shadow-[inset_0px_0px_2px_0px_rgb(0_0_0_/_0.05)] before:shadow-white after:absolute after:inset-0 after:bg-gradient-to-t after:from-slate-50/90 after:via-slate-50/40" />
			<MagnifyingGlassIcon
				width={20}
				height={20}
				className="z-[1] opacity-50 transition-opacity group-hover:opacity-65"
			/>
			<span className="z-[1] font-serif text-sm font-light italic opacity-35">
				Search recipes...
			</span>
		</Button>
	)
}

function CommandAddRecipe() {
	const submit = useSubmit()
	const { search, setSearch, setIsCommandOpen } = useCommand()
	const isSearchUrl = z.string().url().safeParse(search).success

	if (!isSearchUrl) return null

	return (
		<>
			<CommandGroup>
				<CommandItem
					onSelect={() => {
						submit(
							{ _action: 'add-recipe', recipeUrl: search },
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
	)
}

function CommandTabsGroup() {
	const navigate = useNavigate()
	const submit = useSubmit()
	const { setIsCommandOpen, currentTab, recipeIndexData } = useCommand()
	const { tabs } = recipeIndexData

	if (!tabs.length) return null

	return (
		<>
			<CommandGroup heading="Tabs" className="text-slate-950">
				{tabs.map(tab => {
					return (
						<CommandItem
							key={tab.id}
							value={tab.id}
							onSelect={() => {
								navigate(`/recipes/${tab.id}`)
								setIsCommandOpen(false)
							}}
							data-currently-selected={tab.id === currentTab?.id}
							className="line-clamp-1 flex justify-between data-[currently-selected=true]:z-10 data-[currently-selected=true]:border data-[currently-selected=true]:border-slate-950/[0.08] data-[currently-selected=true]:bg-slate-950/[0.08] data-[currently-selected=true]:shadow-sm"
						>
							{tab.items.map(item => item.name).join(' / ')}
							<Button
								title="Close tab"
								variant="ghost"
								size="icon"
								className="h-4 w-4 text-slate-950/30 hover:bg-transparent hover:text-slate-950"
								onClick={e => {
									e.stopPropagation()
									submit(
										{
											_action: 'remove-tab',
											id: tab.id,
											currentTabId: currentTab?.id ?? null,
										},
										{ method: 'POST' },
									)
								}}
							>
								<Cross2Icon />
							</Button>
						</CommandItem>
					)
				})}
			</CommandGroup>
			<CommandSeparator />
		</>
	)
}

function CommandRecipesGroup() {
	const submit = useSubmit()
	const { recipeIndexData, currentTab, setIsCommandOpen } = useCommand()
	const { savedRecipes: recipes } = recipeIndexData
	const canSplit = (currentTab?.items.length ?? 0) === 1
	const currentRecipeIds = currentTab?.items.map(item => item.recipeId)
	const isDesktop = useMedia('(min-width: 768px)')

	if (recipeIndexData.savedRecipes.length === 0) return null

	return (
		<CommandGroup heading="Recipes" className="text-slate-950">
			{recipes.map(recipe => {
				const prefetch = () => {
					if (recipe.thumbnailUrl) {
						const img = new Image()
						img.src = recipe.thumbnailUrl
					}
				}
				return (
					<CommandItem
						key={recipe.id}
						value={recipe.id}
						onMouseEnter={prefetch}
						onFocus={prefetch}
						onSelect={() => {
							submit(
								{
									_action: 'add-tab',
									currentTabId: currentTab?.id ?? null,
									recipeIds: JSON.stringify([recipe.id]),
								},
								{ method: 'POST' },
							)
							setIsCommandOpen(false)
						}}
						className="line-clamp-1 flex justify-between"
					>
						{recipe.name}
						{canSplit ? (
							<Button
								size="icon"
								variant="link"
								title="Open in split tab"
								className="h-6 w-6 text-muted-foreground hover:text-foreground [&>svg]:!h-4 [&>svg]:!w-4"
								onClick={e => {
									e.stopPropagation()
									submit(
										{
											_action: 'add-tab',
											currentTabId: currentTab?.id ?? null,
											recipeIds: JSON.stringify([
												currentRecipeIds?.[0],
												recipe.id,
											]),
										},
										{ method: 'POST' },
									)
									setIsCommandOpen(false)
								}}
							>
								{isDesktop ? <ViewVerticalIcon /> : <ViewHorizontalIcon />}
							</Button>
						) : null}
					</CommandItem>
				)
			})}
		</CommandGroup>
	)
}
