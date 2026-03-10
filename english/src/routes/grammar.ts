import type { FastifyPluginAsync } from 'fastify';
import { eq, and, or, ilike, inArray, sql, asc, exists, notExists } from 'drizzle-orm';
import { grammarPatterns, sentenceGrammarPatterns } from '../db/schema/grammar-patterns.ts';
import { srsCards } from '../db/schema/srs-cards.ts';
import { sentences } from '../db/schema/sentences.ts';

const grammarRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: {
      page?: string;
      limit?: string;
      search?: string;
      cefrLevel?: string;
      srsState?: string;
    };
  }>('/grammar', async (request) => {
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { search, cefrLevel, srsState } = request.query;

    // Build WHERE conditions
    const conditions: ReturnType<typeof eq>[] = [];

    if (search) {
      conditions.push(
        or(
          ilike(grammarPatterns.pattern, `%${search}%`),
          ilike(grammarPatterns.description, `%${search}%`),
        )!,
      );
    }

    if (cefrLevel) {
      conditions.push(eq(grammarPatterns.cefrLevel, cefrLevel));
    }

    if (srsState === 'none') {
      conditions.push(
        notExists(
          fastify.db
            .select({ id: sql`1` })
            .from(srsCards)
            .where(
              and(
                eq(srsCards.grammarPatternId, grammarPatterns.id),
                eq(srsCards.cardType, 'grammar'),
              ),
            ),
        ),
      );
    } else if (srsState) {
      conditions.push(
        exists(
          fastify.db
            .select({ id: sql`1` })
            .from(srsCards)
            .where(
              and(
                eq(srsCards.grammarPatternId, grammarPatterns.id),
                eq(srsCards.cardType, 'grammar'),
                eq(srsCards.state, srsState as 'new' | 'learning' | 'review' | 'relearning'),
              ),
            ),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Step 1: Get patterns for this page
    const pagePatterns = await fastify.db
      .select({
        id: grammarPatterns.id,
        pattern: grammarPatterns.pattern,
        description: grammarPatterns.description,
        cefrLevel: grammarPatterns.cefrLevel,
        createdAt: grammarPatterns.createdAt,
      })
      .from(grammarPatterns)
      .where(whereClause)
      .orderBy(asc(grammarPatterns.pattern))
      .limit(limit)
      .offset(offset);

    // Step 2: Count total
    const [{ count: total }] = await fastify.db
      .select({ count: sql<number>`count(*)::int` })
      .from(grammarPatterns)
      .where(whereClause);

    if (pagePatterns.length === 0) {
      return { items: [], total, page, limit };
    }

    const patternIds = pagePatterns.map((p) => p.id);

    // Step 3: Batch-fetch example sentences via junction table
    const exampleRows = await fastify.db
      .select({
        grammarPatternId: sentenceGrammarPatterns.grammarPatternId,
        sentenceId: sentences.id,
        sentenceText: sentences.text,
      })
      .from(sentenceGrammarPatterns)
      .innerJoin(sentences, eq(sentenceGrammarPatterns.sentenceId, sentences.id))
      .where(inArray(sentenceGrammarPatterns.grammarPatternId, patternIds));

    // Group by pattern ID, limit to 3 per pattern
    const sentencesByPattern = new Map<number, { id: number; text: string }[]>();
    for (const row of exampleRows) {
      const existing = sentencesByPattern.get(row.grammarPatternId) ?? [];
      if (existing.length < 3) {
        existing.push({ id: row.sentenceId, text: row.sentenceText });
        sentencesByPattern.set(row.grammarPatternId, existing);
      }
    }

    // Step 4: Batch-fetch SRS card states
    const srsRows = await fastify.db
      .select({
        grammarPatternId: srsCards.grammarPatternId,
        state: srsCards.state,
      })
      .from(srsCards)
      .where(
        and(
          eq(srsCards.cardType, 'grammar'),
          inArray(srsCards.grammarPatternId, patternIds),
        ),
      );

    const srsMap = new Map<number, string | null>();
    for (const row of srsRows) {
      if (row.grammarPatternId != null) {
        srsMap.set(row.grammarPatternId, row.state);
      }
    }

    // Step 5: Assemble response
    const items = pagePatterns.map((p) => ({
      id: p.id,
      pattern: p.pattern,
      description: p.description,
      cefrLevel: p.cefrLevel,
      srsState: srsMap.get(p.id) ?? null,
      exampleSentences: sentencesByPattern.get(p.id) ?? [],
    }));

    return { items, total, page, limit };
  });
};

export default grammarRoute;
