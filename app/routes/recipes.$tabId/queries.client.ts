import { z } from 'zod'
import { Database, zodWithDb } from '~/services/idb/database'
import { Organization } from '~/services/idb/organization'
import { Recipe } from '~/services/idb/recipe'
import { RecipeProgress } from '~/services/idb/recipe-progress'
import { TabRecipe } from '~/services/idb/tab-recipe'
import { zodFilteredArray } from '~/utils/misc'

export const actionSchema = z.discriminatedUnion('_action', [
	z.object({
		_action: z.literal('delete-recipe'),
		recipeId: z.string(),
	}),
	z.object({
		_action: z.literal('update-progress'),
		recipeId: RecipeProgress.Info.shape.recipeId,
		currentStep: RecipeProgress.Info.shape.currentStep.optional(),
		checkedIngredients: z.union([
			z.literal('RESET'),
			RecipeProgress.Info.shape.checkedIngredients.optional(),
		]),
	}),
])

export async function getRecipesWithMetadata(
	db: Database,
	tabRecipes: TabRecipe.Info[],
) {
	const recipeIds = tabRecipes.map(tabRecipe => tabRecipe.recipeId)
	const recipes = await Promise.all(recipeIds.map(id => Recipe.fromId(db, id)))
	const orgMap = await getOrganizationsMap(
		db,
		zodFilteredArray(Recipe.Info)
			.parse(recipes)
			.map(recipe => recipe.orgId),
	)
	const recipeProgress = await getRecipeProgressMap(db, recipeIds)

	return recipes.map(recipe => ({
		recipe: recipe ?? null,
		organization: recipe ? orgMap[recipe.orgId] : null,
		progress: recipe ? recipeProgress[recipe.id] : null,
	}))
}

async function getOrganizationsMap(
	db: Database,
	orgIds: Organization.Info['id'][],
) {
	const uniqueIds = [...new Set(orgIds)]
	const orgs = await Promise.all(
		uniqueIds.map(id => Organization.fromId(db, id)),
	)
	return orgs.reduce<Record<string, Organization.Info>>((acc, org) => {
		// Create a map of organization ids to organization info
		if (org) {
			acc[org.id] = org
		}
		return acc
	}, {})
}

async function getRecipeProgressMap(
	db: Database,
	recipeIds: Recipe.Info['id'][],
) {
	const progress = await Promise.all(
		recipeIds.map(id => RecipeProgress.fromRecipeId(db, id)),
	)
	return progress.reduce<Record<string, RecipeProgress.Info>>(
		(acc, progress) => {
			// Create a map of recipe ids to recipe progress info
			if (progress) {
				acc[progress.recipeId] = progress
			}
			return acc
		},
		{},
	)
}

export const deleteRecipe = zodWithDb(
	z.object({
		recipeId: z.string(),
		currentTabId: z.string(),
	}),
	async (db, input) => {
		const tx = db.transaction(['recipe', 'tab-recipe', 'tab'], 'readwrite')
		const recipeStore = tx.objectStore('recipe')
		const tabRecipeStore = tx.objectStore('tab-recipe')
		const tabStore = tx.objectStore('tab')

		await recipeStore.delete(input.recipeId) // Remove the recipe from the recipe store
		for await (const cursor of tabRecipeStore // Remove the recipe from the tab-recipe store
			.index('by-recipeId')
			.iterate(input.recipeId)) {
			await cursor.delete()
		}

		const allTabRecipes = await tabRecipeStore.getAll()
		const referencedTabIds = new Set(
			allTabRecipes.map(tabRecipe => tabRecipe.tabId),
		)

		const unreferencedTabIds = []
		for await (const cursor of tabStore.iterate()) {
			// Remove any tabs that are no longer referenced by a tab-recipe
			const cursorTabId = cursor.value.id
			if (!referencedTabIds.has(cursorTabId)) {
				await cursor.delete()
				unreferencedTabIds.push(cursorTabId)
			}
		}

		if (unreferencedTabIds.includes(input.currentTabId)) {
			let lastVisitedTabId: string | null = null
			for await (const cursor of tabStore
				.index('last-visited')
				.iterate(null, 'prev')) {
				if (cursor) {
					lastVisitedTabId = cursor.value.id
					break
				}
			}
			await tx.done
			return { lastVisitedTabId }
		}
		await tx.done
		return null
	},
)
