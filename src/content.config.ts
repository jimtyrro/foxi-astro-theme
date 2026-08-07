import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

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
			.optional(),
		cta: z
			.object({
				title: z.string(),
				description: z.string(),
				award: z.object({
					icon: z.string(), // path to an image, e.g. /images/badge.svg
					iconAlt: z.string().optional(), // alt text for the icon image (AstroAdmin's image picker offers this)
					text: z.string(), // plain label, e.g. "#1 Product of the Year,"
					highlight: z.string(), // linked/highlighted portion, e.g. "Product Hunt"
					link: z.string()
				}),
				button: z.object({
					text: z.string(),
					link: z.string()
				})
			})
			.optional(),
		cards: z
			.object({
				title: z.string(),
				description: z.string(),
				items: z.array(
					z.object({
						iconName: z.string(), // astro-icon name, e.g. "rocket"
						title: z.string(),
						description: z.string()
					})
				)
			})
			.optional(),
		faqStickyTop: z
			.object({
				title: z.string(),
				text: z.string()
			})
			.optional(),
		faqStickyBottom: z
			.object({
				title: z.string(),
				text: z.string()
			})
			.optional(),
  })
})

// FAQ items, one JSON per question: src/content/faq/NN-slug.json
// File order (NN prefix) defines display order within a category.
const faq = defineCollection({
	loader: glob({ pattern: '**/*.json', base: './src/content/faq' }),
	schema: z.object({
		question: z.string(),
		reply: z.string(),
		category: z.enum(['pricing', 'integrations', 'features', 'pricing-page']),
		open: z.boolean().default(false)
	})
})

export const collections = {
	blog,
	pages,
	faq
}
