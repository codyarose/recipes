import { z } from 'zod'
import { Database, zodWithDb } from './database'
import { baseStore, id } from './utils'

export * as TabRecipe from './tab-recipe'

export const Info = baseStore.extend({
	tabId: z.string(),
	recipeId: z.string(),
})
export type Info = z.infer<typeof Info>

export const create = zodWithDb(
	Info.omit({ id: true, createdAt: true }),
	async (db, input) => {
		await db.put('tab-recipe', {
			...input,
			id: id(),
			createdAt: Date.now(),
		})
	},
)

export const remove = zodWithDb(Info.shape.id, async (db, input) => {
	await db.delete('tab-recipe', input)
})

export async function list(db: Database) {
	return db.getAll('tab-recipe')
}

export const removeAllFromRecipeId = zodWithDb(
	Info.shape.recipeId,
	async (db, input) => {
		const items = await db.getAllFromIndex('tab-recipe', 'by-recipeId', input)
		for (const item of items) {
			await db.delete('tab-recipe', item.id)
		}
	},
)

export const fromTabId = zodWithDb(
	Info.pick({ tabId: true }),
	async (db, input) => {
		return db.getAllFromIndex('tab-recipe', 'by-tabId', input.tabId)
	},
)

export const fromRecipeId = zodWithDb(
	Info.shape.recipeId,
	async (db, input) => {
		return db.getAllFromIndex('tab-recipe', 'by-recipeId', input)
	},
)
