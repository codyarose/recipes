import { z } from 'zod'
import { Database, zodWithDb } from './database'
import { Organization } from './organization'
import { baseStore, id } from './utils'

export * as Recipe from './recipe'

const zHowToStep = z.object({
	'@type': z.literal('HowToStep'),
	text: z.string(),
	url: z.string().url(),
})
const zTime = z.object({
	label: z.string(),
	duration: z.number(),
})
export const Info = baseStore.extend({
	orgId: Organization.Info.shape.id,
	url: z.string().url(),
	thumbnailUrl: z.string(),
	name: z.string(),
	description: z.string(),
	ingredients: z.array(z.string()),
	instructions: z.array(zHowToStep),
	sourceUrl: z.string().url(),
	yield: z.array(z.string()),
	prepTime: zTime,
	cookTime: zTime,
	totalTime: zTime,
})
export type Info = z.infer<typeof Info>

export const create = zodWithDb(
	Info.omit({ id: true, createdAt: true }),
	async (db, input) => {
		const data = { ...input, id: id(), createdAt: Date.now() }
		await db.add('recipe', data)
		return data
	},
)

export const createIfNotExists = zodWithDb(
	Info.omit({ id: true, createdAt: true }),
	async (db, input) => {
		const existingRecipe = await fromUrl(db, input.url)
		if (existingRecipe) return existingRecipe
		return create(db, input)
	},
)

export const remove = zodWithDb(Info.shape.id, async (db, input) => {
	await db.delete('recipe', input)
})

export async function list(
	db: Database,
	input: { count?: number } | undefined = undefined,
) {
	return db.getAll('recipe', undefined, input?.count)
}

export const fromId = zodWithDb(Info.shape.id, async (db, input) => {
	return db.get('recipe', input)
})

export const fromUrl = zodWithDb(Info.shape.url, async (db, input) => {
	return db.getFromIndex('recipe', 'by-url', input)
})

export const listFromOrgId = zodWithDb(
	Info.pick({ orgId: true }).extend({ count: z.number().optional() }),
	async (db, input) => {
		return db.getAllFromIndex('recipe', 'by-orgId', input.orgId, input.count)
	},
)
