import { json, redirect } from '@remix-run/cloudflare'
import {
	ClientActionFunctionArgs,
	ClientLoaderFunctionArgs,
	Link,
	useLoaderData,
	useSubmit,
} from '@remix-run/react'
import { z } from 'zod'
import { Button } from '~/components/ui/button'
import localforage from 'localforage'
import { formatRecipeId, zodFilteredArray } from '~/utils/misc'
import { zSavedRecipe } from '~/schema'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { parseWithZod } from '@conform-to/zod'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'

export async function loader() {
	return redirect('/recipes')
}

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

const schema = z.discriminatedUnion('_action', [
	z.object({
		_action: z.literal('ADD'),
		recipeData: z.preprocess(
			str => {
				if (typeof str !== 'string') return undefined
				try {
					return JSON.parse(str)
				} catch (error) {
					return undefined
				}
			},
			zSavedRecipe.omit({ id: true }),
		),
	}),
	z.object({
		_action: z.literal('DELETE'),
		recipeId: z.string({ required_error: 'Recipe id is required' }),
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
		const { recipeData } = submission.value
		const id = formatRecipeId(recipeData)
		await localforage.setItem(id, { id, ...recipeData })
		return redirect(`/recipes/${id}`)
	} else if (_action === 'DELETE') {
		const { recipeId } = submission.value
		await localforage.removeItem(recipeId)
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
	const submit = useSubmit()

	return (
		<div className="container flex flex-col gap-12 pt-6">
			<div className="flex flex-col gap-3">
				<h2 className="text-xl">Recipes</h2>
				<ul className="flex flex-col gap-2">
					{savedRecipes.map(({ id, recipe, organization }) => (
						<li key={recipe.url}>
							<Button
								variant="outline"
								asChild
								className="relative grid h-auto w-full grid-cols-[1fr,min-content] items-start gap-4 text-wrap p-4 text-slate-600 hover:bg-stone-100"
							>
								<div>
									<Link
										to={`/recipes/${id}`}
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
															recipeId: id,
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
			</div>
		</div>
	)
}
