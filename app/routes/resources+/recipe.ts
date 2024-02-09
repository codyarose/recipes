import { LoaderFunctionArgs, json } from '@remix-run/cloudflare'
import { z } from 'zod'
import { JSDOM } from 'jsdom'
import {
	findArticle,
	findOrganization,
	findRecipe,
	zGraph,
	zSavedRecipe,
} from '~/schema'

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

const sanitizeHtml = (html: string) => {
	return html.replace(/<style([\S\s]*?)>([\S\s]*?)<\/style>/gim, '')
}

async function getRecipeFromUrl(url: string) {
	const dom = await fetch(url)
		.then(res => res.text())
		.then(html => new JSDOM(sanitizeHtml(html), { contentType: 'text/html' }))
	const jsonLdScripts = Array.from(
		dom.window.document.querySelectorAll('script[type="application/ld+json"]'),
	)

	const schemaData = jsonLdScripts
		.filter(
			(script): script is Element & { textContent: string } =>
				typeof script.textContent === 'string',
		)
		.flatMap(script => {
			const json = zGraph.safeParse(JSON.parse(script.textContent))
			if (!json.success) {
				throw new Error('Invalid JSON-LD')
			}
			return json.data['@graph']
		})
	const recipe = findRecipe(schemaData)
	const article = findArticle(schemaData)
	const organization = findOrganization(schemaData)
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
