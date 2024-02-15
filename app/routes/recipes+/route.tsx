import {
	MagnifyingGlassIcon,
	PlusCircledIcon,
	ViewVerticalIcon,
} from '@radix-ui/react-icons'
import {
	ClientLoaderFunctionArgs,
	Form,
	NavLink,
	Outlet,
	json,
	useLoaderData,
	useNavigation,
} from '@remix-run/react'
import localforage from 'localforage'
import {
	PropsWithChildren,
	RefObject,
	useEffect,
	useRef,
	useState,
} from 'react'
import { Button } from '~/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogOverlay,
	DialogTitle,
	DialogTrigger,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { zSavedRecipe } from '~/schema'
import { zodFilteredArray } from '~/utils/misc'
import { useRecipeClientLoader } from './$key'
import { twMerge } from 'tailwind-merge'

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
	const [isSidebarOpen, setIsSidebarOpen] = useState(false)
	const sidebarRef = useRef<HTMLDivElement>(null)

	useOnClickOutside(sidebarRef, () => setIsSidebarOpen(false))

	return (
		<div className="relative grid min-h-dvh grid-cols-1 md:grid-cols-[min-content_1fr]">
			<div
				ref={sidebarRef}
				className={twMerge(
					'fixed top-0 z-10 flex h-dvh min-w-72 max-w-72 flex-col overflow-y-auto border-r bg-white px-3 transition-transform md:sticky md:translate-x-0',
					isSidebarOpen ? 'block translate-x-0' : '-translate-x-72',
				)}
			>
				<div className="flex flex-col gap-3 pb-3 pt-16 md:pt-3">
					<NavLink
						to="/recipes"
						className="text-xl text-slate-700 hover:text-slate-900"
					>
						Recipes
					</NavLink>

					<NewRecipeDialog onSubmit={() => setIsSidebarOpen(false)}>
						<Button size="sm" className="h-7 justify-start gap-2">
							<PlusCircledIcon />
							New recipe
						</Button>
					</NewRecipeDialog>
				</div>

				<ul className="flex flex-col gap-px">
					{savedRecipes.map(item => (
						<li
							key={item.recipe.url}
							className="relative grid grid-cols-[min-content_1fr] gap-2 rounded-sm p-1 hover:bg-secondary hover:text-secondary-foreground has-[.active]:bg-secondary has-[.active]:text-secondary-foreground"
						>
							<div className="aspect-square w-9 overflow-hidden rounded-sm">
								<img
									src={item.recipe.thumbnailUrl}
									alt={item.recipe.name}
									className="h-full w-full object-cover"
								/>
							</div>
							<NavLink
								to={`/recipes/${item.id}`}
								className="line-clamp-2 text-xs font-medium before:absolute before:inset-0"
							>
								{item.recipe.name}
							</NavLink>
						</li>
					))}
				</ul>
			</div>
			<div
				className={twMerge(
					'absolute inset-0 z-[9] bg-secondary/15',
					isSidebarOpen ? 'block' : 'hidden',
				)}
			/>

			<div>
				<div className="container sticky left-0 right-0 top-0 z-50 flex gap-4 border-b bg-white/85 py-3 pl-3 backdrop-blur-sm md:pl-8">
					<button
						onMouseDown={e => {
							setIsSidebarOpen(!isSidebarOpen)
						}}
						className="flex aspect-square w-7 items-center justify-center text-muted-foreground transition-colors hover:text-black md:hidden"
					>
						<ViewVerticalIcon />
					</button>

					<TopBarContent />
				</div>

				<Outlet />
			</div>
		</div>
	)
}

function TopBarContent() {
	const data = useRecipeClientLoader()
	const title = data?.recipe?.name ?? 'Add a new recipe'

	return (
		<div>
			<h1 className="line-clamp-1 text-xl font-medium">{title}</h1>
		</div>
	)
}

function NewRecipeDialog({
	children,
	onSubmit,
}: PropsWithChildren<{ onSubmit: () => void }>) {
	const [isOpen, setIsOpen] = useState(false)
	const transition = useNavigation()
	useEffect(() => {
		if (transition.state === 'idle') {
			setIsOpen(false)
		}
	}, [transition.state])

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogOverlay />
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add a new recipe</DialogTitle>
					<div className="flex flex-col gap-2">
						<Form
							method="GET"
							action="/recipes?index"
							onSubmit={onSubmit}
							className="grid grid-cols-[1fr_min-content] gap-3"
						>
							<Label htmlFor="recipeUrl" className="sr-only">
								Add a new recipe
							</Label>
							<Input
								type="text"
								autoFocus
								id="recipeUrl"
								name="recipeUrl"
								placeholder="https://example.com/really-good-tacos"
								className="placeholder:text-gray-400"
							/>
							<Button type="submit" className="gap-2">
								<MagnifyingGlassIcon />
								Get recipe
							</Button>
						</Form>
					</div>
				</DialogHeader>
			</DialogContent>
		</Dialog>
	)
}

function useOnClickOutside(
	ref: RefObject<HTMLElement>,
	handler: (event: MouseEvent | TouchEvent) => void,
) {
	useEffect(() => {
		const listener = (event: MouseEvent | TouchEvent) => {
			if (!ref.current || ref.current.contains(event.target as Node)) {
				return
			}
			handler(event)
		}

		document.addEventListener('mousedown', listener)
		document.addEventListener('touchstart', listener)
		return () => {
			document.removeEventListener('mousedown', listener)
			document.removeEventListener('touchstart', listener)
		}
	}, [ref, handler])
}
