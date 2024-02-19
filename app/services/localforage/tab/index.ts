export * as Tab from './'

import localforage from 'localforage'
import { z } from 'zod'
import { zod } from '~/utils/misc'

const tabStore = localforage.createInstance({ name: 'tab' })
export const Info = z.object({
	id: z.string(),
	path: z.string(),
	lastVisitedTimestamp: z.number(),
})
export type Info = z.infer<typeof Info>

export const create = zod(
	Info.omit({ lastVisitedTimestamp: true }),
	async input => {
		await tabStore.setItem(input.id, {
			...input,
			lastVisitedTimestamp: Date.now(),
		})
		return input
	},
)

export const remove = zod(Info.shape.id, async id => {
	await tabStore.removeItem(id)
	return id
})

export const updateLastVisitedTimestamp = zod(Info.shape.id, async id => {
	const item = await fromId(id)
	if (!item) {
		console.error(`Tab with id ${id} not found`)
		return
	}

	await tabStore.setItem(id, {
		...item,
		lastVisitedTimestamp: Date.now(),
	})
})

export async function list() {
	const items: Info[] = []
	await tabStore.iterate<Info, void>(value => {
		items.push(value)
	})
	return items
}

export const fromId = zod(Info.shape.id, async id => {
	return tabStore.getItem<Info>(id)
})
