import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { nanoid } from 'nanoid'

export const users = sqliteTable('users', {
	userId: text('userId', { length: 21 })
		.$defaultFn(() => nanoid())
		.primaryKey(),
	email: text('email', { length: 255 }).notNull().unique(),
	username: text('username', { length: 20 }).notNull(),
})
