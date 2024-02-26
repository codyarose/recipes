import { customAlphabet } from 'nanoid'
import nanoIdDict from 'nanoid-dictionary'
import { z } from 'zod'

export const baseStore = z.object({
	id: z.string(),
	createdAt: z.number(),
})
export const id = customAlphabet(nanoIdDict.nolookalikes)
