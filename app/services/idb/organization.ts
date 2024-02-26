import { z } from 'zod'
import { Database, zodWithDb } from './database'
import { baseStore, id } from './utils'

export * as Organization from './organization'

export const Info = baseStore.extend({
	name: z.string(),
	url: z.string().nullable(),
})
export type Info = z.infer<typeof Info>

export const create = zodWithDb(
	Info.omit({ id: true, createdAt: true }),
	async (db, input) => {
		const data = {
			...input,
			id: id(),
			createdAt: Date.now(),
		}
		await db.add('organization', data)
		return data
	},
)

export const createIfNotExists = zodWithDb(
	Info.omit({ id: true, createdAt: true }),
	async (db, input) => {
		try {
			const existingOrg = await fromName(db, input.name)
			if (existingOrg) return existingOrg
			return create(db, input)
		} catch (error) {
			console.error('Failed to create organization', error)
			throw error
		}
	},
)

export const remove = zodWithDb(Info.shape.id, async (db, input) => {
	await db.delete('organization', input)
})

export async function list(db: Database, count?: number) {
	return db.getAll('organization', undefined, count)
}

export const fromId = zodWithDb(Info.shape.id, async (db, input) => {
	return db.get('organization', input)
})

export const fromName = zodWithDb(Info.shape.name, async (db, input) => {
	return db.getFromIndex('organization', 'by-name', input)
})
