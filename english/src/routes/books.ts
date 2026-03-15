import type { FastifyPluginAsync } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { eq, desc, and, asc, sql } from 'drizzle-orm';
import { createEmptyCard } from 'ts-fsrs';
import { books, bookChapters, bookSentences, readingPositions } from '../db/schema/books.ts';
import { wordSenses } from '../db/schema/word-senses.ts';
import { srsCards } from '../db/schema/srs-cards.ts';
import { grammarPatterns } from '../db/schema/grammar-patterns.ts';
import { parseEpub } from '../services/epub-parser.ts';
import { highlightSentences } from '../services/word-highlighter.ts';
import { getFilteredAnalysis } from '../services/reader-analysis.ts';

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
  // POST /books/sentences/:bookSentenceId/analyze
  fastify.post<{ Params: { bookSentenceId: string } }>(
    '/books/sentences/:bookSentenceId/analyze',
    async (request, reply) => {
      const bookSentenceId = Number(request.params.bookSentenceId);

      const [bookSentence] = await fastify.db
        .select({
          id: bookSentences.id,
          text: bookSentences.text,
          sentenceId: bookSentences.sentenceId,
        })
        .from(bookSentences)
        .where(eq(bookSentences.id, bookSentenceId));

      if (!bookSentence) {
        return reply.notFound('Book sentence not found');
      }

      // Cached: sentence_id already set
      if (bookSentence.sentenceId) {
        const result = await getFilteredAnalysis(fastify.db, bookSentence.sentenceId);
        return reply.status(200).send({ status: 'completed', result });
      }

      // Uncached: queue analysis job
      const job = await fastify.analysisQueue.add('sentence-analysis', {
        text: bookSentence.text,
        bookSentenceId,
      });

      return reply.status(202).send({ status: 'queued', jobId: job.id });
    },
  );

  // GET /books/sentences/:bookSentenceId/analyze/status/:jobId
  fastify.get<{ Params: { bookSentenceId: string; jobId: string } }>(
    '/books/sentences/:bookSentenceId/analyze/status/:jobId',
    async (request, reply) => {
      const bookSentenceId = Number(request.params.bookSentenceId);
      const { jobId } = request.params;

      const job = await fastify.analysisQueue.getJob(jobId);
      if (!job) {
        return reply.notFound('Job not found');
      }

      const state = await job.getState();

      if (state === 'completed') {
        // Re-read book_sentence to get the linked sentence_id
        const [bookSentence] = await fastify.db
          .select({ sentenceId: bookSentences.sentenceId })
          .from(bookSentences)
          .where(eq(bookSentences.id, bookSentenceId));

        if (bookSentence?.sentenceId) {
          const result = await getFilteredAnalysis(fastify.db, bookSentence.sentenceId);
          return { status: 'completed', result };
        }

        // Fallback: return raw job result if sentence_id not linked yet
        return { status: 'completed', result: job.returnvalue };
      }

      if (state === 'failed') {
        return { status: 'failed', error: job.failedReason };
      }

      return { status: state };
    },
  );

  // POST /reader/words/:senseId/learn
  fastify.post<{ Params: { senseId: string } }>(
    '/reader/words/:senseId/learn',
    async (request) => {
      const senseId = Number(request.params.senseId);

      // Update familiarity to seen_unsure
      await fastify.db
        .update(wordSenses)
        .set({ familiarity: 'seen_unsure' })
        .where(eq(wordSenses.id, senseId));

      // Check if SRS card already exists
      const [existingCard] = await fastify.db
        .select({ id: srsCards.id })
        .from(srsCards)
        .where(
          and(
            eq(srsCards.cardType, 'vocabulary'),
            eq(srsCards.wordSenseId, senseId),
          ),
        )
        .limit(1);

      if (!existingCard) {
        const emptyCard = createEmptyCard();
        await fastify.db.insert(srsCards).values({
          cardType: 'vocabulary',
          wordSenseId: senseId,
          state: 'new',
          due: emptyCard.due,
          stability: emptyCard.stability,
          difficulty: emptyCard.difficulty,
          elapsedDays: emptyCard.elapsed_days,
          scheduledDays: emptyCard.scheduled_days,
          reps: emptyCard.reps,
          lapses: emptyCard.lapses,
        });
      }

      return { ok: true, status: 'learning' };
    },
  );

  // POST /reader/words/:senseId/know
  fastify.post<{ Params: { senseId: string } }>(
    '/reader/words/:senseId/know',
    async (request) => {
      const senseId = Number(request.params.senseId);

      await fastify.db
        .update(wordSenses)
        .set({ familiarity: 'understand_in_context' })
        .where(eq(wordSenses.id, senseId));

      return { ok: true, status: 'known' };
    },
  );

  // POST /reader/collocations/:collocationId/learn
  fastify.post<{ Params: { collocationId: string } }>(
    '/reader/collocations/:collocationId/learn',
    async (request) => {
      const collocationId = Number(request.params.collocationId);

      const [existingCard] = await fastify.db
        .select({ id: srsCards.id })
        .from(srsCards)
        .where(
          and(
            eq(srsCards.cardType, 'collocation'),
            eq(srsCards.collocationId, collocationId),
          ),
        )
        .limit(1);

      if (!existingCard) {
        const emptyCard = createEmptyCard();
        await fastify.db.insert(srsCards).values({
          cardType: 'collocation',
          collocationId,
          state: 'new',
          due: emptyCard.due,
          stability: emptyCard.stability,
          difficulty: emptyCard.difficulty,
          elapsedDays: emptyCard.elapsed_days,
          scheduledDays: emptyCard.scheduled_days,
          reps: emptyCard.reps,
          lapses: emptyCard.lapses,
        });
      }

      return { ok: true };
    },
  );

  // POST /reader/collocations/:collocationId/know
  fastify.post<{ Params: { collocationId: string } }>(
    '/reader/collocations/:collocationId/know',
    async () => {
      return { ok: true };
    },
  );

  // POST /reader/grammar/:grammarPatternId/learn
  fastify.post<{ Params: { grammarPatternId: string } }>(
    '/reader/grammar/:grammarPatternId/learn',
    async (request) => {
      const grammarPatternId = Number(request.params.grammarPatternId);

      const [existingCard] = await fastify.db
        .select({ id: srsCards.id })
        .from(srsCards)
        .where(
          and(
            eq(srsCards.cardType, 'grammar'),
            eq(srsCards.grammarPatternId, grammarPatternId),
          ),
        )
        .limit(1);

      let newSrsCard = null;
      if (!existingCard) {
        const emptyCard = createEmptyCard();
        const [inserted] = await fastify.db.insert(srsCards).values({
          cardType: 'grammar',
          grammarPatternId,
          state: 'new',
          due: emptyCard.due,
          stability: emptyCard.stability,
          difficulty: emptyCard.difficulty,
          elapsedDays: emptyCard.elapsed_days,
          scheduledDays: emptyCard.scheduled_days,
          reps: emptyCard.reps,
          lapses: emptyCard.lapses,
        }).returning();
        newSrsCard = inserted;
      }

      // Queue exercise generation for newly created SRS cards
      if (newSrsCard) {
        try {
          const [gp] = await fastify.db
            .select({ pattern: grammarPatterns.pattern, description: grammarPatterns.description })
            .from(grammarPatterns)
            .where(eq(grammarPatterns.id, grammarPatternId));

          if (gp) {
            await fastify.analysisQueue.add('generate-exercises', {
              grammarPatternId,
              pattern: gp.pattern,
              description: gp.description ?? '',
              count: 6,
            });
          }
        } catch {
          /* exercise generation is best-effort */
        }
      }

      return { ok: true };
    },
  );

  // POST /reader/grammar/:grammarPatternId/know
  fastify.post<{ Params: { grammarPatternId: string } }>(
    '/reader/grammar/:grammarPatternId/know',
    async () => {
      return { ok: true };
    },
  );
};

export default booksRoute;
