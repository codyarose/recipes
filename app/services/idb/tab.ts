import { z } from 'zod'
import { Database, zodWithDb } from './database'
import { baseStore, id } from './utils'

export * as Tab from './tab'

export const Info = baseStore.extend({
	lastVisited: z.number(),
})
export type Info = z.infer<typeof Info>

export async function create(db: Database) {
	const tabId = id()
	await db.add('tab', {
		id: tabId,
		createdAt: Date.now(),
		lastVisited: Date.now(),
	})
	return tabId
}

export const remove = zodWithDb(Info.shape.id, async (db, input) => {
	await db.delete('tab', input)
})

export async function list(
	db: Database,
	input: { count?: number } | undefined = undefined,
) {
	return db.getAll('tab', undefined, input?.count)
}

export const fromId = zodWithDb(Info.shape.id, async (db, input) => {
	return db.get('tab', input)
})

export const updateLastVisitedTimestamp = zodWithDb(
	Info.shape.id,
	async (db, input) => {
		const tab = await fromId(db, input)
		if (!tab) {
			console.error(`Tab with id ${id} not found`)
			return
		}
		await db.put('tab', {
			...tab,
			lastVisited: Date.now(),
		})
	},
)

export async function lastVisited(db: Database) {
	const index = db.transaction('tab').store.index('last-visited')

	for await (const cursor of index.iterate(null, 'prev')) {
		if (cursor) {
			return cursor.value
		}
		return null
	}
}

export async function removeAllUnreferenced(db: Database) {
	const allTabRecipes = await db.getAll('tab-recipe')
	const referencedTabIds = new Set(
		allTabRecipes.map(tabRecipe => tabRecipe.tabId),
	)
	let unreferencedTabIds = []
	const tx = db.transaction('tab', 'readwrite')
	const tabStore = tx.store
	for await (const cursor of tabStore.iterate()) {
		const cursorTabId = cursor.value.id
		if (!referencedTabIds.has(cursorTabId)) {
			await cursor.delete() // Delete the current item if it's not in the set
			unreferencedTabIds.push(cursorTabId)
		}
	}
	await tx.done

	return unreferencedTabIds // Return the list of removed tab ids
}
