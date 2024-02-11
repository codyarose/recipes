import { json, redirect } from '@remix-run/cloudflare'
import {
	ClientActionFunctionArgs,
	ClientLoaderFunctionArgs,
	Form,
	Link,
	useFetcher,
	useLoaderData,
	useSubmit,
} from '@remix-run/react'
import { z } from 'zod'
import { Label } from '~/components/ui/label'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import localforage from 'localforage'
import { loader as recipeLoader } from '~/routes/resources+/recipe'
import { getRecipeKey, zodFilteredArray } from '~/utils/misc'
import { zSavedRecipe } from '~/schema'
import { RecipeCard } from '~/components/RecipeCard'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { parseWithZod } from '@conform-to/zod'
import { useRef, useState } from 'react'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'

export async function clientLoader({}: ClientLoaderFunctionArgs) {
	const keys = await localforage.keys()
	const savedRecipes = await Promise.all(
		keys.map(key => localforage.getItem(key)),
	)

	return json({
		savedRecipes: zodFilteredArray(zSavedRecipe).parse(savedRecipes),
	} as const)
}

const schema = z.discriminatedUnion('_action', [
	z.object({
		_action: z.literal('ADD'),
		recipeUrl: z.string({ required_error: 'Recipe URL is required' }),
		recipeData: z.preprocess(str => {
			if (typeof str !== 'string') return undefined
			try {
				return JSON.parse(str)
			} catch (error) {
				return undefined
			}
		}, zSavedRecipe),
	}),
	z.object({
		_action: z.literal('DELETE'),
		recipeKey: z.string({ required_error: 'Recipe key is required' }),
	}),
])

export async function clientAction({ request }: ClientActionFunctionArgs) {
	const formData = await request.formData()
	const submission = parseWithZod(formData, { schema })
	if (submission.status !== 'success') {
		return submission.reply()
	}

	const _action = submission.value._action
	if (_action === 'ADD') {
		const { recipeUrl, recipeData } = submission.value
		const key = getRecipeKey(recipeUrl)
		await localforage.setItem(key, recipeData)
		return redirect(`/recipe/${key}`)
	} else if (_action === 'DELETE') {
		const { recipeKey } = submission.value
		await localforage.removeItem(recipeKey)
		return null
	} else {
		throw new Error(`Invalid _action: '${_action}'`)
	}
}

export function HydrateFallback() {
	return null
}

export default function Index() {
	const { savedRecipes } = useLoaderData<typeof clientLoader>()
	const recipeFetcher = useFetcher<typeof recipeLoader>()
	const submit = useSubmit()

	return (
		<div className="container flex max-w-xl flex-col gap-12 pt-6">
			<div className="flex flex-col gap-3">
				<h2 className="text-xl">Recipes</h2>
				<ul className="flex flex-col gap-2">
					{savedRecipes.map(({ recipe, organization }) => (
						<li key={recipe.url}>
							<Button
								variant="outline"
								asChild
								className="relative grid h-auto w-full grid-cols-[1fr,min-content] items-start gap-4 text-wrap p-4 text-slate-600 hover:bg-stone-100"
							>
								<div>
									<Link
										to={`/recipe/${getRecipeKey(recipe.url)}`}
										className="after:absolute after:inset-0 after:h-full after:w-full"
									>
										<div className="flex flex-col">
											<div className="font-medium text-slate-900">
												{recipe.name}
											</div>
											<div className="text-xs font-normal text-slate-400">
												{organization.name}
											</div>
										</div>

										<div className="line-clamp-2 text-xs font-normal text-slate-500">
											{recipe.description}
										</div>
									</Link>

									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												className="z-10 hover:bg-stone-200/50"
											>
												<DotsHorizontalIcon />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent>
											<DropdownMenuItem
												onSelect={() =>
													submit(
														{
															recipeKey: getRecipeKey(recipe.url),
															_action: 'DELETE',
														},
														{ method: 'POST' },
													)
												}
												className="text-red-600 focus:bg-red-100 focus:text-red-600"
											>
												Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							</Button>
						</li>
					))}
				</ul>

				{/* <AddNewRecipe /> */}
			</div>

			<recipeFetcher.Form method="GET" action="/resources/recipe">
				<Label>
					Recipe URL:
					<Input type="text" name="recipeUrl" />
				</Label>
			</recipeFetcher.Form>

			{recipeFetcher.data ? (
				<div className="flex flex-col gap-4">
					<RecipeCard
						recipe={recipeFetcher.data.recipe}
						organization={recipeFetcher.data.organization}
					/>
					<Form method="POST">
						<input
							type="hidden"
							name="recipeUrl"
							value={recipeFetcher.data.recipe.url}
						/>
						<input
							type="hidden"
							name="recipeData"
							value={JSON.stringify(recipeFetcher.data)}
						/>
						<Button
							size="lg"
							type="submit"
							className="w-full"
							name="_action"
							value="ADD"
						>
							Save
						</Button>
					</Form>
				</div>
			) : null}
		</div>
	)
}

function AddNewRecipe() {
	const [open, setOpen] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)

	return (
		<div className="flex gap-1">
			<Input
				ref={inputRef}
				placeholder="https://www.example.com/recipe"
				className={`flex-1 transition-all duration-200 ease-in-out ${!open ? 'w-0 opacity-0' : 'w-full opacity-100'}`}
			/>
			<Button
				onClick={() => {
					setOpen(true)
					inputRef.current?.focus()
				}}
				className={`transition-all duration-200 ease-in-out ${open ? 'flex-shrink' : 'w-full'}`}
			>
				{open ? 'Fetch recipe' : 'Add new recipe'}
			</Button>
		</div>
	)
}
