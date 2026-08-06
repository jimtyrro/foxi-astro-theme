import { z, defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'

const blog = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
	schema: () =>
		z.object({
			title: z.string(),
			description: z.string(),
			pubDate: z.date(),
			image: z.string(),
			author: z.string(),
			tags: z.array(z.string())
		})
})

// Editable page content (SEO + hero/header text), one JSON per page:
// src/content/pages/<page>.json
const pages = defineCollection({
	loader: glob({ pattern: '**/*.json', base: './src/content/pages' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		header: z
			.object({
				title: z.string(),
				text: z.string()
			})
			.optional()
	})
})

// FAQ items, one JSON per question: src/content/faq/NN-slug.json
// File order (NN prefix) defines display order within a category.
const faq = defineCollection({
	loader: glob({ pattern: '**/*.json', base: './src/content/faq' }),
	schema: z.object({
		question: z.string(),
		reply: z.string(),
		category: z.enum(['pricing', 'integrations', 'features']),
		open: z.boolean().default(false)
	})
})

export const collections = {
	blog,
	pages,
	faq
}
