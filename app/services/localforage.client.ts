import localforage from 'localforage'

export const recipeStore = localforage.createInstance({ name: 'recipe' })
export const tabStore = localforage.createInstance({ name: 'tab' })
