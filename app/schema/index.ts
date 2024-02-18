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

const zNutritionInformation = z.object({
	'@type': z.literal('NutritionInformation'),
	calories: z.string().optional(),
	carbohydrateContent: z.string().optional(),
	cholesterolContent: z.string().optional(),
	fatContent: z.string().optional(),
	fiberContent: z.string().optional(),
	proteinContent: z.string().optional(),
	saturatedFatContent: z.string().optional(),
	servingSize: z.string().optional(),
	sodiumContent: z.string().optional(),
	sugarContent: z.string().optional(),
	transFatContent: z.string().optional(),
	unsaturatedFatContent: z.string().optional(),
})

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
		image: z.array(z.string()),
		recipeIngredient: zodFilteredArray(z.string()),
		recipeInstructions: zodFilteredArray(zHowToStep).catch([]),
		recipeYield: z.array(z.string()),
		recipeCategory: z.union([z.string(), z.array(z.string())]),
		recipeCuisine: z.union([z.string(), z.array(z.string())]).optional(),
		prepTime: z.string().optional(),
		cookTime: z.string().optional(),
		totalTime: z.string().optional(),
		nutrition: zNutritionInformation.optional(),
		keywords: z.string().catch(''),
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
	id: z.string(),
	recipe: z.object({
		url: z.string().url(),
		thumbnailUrl: z.string(),
		name: z.string(),
		description: z.string(),
		ingredients: z.array(z.string()),
		instructions: z.array(zHowToStep),
		sourceUrl: z.string().url(),
		yield: z.array(z.string()),
		prepTime: z.object({
			label: z.string(),
			duration: z.number(),
		}),
		cookTime: z.object({
			label: z.string(),
			duration: z.number(),
		}),
		totalTime: z.object({
			label: z.string(),
			duration: z.number(),
		}),
	}),
	organization: z.object({
		name: z.string().nullable(),
		url: z.string().nullable(),
	}),
})
export type zSavedRecipe = z.infer<typeof zSavedRecipe>
