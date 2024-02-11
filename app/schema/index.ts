import { z } from 'zod'
import { zodFilteredArray } from '~/utils/misc'

const zPerson = z
	.object({
		'@type': z.literal('Person'),
		name: z.string(),
	})
	.passthrough()

const zHowToStep = z.object({
	'@type': z.literal('HowToStep'),
	text: z.string(),
	url: z.string().url(),
})

const zOrganization = z.object({
	'@type': z.literal('Organization'),
	'@id': z.string(),
	name: z.string(),
	url: z.string().url(),
})
export type zOrganization = z.infer<typeof zOrganization>

export const zArticle = z
	.object({
		'@type': z.literal('Article'),
		'@id': z.string().url(),
		thumbnailUrl: z.string(),
	})
	.passthrough()
export type zArticle = z.infer<typeof zArticle>

export const zRecipe = z
	.object({
		'@type': z.literal('Recipe'),
		'@id': z.string(),
		name: z.string(),
		description: z.string(),
		datePublished: z.coerce.date(),
		image: z.array(z.string().url()),
		recipeIngredient: zodFilteredArray(z.string()),
		recipeInstructions: zodFilteredArray(zHowToStep),
	})
	.passthrough()
export type zRecipe = z.infer<typeof zRecipe>

export const zGraph = z
	.object({
		'@context': z.string(),
		'@graph': zodFilteredArray(
			z.discriminatedUnion('@type', [zRecipe, zArticle, zOrganization]),
		),
	})
	.passthrough()

export function findRecipe(graph: z.infer<typeof zGraph> | null) {
	return graph?.['@graph'].find(
		(item): item is zRecipe => item['@type'] === 'Recipe',
	)
}
export function findArticle(graph: z.infer<typeof zGraph> | null) {
	return graph?.['@graph'].find(
		(item): item is zArticle => item['@type'] === 'Article',
	)
}
export function findOrganization(graph: z.infer<typeof zGraph> | null) {
	return graph?.['@graph'].find(
		(item): item is zOrganization => item['@type'] === 'Organization',
	)
}

export const zSavedRecipe = z.object({
	recipe: z.object({
		url: z.string().url(),
		thumbnailUrl: z.string(),
		name: z.string(),
		description: z.string(),
		ingredients: z.array(z.string()),
		instructions: z.array(zHowToStep),
		sourceUrl: z.string().url(),
	}),
	organization: z.object({
		name: z.string().nullable(),
		url: z.string().nullable(),
	}),
})
