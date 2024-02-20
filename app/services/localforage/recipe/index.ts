import localforage from 'localforage'
import { z } from 'zod'
import { zSavedRecipe } from '~/schema'
import { formatRecipeId, zod } from '~/utils/misc'

export * as Recipe from './'

const recipeStore = localforage.createInstance({ name: 'recipe' })
export const Info = zSavedRecipe
export type Info = z.infer<typeof Info>

export const create = zod(
	Info.pick({ id: true, recipe: true, organization: true }).partial({
		id: true,
	}),
	async input => {
		const id = input.id ?? formatRecipeId(input)
		await recipeStore.setItem(id, { id, ...input })
		return id
	},
)

export const remove = zod(Info.shape.id, async id => {
	await recipeStore.removeItem(id)
	return id
})

export async function list() {
	const items: Info[] = []
	await recipeStore.iterate<Info, void>(value => {
		items.push(value)
	})
	return items
}

export const fromId = zod(Info.shape.id, async id => {
	return recipeStore.getItem<Info>(id)
})
