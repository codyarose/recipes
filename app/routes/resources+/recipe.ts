import { LoaderFunctionArgs, json } from '@remix-run/cloudflare'
import { z } from 'zod'
import {
	findArticle,
	findOrganization,
	findRecipe,
	zGraph,
	zSavedRecipe,
} from '~/schema'

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

function createElementParser(selector: string): Parser {
	let content = ''
	return {
		setup(htmlRewriter: HTMLRewriter): HTMLRewriter {
			return htmlRewriter.on(selector, {
				text(text) {
					if (!text.lastInTextNode) content += text.text
				},
			})
		},
		getResult() {
			return content
		},
	}
}

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const recipeUrl = z
		.string()
		.url()
		.safeParse(url.searchParams.get('recipeUrl'))

	if (!recipeUrl.success) {
		throw new Response('Invalid recipe URL', { status: 400 })
	}

	const { recipe, organization } = await getRecipeFromUrl(recipeUrl.data)
	return json({ recipe, organization })
}

async function getRecipeFromUrl(url: string) {
	const response = await fetch(url)
	if (!response.ok) {
		throw new Response('Failed to fetch recipe', { status: 404 })
	}
	const page = await parseResponse(response, {
		script: mergeParsers(
			createElementParser('script[type="application/ld+json"]'),
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

	return zSavedRecipe.parse({
		recipe: {
			url,
			thumbnailUrl: article?.thumbnailUrl ?? '',
			name: recipe.name,
			description: recipe.description,
			ingredients: recipe.recipeIngredient,
			instructions: recipe.recipeInstructions,
			sourceUrl: recipe['@id'],
		},
		organization: {
			name: organization?.name ?? null,
			url: organization?.url ?? null,
		},
	})
}
