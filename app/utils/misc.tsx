import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'
import { z } from 'zod'
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
	return `${organization}-${recipeName}`.replace(/[^a-zA-Z0-9-_]/g, '')
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

const getInitialState = (query: string, defaultState?: boolean) => {
	// Prevent a React hydration mismatch when a default value is provided by not defaulting to window.matchMedia(query).matches.
	if (defaultState !== undefined) {
		return defaultState
	}

	if (typeof window !== 'undefined') {
		return window.matchMedia(query).matches
	}

	// A default value has not been provided, and you are rendering on the server, warn of a possible hydration mismatch when defaulting to false.
	if (process.env.NODE_ENV !== 'production') {
		console.warn(
			'`useMedia` When server side rendering, defaultState should be defined to prevent a hydration mismatches.',
		)
	}

	return false
}

export const useMedia = (query: string, defaultState?: boolean) => {
	const [state, setState] = useState(getInitialState(query, defaultState))
	useEffect(() => {
		let mounted = true
		const mql = window.matchMedia(query)
		const onChange = () => {
			if (!mounted) {
				return
			}
			setState(!!mql.matches)
		}

		mql.addEventListener('change', onChange)
		setState(mql.matches)

		return () => {
			mounted = false
			mql.removeEventListener('change', onChange)
		}
	}, [query])

	return state
}

export function zod<
	Schema extends z.ZodSchema<any, any, any>,
	Return extends any,
>(schema: Schema, func: (value: z.infer<Schema>) => Return) {
	const result = (input: z.infer<Schema>) => {
		const parsed = schema.parse(input)
		return func(parsed)
	}
	result.schema = schema
	return result
}
