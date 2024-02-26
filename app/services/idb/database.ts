import type { DBSchema } from 'idb'
import { openDB } from 'idb'
import { z } from 'zod'
import { Organization } from './organization'
import { Recipe } from './recipe'
import { Tab } from './tab'
import { TabRecipe } from './tab-recipe'

interface DB extends DBSchema {
	organization: {
		key: string
		value: Organization.Info
		indexes: {
			'by-name': string
		}
	}
	recipe: {
		key: string
		value: Recipe.Info
		indexes: {
			'by-orgId': string
			'by-url': string
		}
	}
	tab: {
		key: string
		value: Tab.Info
		indexes: {
			'last-visited': number
		}
	}
	['tab-recipe']: {
		key: string
		value: TabRecipe.Info
		indexes: {
			'by-tabId': string
			'by-recipeId': string
		}
	}
}

export const database = async () =>
	openDB<DB>('Database', 1, {
		upgrade(db) {
			// Organization
			const orgStore = db.createObjectStore('organization', {
				keyPath: 'id',
			})
			orgStore.createIndex('by-name', 'name', { unique: true })

			// Recipe
			const recipeStore = db.createObjectStore('recipe', {
				keyPath: 'id',
			})
			recipeStore.createIndex('by-orgId', 'orgId', { unique: false })
			recipeStore.createIndex('by-url', 'url', { unique: true })

			// Tab
			const tabStore = db.createObjectStore('tab', {
				keyPath: 'id',
			})
			tabStore.createIndex('last-visited', 'lastVisited', { unique: false })

			// TabRecipe
			const tabRecipeStore = db.createObjectStore('tab-recipe', {
				keyPath: 'id',
			})
			tabRecipeStore.createIndex('by-tabId', 'tabId', { unique: false })
			tabRecipeStore.createIndex('by-recipeId', 'recipeId', { unique: false })
		},
	})

export type Database = Awaited<ReturnType<typeof database>>

export function zodWithDb<
	Db extends Database,
	Schema extends z.ZodSchema<any, any, any>,
	Return extends any,
>(schema: Schema, func: (db: Db, value: z.infer<Schema>) => Return) {
	const result = (db: Db, input: z.infer<Schema>) => {
		const parsed = schema.parse(input)
		return func(db, parsed)
	}
	result.schema = schema
	return result
}
