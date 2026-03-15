import { pgTable, integer, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { sentences } from './sentences.ts';

export const books = pgTable('books', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: text().notNull(),
  author: text(),
  coverBase64: text('cover_base64'),
  filePath: text('file_path'),
  totalPages: integer('total_pages').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const bookChapters = pgTable('book_chapters', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  bookId: integer('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  title: text().notNull(),
  orderIndex: integer('order_index').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const bookSentences = pgTable('book_sentences', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  bookId: integer('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  chapterId: integer('chapter_id').notNull().references(() => bookChapters.id, { onDelete: 'cascade' }),
  text: text().notNull(),
  orderInChapter: integer('order_in_chapter').notNull(),
  pageNumber: integer('page_number').notNull(),
  sentenceId: integer('sentence_id').references(() => sentences.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const readingPositions = pgTable('reading_positions', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  bookId: integer('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  pageNumber: integer('page_number').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  unique('reading_positions_book_id_unique').on(table.bookId),
]);
