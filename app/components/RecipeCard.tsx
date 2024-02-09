import { z } from 'zod'
import { zSavedRecipe } from '~/schema'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '~/components/ui/card'
import { Separator } from '~/components/ui/separator'
import { Fragment } from 'react'
import { Link } from '@remix-run/react'

export function RecipeCard({
	recipe,
	organization,
}: z.infer<typeof zSavedRecipe>) {
	return (
		<Card>
			<CardHeader>
				{organization.url ? (
					<Link
						to={organization.url}
						target="_blank"
						className="text-muted-foreground text-sm hover:underline"
					>
						{organization.name}
					</Link>
				) : null}
				<CardTitle>{recipe.name}</CardTitle>
				<CardDescription className="py-2">{recipe.description}</CardDescription>
				<div className="aspect-video overflow-hidden">
					<img
						src={recipe.thumbnailUrl}
						alt={recipe.name}
						className="h-full w-full object-cover object-center"
					/>
				</div>
			</CardHeader>

			<CardContent className="flex flex-col gap-6">
				<div className="flex flex-col gap-3">
					<h4 className="font-medium">Ingredients</h4>
					<ul className="list-inside list-disc text-sm">
						{recipe.ingredients.map((ingredient, index) => (
							<li key={index}>{ingredient}</li>
						))}
					</ul>
				</div>

				<div className="flex flex-col gap-3">
					<h4 className="font-medium">Instructions</h4>
					<ol className="list-inside list-decimal">
						{recipe.instructions.map((step, index, arr) => (
							<Fragment key={index}>
								<li>{step.text}</li>
								{index + 1 === arr.length ? null : (
									<Separator className="my-2" />
								)}
							</Fragment>
						))}
					</ol>
				</div>
			</CardContent>
			<CardFooter className="flex flex-col items-start">
				<Separator className="mb-3" />
				<Link
					to={recipe.sourceUrl}
					target="_blank"
					className="text-muted-foreground text-sm hover:underline"
				>
					Source
				</Link>
			</CardFooter>
		</Card>
	)
}
