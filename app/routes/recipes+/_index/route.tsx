import { LoaderFunctionArgs, json, redirect } from '@remix-run/cloudflare'
import { ClientActionFunctionArgs, Form, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { checkUrl, getRecipeFromUrl } from './helpers'
import { formatRecipeId, withTimeout } from '~/utils/misc'
import { MagnifyingGlassIcon } from '@radix-ui/react-icons'
import { RecipeCard } from '~/components/RecipeCard'
import { parseWithZod } from '@conform-to/zod'
import localforage from 'localforage'
import { zSavedRecipe } from '~/schema'

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const recipeUrlParam = url.searchParams.get('recipeUrl')
	if (!recipeUrlParam) {
		return json(null)
	}
	const recipeUrl = z
		.string()
		.url({ message: 'Invalid recipe URL' })
		.safeParse(decodeURIComponent(recipeUrlParam))

	if (!recipeUrl.success) {
		throw new Response('Invalid recipe URL', { status: 400 })
	}
	const isWorkingUrl = await withTimeout(checkUrl(recipeUrl.data), 5000)

	if (!isWorkingUrl) {
		throw new Response('Invalid recipe URL', { status: 400 })
	}

	const { recipe, organization } = await getRecipeFromUrl(recipeUrl.data)
	return json({ recipe, organization } as const)
}

const actionSchema = z.discriminatedUnion('_action', [
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
	const submission = parseWithZod(formData, { schema: actionSchema })
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

export default function RecipesIndex() {
	const data = useLoaderData<typeof loader>()

	return (
		<div className="container relative flex flex-col gap-12 pb-12 pt-6">
			<div className="flex flex-col gap-2">
				<Form
					method="GET"
					className="grid grid-cols-[1fr_min-content] grid-rows-2 gap-3"
				>
					<Label htmlFor="recipeUrl" className="col-span-full flex-1">
						<h1 className="text-3xl">Add a new recipe</h1>
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

			{data ? (
				<div className="flex flex-col gap-6">
					<RecipeCard recipe={data.recipe} organization={data.organization} />

					<Form method="POST">
						<input
							type="hidden"
							name="recipeData"
							value={JSON.stringify(data)}
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
