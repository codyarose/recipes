import { z } from 'zod'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'
import { zSavedRecipe } from '~/schema'

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

const slugify = (text: string) => text.replace(/\s+/g, '-').toLowerCase()

export function formatRecipeId(data: Omit<zSavedRecipe, 'id'>) {
	const organization = slugify(data.organization?.name || '')
	const recipeName = slugify(data.recipe.name)
	return `${organization}-${recipeName}`
}

dayjs.extend(duration)
dayjs.extend(relativeTime)
export function formatISODuration(isoString: string) {
	return dayjs.duration(isoString)
}

export class TimeoutError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'TimeoutError'
	}
}

export async function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number = 5000,
): Promise<T> {
	const controller = new AbortController()
	const id = setTimeout(() => controller.abort(), timeoutMs)
	return Promise.race([
		promise,
		new Promise<T>((_, reject) =>
			controller.signal.addEventListener('abort', () =>
				reject(new TimeoutError('Operation timed out')),
			),
		),
	]).finally(() => clearTimeout(id))
}
