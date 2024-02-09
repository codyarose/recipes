import { z } from 'zod'

export function getErrorMessage(error: unknown) {
	if (typeof error === 'string') return error
	if (
		error &&
		typeof error === 'object' &&
		'message' in error &&
		typeof error.message === 'string'
	) {
		return error.message
	}
	console.error('Unable to get error message for error', error)
	return 'Unknown Error'
}

export function zodFilteredArray<Schema>(schema: z.ZodType<Schema, any, any>) {
	const catchValue = {} as never
	return z
		.array(schema.catch(catchValue))
		.transform(arr => arr.filter(el => el !== catchValue))
		.catch([])
}

export function getRecipeKey(url: string) {
	const { hostname, pathname } = new URL(url)
	return `${hostname.replace(/\./g, '-')}-${pathname.replace(/\//g, '')}`.toLowerCase()
}
