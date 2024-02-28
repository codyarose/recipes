import { Fragment } from 'react'
import { Form, Link, useFetcher, useSubmit } from '@remix-run/react'
import {
	ClockIcon,
	DotsHorizontalIcon,
	ExternalLinkIcon,
	TrashIcon,
} from '@radix-ui/react-icons'
import { Button } from '~/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Separator } from '~/components/ui/separator'
import { Organization } from '~/services/idb/organization'
import { Recipe } from '~/services/idb/recipe'
import { RecipeProgress } from '~/services/idb/recipe-progress'
import { clientAction } from './route'

export function RecipeLayout({
	tabId,
	recipe,
	organization,
	progress,
}: {
	tabId: string
	recipe: Recipe.Info
	organization: Organization.Info | null
	progress: RecipeProgress.Info | null
}) {
	const submit = useSubmit()
	const fetcher = useFetcher<typeof clientAction>()
	const recipeTimes = [
		recipe.prepTime ? { label: 'Prep Time', value: recipe.prepTime } : null,
		recipe.cookTime ? { label: 'Cook Time', value: recipe.cookTime } : null,
		recipe.totalTime ? { label: 'Total Time', value: recipe.totalTime } : null,
	].filter(Boolean)

	return (
		<div className="mx-auto w-full max-w-prose px-3 pb-20 pt-4 text-sm text-slate-950 md:text-base">
			<div className="flex flex-col px-2">
				<div className="grid grid-cols-[1fr_min-content] items-start">
					<h1 className="text-balance font-serif text-3xl font-semibold leading-tight md:text-5xl">
						{recipe.name}
					</h1>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								size="icon"
								variant="ghost"
								className="h-5 text-slate-950 transition-colors hover:bg-slate-200/40 focus-visible:ring-slate-700/50 aria-expanded:bg-slate-200/80"
							>
								<DotsHorizontalIcon width={20} height={20} />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent collisionPadding={12} align="end">
							<DropdownMenuItem
								className="flex items-center gap-1 focus:bg-red-100"
								onSelect={() =>
									submit(
										{ _action: 'delete-recipe', recipeId: recipe.id },
										{ method: 'POST' },
									)
								}
							>
								<TrashIcon />
								Delete Recipe
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{organization ? (
					<Link
						to={recipe.sourceUrl}
						target="_blank"
						className="mt-2 flex items-baseline gap-1 self-start text-sm hover:underline"
					>
						{organization.name}
						<ExternalLinkIcon width={12} height={12} />
					</Link>
				) : null}

				<p className="mt-6 text-pretty">{recipe.description}</p>
			</div>

			<div className="my-7 aspect-video overflow-hidden">
				<img
					src={recipe.thumbnailUrl}
					alt={recipe.name}
					className="h-full w-full rounded-sm object-cover object-center"
				/>
			</div>

			<div className="flex justify-between px-2">
				{recipeTimes.map((time, index, arr) => (
					<Fragment key={time?.label}>
						<div className="flex flex-col items-center">
							<span className="font-serif font-semibold md:text-lg">
								{time?.label}
							</span>
							<div className="flex items-center gap-1">
								<ClockIcon />
								{time?.value.label}
							</div>
						</div>
						{arr.length - 1 !== index ? (
							<Separator
								orientation="vertical"
								className="h-auto bg-slate-950/20"
							/>
						) : null}
					</Fragment>
				))}
			</div>

			<div className="mt-7 flex flex-col gap-4 px-2">
				<h2 className="font-serif text-xl font-semibold md:text-3xl">
					Ingredients
				</h2>
				<Form key={tabId + recipe.id} method="POST">
					<input type="hidden" name="_action" value="update-progress" />
					<input type="hidden" name="recipeId" defaultValue={recipe.id} />
					<ul className="flex list-disc flex-col gap-1 pl-5">
						{recipe.ingredients.map((ingredient, index) => (
							<li
								key={index}
								className="rounded-md border-slate-950/15 transition-colors marker:text-slate-800/80 hover:bg-slate-100 has-[:checked]:bg-slate-200/80 has-[:focus-visible]:bg-slate-100 has-[:checked]:line-through has-[:checked]:decoration-slate-950/50 has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-slate-500 hover:has-[:checked]:bg-slate-100"
							>
								<label className="relative block py-2 pl-1.5">
									<p className="text-pretty">{ingredient}</p>
									<input
										type="checkbox"
										name="checkedIngredients"
										id={`ingredient-${index}`}
										value={index}
										defaultChecked={progress?.checkedIngredients.includes(
											index,
										)}
										onChange={event => {
											fetcher.submit(event.currentTarget.form, {
												method: 'POST',
												action: '/recipes/$tabId',
											})
										}}
										className="sr-only"
									/>
								</label>
							</li>
						))}
					</ul>
					{/* <button
						type="button"
						onClick={event => {
							if (!event.currentTarget.form) return
							const formData = new FormData(event.currentTarget.form)
							formData.set('checkedIngredients', 'RESET')
							fetcher.submit(formData, {
								method: 'POST',
								action: '/recipes/$tabId',
							})
						}}
					>
						Reset
					</button> */}
				</Form>
			</div>

			<div className="mt-7 flex flex-col gap-4 px-2">
				<h2 className="font-serif text-xl font-semibold md:text-3xl">
					Instructions
				</h2>
				<Form key={tabId + recipe.id} method="POST">
					<input type="hidden" name="_action" value="update-progress" />
					<input type="hidden" name="recipeId" defaultValue={recipe.id} />
					<ol className="flex list-decimal flex-col gap-1 pl-5 text-base">
						{recipe.instructions.map((step, index, arr) => (
							<Fragment key={index}>
								<li className="group relative rounded-md px-1.5 py-1 transition-all marker:text-slate-800/80 hover:bg-slate-100 focus:bg-blue-500 has-[:checked]:bg-slate-200 has-[focus-within]:bg-red-500 has-[:checked]:shadow-md">
									<label className="relative z-[1]">
										<p className="text-pretty">{step.text}</p>
										<input
											type="radio"
											name="currentStep"
											id={`step-${index}`}
											value={index}
											defaultChecked={progress?.currentStep === index}
											className="sr-only"
											onChange={event => {
												fetcher.submit(event.currentTarget.form, {
													method: 'POST',
													action: `/recipes/$tabId`,
												})
											}}
										/>
									</label>
									<div className="pointer-events-none absolute inset-[1px] rounded-[5px] transition-colors group-has-[:checked]:bg-white/10" />
								</li>
								{index === arr.length - 1 ? null : (
									<Separator
										orientation="horizontal"
										className="z-[1] bg-slate-200"
									/>
								)}
							</Fragment>
						))}
					</ol>
				</Form>
			</div>
		</div>
	)
}
