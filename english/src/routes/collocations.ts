import type { FastifyPluginAsync } from 'fastify';
import { eq, and, ilike, inArray, sql, asc } from 'drizzle-orm';
import { collocations, sentenceCollocations } from '../db/schema/collocations.ts';
import { sentences } from '../db/schema/sentences.ts';

const collocationsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: {
      page?: string;
      limit?: string;
      search?: string;
      cefrLevel?: string;
      type?: string;
      srsState?: string;
    };
  }>('/collocations', async (request) => {
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { search, cefrLevel, type } = request.query;
    // Note: srsState filtering requires Phase 10 (collocationId on srs_cards + cardType='collocation')

    // Build WHERE conditions
    const conditions: ReturnType<typeof eq>[] = [];

    if (search) {
      conditions.push(ilike(collocations.text, `%${search}%`));
    }

    if (cefrLevel) {
      conditions.push(eq(collocations.cefrLevel, cefrLevel));
    }

    if (type) {
      conditions.push(eq(collocations.type, type as 'collocation' | 'phrasal_verb' | 'idiom'));
    }

    // TODO: SRS state filter - enable after Phase 10 adds collocationId to srs_cards
    // and 'collocation' to cardTypeEnum

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Step 1: Get collocations for this page
    const pageCollocations = await fastify.db
      .select({
        id: collocations.id,
        text: collocations.text,
        translation: collocations.translation,
        type: collocations.type,
        cefrLevel: collocations.cefrLevel,
        createdAt: collocations.createdAt,
      })
      .from(collocations)
      .where(whereClause)
      .orderBy(asc(collocations.text))
      .limit(limit)
      .offset(offset);

    // Step 2: Count total
    const [{ count: total }] = await fastify.db
      .select({ count: sql<number>`count(*)::int` })
      .from(collocations)
      .where(whereClause);

    if (pageCollocations.length === 0) {
      return { items: [], total, page, limit };
    }

    const collocationIds = pageCollocations.map((c) => c.id);

    // Step 3: Batch-fetch example sentences via junction table
    const exampleRows = await fastify.db
      .select({
        collocationId: sentenceCollocations.collocationId,
        sentenceId: sentences.id,
        sentenceText: sentences.text,
      })
      .from(sentenceCollocations)
      .innerJoin(sentences, eq(sentenceCollocations.sentenceId, sentences.id))
      .where(inArray(sentenceCollocations.collocationId, collocationIds));

    // Group by collocation ID, limit to 3 per collocation
    const sentencesByCollocation = new Map<number, { id: number; text: string }[]>();
    for (const row of exampleRows) {
      const existing = sentencesByCollocation.get(row.collocationId) ?? [];
      if (existing.length < 3) {
        existing.push({ id: row.sentenceId, text: row.sentenceText });
        sentencesByCollocation.set(row.collocationId, existing);
      }
    }

    // Step 4: Assemble response
    // Note: srsState will be added after Phase 10 enables collocation SRS cards
    const items = pageCollocations.map((c) => ({
      id: c.id,
      text: c.text,
      translation: c.translation,
      type: c.type,
      cefrLevel: c.cefrLevel,
      exampleSentences: sentencesByCollocation.get(c.id) ?? [],
    }));

    return { items, total, page, limit };
  });
};

export default collocationsRoute;
