import { IDBPTransaction } from 'idb'
import { Database, DB, zodWithDb, zodWithTx } from '~/services/idb/database'
import { Organization } from '~/services/idb/organization'
import { Recipe } from '~/services/idb/recipe'
import { Tab } from '~/services/idb/tab'
import { TabRecipe } from '~/services/idb/tab-recipe'
import { id } from '~/services/idb/utils'

export async function collateTabs(db: Database, recipes: Recipe.Info[]) {
	const tx = db.transaction(['tab', 'tab-recipe'], 'readonly')
	const tabStore = tx.objectStore('tab')
	const tabRecipeStore = tx.objectStore('tab-recipe')

	const allTabs = await tabStore.getAll()
	const tabsWithItemsPromise = allTabs.map(async tab => {
		const tabRecipes = await tabRecipeStore.index('by-tabId').getAll(tab.id)
		return {
			...tab,
			items: tabRecipes.map(tabRecipe => ({
				recipeId: tabRecipe.recipeId,
				name:
					recipes.find(recipe => recipe.id === tabRecipe.recipeId)?.name ??
					'Unknown',
			})),
		}
	})

	const tabsWithItems = await Promise.all(tabsWithItemsPromise)

	await tx.done

	return tabsWithItems
}

export async function addRecipe(
	db: Database,
	data: {
		recipe: Omit<Recipe.Info, 'id' | 'createdAt' | 'orgId'>
		organization: {
			name: Organization.Info['name'] | null
			url: Organization.Info['url'] | null
		}
	},
) {
	const tx = db.transaction(
		['organization', 'recipe', 'tab', 'tab-recipe'],
		'readwrite',
	)
	const tabStore = tx.objectStore('tab')
	const tabRecipeStore = tx.objectStore('tab-recipe')

	const orgId = await orgCreateIfNotExists(tx, {
		name: data.organization.name ?? 'Unknown',
		url: data.organization.url ?? null,
	})
	const recipeId = await recipeCreateIfNotExists(tx, {
		...data.recipe,
		orgId,
	})
	const tabId = await tabStore.add({
		id: id(),
		createdAt: Date.now(),
		lastVisited: Date.now(),
	})
	await tabRecipeStore.add({
		id: id(),
		createdAt: Date.now(),
		tabId,
		recipeId,
	})

	return tabId
}

type Tx = IDBPTransaction<
	DB,
	('recipe' | 'organization' | 'tab' | 'tab-recipe')[],
	'readwrite'
>

const orgCreateIfNotExists = zodWithTx(
	Organization.Info.pick({ name: true, url: true }),
	async (tx: Tx, input) => {
		const orgStore = tx.objectStore('organization')
		try {
			const existingOrg = await orgStore.index('by-name').get(input.name)
			if (existingOrg) return existingOrg.id

			return orgStore.add({ ...input, id: id(), createdAt: Date.now() })
		} catch (error) {
			console.error('Failed to create organization', error)
			throw error
		}
	},
)

const recipeCreateIfNotExists = zodWithTx(
	Recipe.Info.omit({ id: true, createdAt: true }),
	async (tx: Tx, input) => {
		const recipeStore = tx.objectStore('recipe')
		try {
			const existingRecipe = await recipeStore.index('by-url').get(input.url)
			if (existingRecipe) return existingRecipe.id

			return recipeStore.add({ ...input, id: id(), createdAt: Date.now() })
		} catch (error) {
			console.error('Failed to create recipe', error)
			throw error
		}
	},
)

export async function addTab(
	db: Database,
	input: {
		currentTabId: string | null
		recipeIds: string[]
	},
) {
	if (input.currentTabId && input.recipeIds.length > 1) {
		const tabId = input.currentTabId
		const [_currentRecipe, ...rest] = input.recipeIds
		await Promise.all(
			rest.map(id => TabRecipe.create(db, { tabId, recipeId: id })),
		)
		return tabId
	}

	const tabId = await Tab.create(db)
	await Promise.all(
		input.recipeIds.map(id => TabRecipe.create(db, { tabId, recipeId: id })),
	)

	return tabId
}

export const removeTab = zodWithDb(
	Tab.Info.pick({ id: true }),
	async (db, input) => {
		const tx = db.transaction(['tab', 'tab-recipe'], 'readwrite')
		const tabStore = tx.objectStore('tab')
		const tabRecipeStore = tx.objectStore('tab-recipe')

		const tab = await tabStore.get(input.id)
		if (!tab) return

		await tabStore.delete(input.id)
		for await (const cursor of tabRecipeStore
			.index('by-tabId')
			.iterate(input.id)) {
			await cursor.delete()
		}
		await tx.done
	},
)
