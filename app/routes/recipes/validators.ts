import { z } from 'zod'

export const actionSchema = z.discriminatedUnion('_action', [
	z.object({
		_action: z.literal('add-recipe'),
		recipeUrl: z.string().url({ message: 'Invalid recipe URL' }),
	}),
	z.object({
		_action: z.literal('add-tab'),
		id: z.string(),
	}),
	z.object({
		_action: z.literal('remove-tab'),
		id: z.string(),
		currentTabId: z.string().nullable(),
	}),
])
