import { LoaderFunctionArgs, json, redirect } from '@remix-run/cloudflare'
import {
	ClientActionFunctionArgs,
	Form,
	useLoaderData,
	useSearchParams,
} from '@remix-run/react'
import { z } from 'zod'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { checkUrl, getRecipeFromUrl } from './helpers'
import { TimeoutError, formatRecipeId, withTimeout } from '~/utils/misc'
import { MagnifyingGlassIcon } from '@radix-ui/react-icons'
import { RecipeCard } from '~/components/RecipeCard'
import { parseWithZod } from '@conform-to/zod'
import localforage from 'localforage'
import { zSavedRecipe } from '~/schema'
import { tempRecipes } from '~/utils/temp'
import { GeneralErrorBoundary } from '~/components/GeneralErrorBoundary'
import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { ErrorList } from '~/components/ErrorList'

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const submission = parseWithZod(url.searchParams, {
		schema: z.object({
			recipeUrl: z.string().url({ message: 'Invalid recipe URL' }).optional(),
		}),
	})

	if (submission.status !== 'success') {
		return json({ submission: submission.reply(), data: null }, { status: 400 })
	}

	if (!submission.value.recipeUrl) {
		return json({ submission, data: null } as const)
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
		// const { recipe, organization } = tempRecipes[1]
		const { recipe, organization } = await getRecipeFromUrl(
			submission.value.recipeUrl,
		)
		return json({ submission, data: { recipe, organization } } as const)
	} catch (error) {
		if (error instanceof TimeoutError) {
			return json(
				{
					submission: submission.reply({
						fieldErrors: { recipeUrl: ['Unable to fetch recipe from URL'] },
					}),
					data: null,
				},
				{ status: 400 },
			)
		}

		if (error instanceof Response) {
			throw error
		}

		if (error instanceof Error) {
			throw new Response(error.message, { status: 500 })
		}
		console.error('Unknown error', error)
		throw new Response('Unknown error', { status: 500 })
	}
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
	const { data } = useLoaderData<typeof loader>()

	return (
		<div className="container relative flex flex-col gap-4 pb-12 pt-6">
			<div className="flex flex-col gap-2">
				<GetRecipeForm />
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

function GetRecipeForm() {
	const [searchParams] = useSearchParams()
	const lastResult = useLoaderData<typeof loader>()
	const [form, fields] = useForm({
		lastResult: lastResult.submission,
		shouldValidate: 'onSubmit',
		shouldRevalidate: 'onSubmit',
		defaultValue: { recipeUrl: searchParams.get('recipeUrl') ?? '' },
	})

	return (
		<Form
			method="GET"
			action="/recipes?index"
			{...getFormProps(form)}
			className="flex flex-col gap-3"
		>
			<Label htmlFor={fields.recipeUrl.id} className="sr-only">
				Add a new recipe
			</Label>

			<div className="grid grid-cols-[1fr_min-content] gap-x-2">
				<Input
					autoFocus
					{...getInputProps(fields.recipeUrl, { type: 'text' })}
					placeholder="https://example.com/really-good-tacos"
					className="placeholder:text-gray-400"
				/>
				<Button type="submit" className="gap-2">
					<MagnifyingGlassIcon />
					Get recipe
				</Button>
				<div className="col-span-full min-h-8 px-4 pb-2 pt-1">
					{fields.recipeUrl.errors ? (
						<ErrorList
							id={fields.recipeUrl.errorId}
							errors={fields.recipeUrl.errors}
						/>
					) : null}
				</div>
			</div>
		</Form>
	)
}

export function ErrorBoundary() {
	return (
		<div className="container relative flex flex-col gap-4 pb-12 pt-6">
			<Form
				method="GET"
				action="/recipes?index"
				className="flex flex-col gap-3"
			>
				<Label htmlFor="recipeUrl" className="sr-only">
					Add a new recipe
				</Label>

				<div className="grid grid-cols-[1fr_min-content] gap-x-2">
					<Input
						autoFocus
						type="text"
						placeholder="https://example.com/really-good-tacos"
						className="placeholder:text-gray-400"
					/>
					<Button type="submit" className="gap-2">
						<MagnifyingGlassIcon />
						Get recipe
					</Button>
					<div className="col-span-full min-h-8 px-4 pb-2 pt-1" />
				</div>
			</Form>
			<GeneralErrorBoundary />
		</div>
	)
}
