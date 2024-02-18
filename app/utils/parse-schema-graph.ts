import { Duration } from 'dayjs/plugin/duration'
import { decode } from 'html-entities'
import {
	findArticle,
	findOrganization,
	findRecipe,
	zGraph,
	zSavedRecipe,
} from '~/schema'
import { formatISODuration } from '~/utils/misc'

export async function checkUrl(url: string) {
	try {
		const response = await fetch(url, { method: 'HEAD' })
		return response.ok
	} catch (error) {
		console.error('Error checking URL:', error)
		return false
	}
}

interface Parser {
	setup(htmlRewriter: HTMLRewriter): HTMLRewriter
	getResult(): string | null
}

async function parseResponse<T extends { [keys in string]: Parser }>(
	response: Response,
	config: T,
): Promise<Record<keyof T, string | null>> {
	let htmlRewriter = new HTMLRewriter()

	for (const parser of Object.values(config)) {
		htmlRewriter = parser.setup(htmlRewriter)
	}

	let res = htmlRewriter.transform(response)

	await res.arrayBuffer()

	return Object.fromEntries(
		Object.entries(config).map(([key, parser]) => [key, parser.getResult()]),
	) as Record<keyof T, string | null>
}

function mergeParsers(...parsers: Parser[]): Parser {
	return {
		setup(htmlRewriter: HTMLRewriter): HTMLRewriter {
			return parsers.reduce(
				(rewriter, parser) => parser.setup(rewriter),
				htmlRewriter,
			)
		},
		getResult() {
			let result: string | null = null

			for (let parser of parsers) {
				result = parser.getResult()

				if (result !== null) {
					break
				}
			}

			return result
		},
	}
}

function createTextParser(selector: string): Parser {
	let text: string | null = null
	return {
		setup(htmlRewriter: HTMLRewriter): HTMLRewriter {
			return htmlRewriter.on(selector, {
				text(element) {
					text = (text ?? '') + element.text
				},
			})
		},
		getResult() {
			return text ? decode(text) : null
		},
	}
}

export async function getRecipeFromUrl(url: string) {
	const response = await fetch(url)
	if (!response.ok) {
		throw new Response('Failed to fetch recipe', {
			status: 404,
			statusText: 'Failed to fetch recipe',
		})
	}
	const page = await parseResponse(response, {
		script: mergeParsers(
			createTextParser('script[type="application/ld+json"]'),
		),
	})

	const schema = zGraph.safeParse(JSON.parse(page.script ?? 'null'))
	if (!schema.success) {
		throw new Response('Invalid JSON-LD', { status: 400 })
	}
	const recipe = findRecipe(schema.data)
	const article = findArticle(schema.data)
	const organization = findOrganization(schema.data)
	if (!recipe) {
		throw new Response('No recipe found', { status: 404 })
	}

	return zSavedRecipe.omit({ id: true }).parse({
		recipe: {
			url,
			thumbnailUrl: article?.thumbnailUrl ?? '',
			name: recipe.name,
			description: recipe.description,
			ingredients: recipe.recipeIngredient,
			instructions: recipe.recipeInstructions,
			yield: recipe.recipeYield,
			prepTime: formatDuration(recipe.prepTime),
			cookTime: formatDuration(recipe.cookTime),
			totalTime: formatDuration(recipe.totalTime),
			sourceUrl: recipe['@id'],
		},
		organization: {
			name: organization?.name ?? null,
			url: organization?.url ?? null,
		},
	})
}

function formatDuration(isoString: string | undefined) {
	if (!isoString) return null
	const duration = formatISODuration(isoString)
	return {
		label: formatDurationLabel(duration),
		duration: duration.asSeconds(),
	}
}

function formatDurationLabel(duration: Duration) {
	const totalMinutes = duration.asMinutes()
	const hours = Math.floor(totalMinutes / 60)
	const minutes = totalMinutes % 60
	const parts = [
		hours > 0 ? `${hours} hr${hours > 1 ? 's' : ''}` : '',
		minutes > 0 ? `${minutes} min${minutes > 1 ? 's' : ''}` : '',
	].filter(part => part !== '')

	return parts.join(' ')
}
