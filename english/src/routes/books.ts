import type { FastifyPluginAsync } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { eq, desc, and, asc, sql } from 'drizzle-orm';
import { books, bookChapters, bookSentences, readingPositions } from '../db/schema/books.ts';
import { parseEpub } from '../services/epub-parser.ts';
import { highlightSentences } from '../services/word-highlighter.ts';

const PAGE_SIZE = 6;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const booksRoute: FastifyPluginAsync = async (fastify) => {
  // POST /books/upload
  fastify.post('/books/upload', async (request, reply) => {
    const file = await request.file();

    if (!file) {
      return reply.badRequest('No file uploaded');
    }

    if (file.mimetype !== 'application/epub+zip') {
      return reply.badRequest('Only EPUB files are accepted');
    }

    const buffer = await file.toBuffer();

    // Save to disk
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const fileName = `${Date.now()}-${file.filename}`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    await fs.writeFile(filePath, buffer);

    // Parse EPUB
    const parsed = await parseEpub(filePath);

    // Store in DB
    const result = await fastify.db.transaction(async (tx) => {
      const [book] = await tx.insert(books).values({
        title: parsed.title,
        author: parsed.author,
        coverBase64: parsed.coverBase64,
        filePath,
      }).returning({ id: books.id, title: books.title });

      let totalPages = 0;

      for (const chapter of parsed.chapters) {
        const [insertedChapter] = await tx.insert(bookChapters).values({
          bookId: book.id,
          title: chapter.title,
          orderIndex: chapter.order,
        }).returning({ id: bookChapters.id });

        // Compute page numbers: groups of PAGE_SIZE sentences
        let currentPage = totalPages;
        let sentencesOnPage = 0;

        const sentenceRows: Array<{
          bookId: number;
          chapterId: number;
          text: string;
          orderInChapter: number;
          pageNumber: number;
        }> = [];

        for (let i = 0; i < chapter.sentences.length; i++) {
          if (sentencesOnPage >= PAGE_SIZE) {
            currentPage++;
            sentencesOnPage = 0;
          }

          sentenceRows.push({
            bookId: book.id,
            chapterId: insertedChapter.id,
            text: chapter.sentences[i],
            orderInChapter: i,
            pageNumber: currentPage,
          });

          sentencesOnPage++;
        }

        // Merge short final page (< 3 sentences) with previous
        if (sentencesOnPage > 0 && sentencesOnPage < 3 && currentPage > totalPages) {
          const prevPage = currentPage - 1;
          for (const row of sentenceRows) {
            if (row.pageNumber === currentPage) {
              row.pageNumber = prevPage;
            }
          }
          currentPage = prevPage;
        }

        if (sentenceRows.length > 0) {
          await tx.insert(bookSentences).values(sentenceRows);
        }

        totalPages = currentPage + 1;
      }

      // Update total pages
      await tx.update(books)
        .set({ totalPages })
        .where(eq(books.id, book.id));

      return { id: book.id, title: book.title, totalPages };
    });

    return reply.status(201).send(result);
  });

  // GET /books
  fastify.get('/books', async () => {
    const result = await fastify.db
      .select({
        id: books.id,
        title: books.title,
        author: books.author,
        coverBase64: books.coverBase64,
        totalPages: books.totalPages,
        createdAt: books.createdAt,
      })
      .from(books)
      .orderBy(desc(books.createdAt));

    return result;
  });

  // DELETE /books/:id
  fastify.delete<{ Params: { id: string } }>('/books/:id', async (request, reply) => {
    const bookId = Number(request.params.id);

    const [book] = await fastify.db
      .select({ id: books.id, filePath: books.filePath })
      .from(books)
      .where(eq(books.id, bookId));

    if (!book) {
      return reply.notFound('Book not found');
    }

    // Delete from DB (CASCADE handles children)
    await fastify.db.delete(books).where(eq(books.id, bookId));

    // Delete file from disk (silently ignore errors)
    if (book.filePath) {
      try {
        await fs.unlink(book.filePath);
      } catch {
        /* file may already be gone */
      }
    }

    return reply.status(204).send();
  });

  // GET /books/:id/page/:pageNum
  fastify.get<{ Params: { id: string; pageNum: string } }>(
    '/books/:id/page/:pageNum',
    async (request, reply) => {
      const bookId = Number(request.params.id);
      const pageNumber = Number(request.params.pageNum);

      // Check book exists
      const [book] = await fastify.db
        .select({ id: books.id, totalPages: books.totalPages })
        .from(books)
        .where(eq(books.id, bookId));

      if (!book) {
        return reply.notFound('Book not found');
      }

      // Get sentences for this page
      const sentences = await fastify.db
        .select({
          id: bookSentences.id,
          text: bookSentences.text,
        })
        .from(bookSentences)
        .where(
          and(
            eq(bookSentences.bookId, bookId),
            eq(bookSentences.pageNumber, pageNumber),
          ),
        )
        .orderBy(asc(bookSentences.orderInChapter));

      // Get highlights for sentences (batch query)
      let sentencesWithHighlights: Array<{ id: number; text: string; highlights: unknown[] }> = [];

      if (sentences.length > 0) {
        const highlightMap = await highlightSentences(fastify.db, sentences);
        sentencesWithHighlights = sentences.map(s => ({
          id: s.id,
          text: s.text,
          highlights: highlightMap.get(s.id) || [],
        }));
      }

      // Get saved reading position
      const [position] = await fastify.db
        .select({ pageNumber: readingPositions.pageNumber })
        .from(readingPositions)
        .where(eq(readingPositions.bookId, bookId));

      return {
        bookId,
        pageNumber,
        totalPages: book.totalPages,
        savedPosition: position?.pageNumber ?? null,
        sentences: sentencesWithHighlights,
      };
    },
  );

  // PUT /books/:id/position
  fastify.put<{ Params: { id: string }; Body: { pageNumber: number } }>(
    '/books/:id/position',
    async (request) => {
      const bookId = Number(request.params.id);
      const { pageNumber } = request.body;

      await fastify.db
        .insert(readingPositions)
        .values({ bookId, pageNumber })
        .onConflictDoUpdate({
          target: readingPositions.bookId,
          set: {
            pageNumber,
            updatedAt: sql`now()`,
          },
        });

      return { ok: true };
    },
  );
};

export default booksRoute;
