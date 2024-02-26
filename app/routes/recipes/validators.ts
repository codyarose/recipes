import { z } from 'zod'

export const actionSchema = z.discriminatedUnion('_action', [
	z.object({
		_action: z.literal('add-recipe'),
		recipeUrl: z.string().url({ message: 'Invalid recipe URL' }),
	}),
	z.object({
		_action: z.literal('add-tab'),
		currentTabId: z.string().nullable(),
		recipeIds: z.preprocess(
			val => JSON.parse(String(val)),
			z.array(z.string()),
		),
	}),
	z.object({
		_action: z.literal('remove-tab'),
		id: z.string(),
		currentTabId: z.string().nullable().catch(null),
	}),
])
