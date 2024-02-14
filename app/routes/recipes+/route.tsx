import {
	CookieIcon,
	MagnifyingGlassIcon,
	PlusCircledIcon,
} from '@radix-ui/react-icons'
import {
	ClientLoaderFunctionArgs,
	Form,
	Link,
	NavLink,
	Outlet,
	json,
	useLoaderData,
} from '@remix-run/react'
import localforage from 'localforage'
import { PropsWithChildren } from 'react'
import { Button } from '~/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogOverlay,
	DialogTitle,
	DialogTrigger,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { zSavedRecipe } from '~/schema'
import { zodFilteredArray } from '~/utils/misc'

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

	return (
		<div className="flex h-dvh">
			<div className="flex w-60 flex-col border-r px-3 py-2">
				<div className="flex flex-col gap-3 py-3">
					<NavLink
						to="/recipes"
						className="text-slate-700 hover:text-slate-900"
					>
						Recipes
					</NavLink>

					<NewRecipeDialog>
						<Button size="sm" className="justify-start gap-2">
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
			<div className="flex flex-1 overflow-hidden">
				<div className="flex-1 overflow-y-auto">
					<Outlet />
				</div>
			</div>
		</div>
	)
}

function NewRecipeDialog({ children }: PropsWithChildren<{}>) {
	return (
		<Dialog>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogOverlay />
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add a new recipe</DialogTitle>
					<DialogDescription>
						<div className="flex flex-col gap-2">
							<Form
								method="GET"
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
					</DialogDescription>
				</DialogHeader>
			</DialogContent>
		</Dialog>
	)
}
