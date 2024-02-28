import { z } from 'zod'
import { zodWithDb } from './database'
import { Recipe } from './recipe'

export * as RecipeProgress from './recipe-progress'

export const Info = z.object({
	recipeId: Recipe.Info.shape.id,
	checkedIngredients: z.array(z.number()),
	currentStep: z.number().nullable(),
})
export type Info = z.infer<typeof Info>

export const upsert = zodWithDb(
	Info.partial({ currentStep: true, checkedIngredients: true }).extend({
		checkedIngredients: z
			.union([z.literal('RESET'), z.array(z.number())])
			.optional(),
	}),
	async (db, input) => {
		const existingRecord = await db.getFromIndex(
			'recipe-progress',
			'by-recipeId',
			input.recipeId,
		)

		if (existingRecord) {
			const updatedRecord = {
				recipeId: existingRecord.recipeId,
				currentStep: input.currentStep ?? existingRecord.currentStep,
				checkedIngredients:
					input.checkedIngredients === 'RESET'
						? []
						: input.checkedIngredients ?? existingRecord.checkedIngredients,
			}
			await db.put('recipe-progress', updatedRecord)
			return updatedRecord
		} else {
			const newRecord = {
				...input,
				checkedIngredients:
					input.checkedIngredients === 'RESET'
						? []
						: input.checkedIngredients ?? [],
				currentStep: input.currentStep ?? null,
			}
			await db.put('recipe-progress', newRecord)
			return newRecord
		}
	},
)

export const fromRecipeId = zodWithDb(
	Info.shape.recipeId,
	async (db, input) => {
		return db.getFromIndex('recipe-progress', 'by-recipeId', input)
	},
)
