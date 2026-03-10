import type { FastifyPluginAsync } from 'fastify';
import { eq, and, ilike, inArray, sql, asc, desc, exists, notExists } from 'drizzle-orm';
import { words, sentenceWords } from '../db/schema/words.ts';
import { wordSenses } from '../db/schema/word-senses.ts';
import { srsCards } from '../db/schema/srs-cards.ts';
import { collocations, sentenceCollocations } from '../db/schema/collocations.ts';
import { wordFamilies } from '../db/schema/word-families.ts';
import { sentences } from '../db/schema/sentences.ts';

const cefrOrderExpr = sql`CASE ${words.cefrLevel}
  WHEN 'A1' THEN 1 WHEN 'A2' THEN 2 WHEN 'B1' THEN 3
  WHEN 'B2' THEN 4 WHEN 'C1' THEN 5 WHEN 'C2' THEN 6
  ELSE 7 END`;

function pickSrsState(states: (string | null)[]): string | null {
  const priority = ['learning', 'relearning', 'new', 'review'];
  for (const p of priority) {
    if (states.includes(p)) return p;
  }
  return null;
}

const vocabularyRoute: FastifyPluginAsync = async (fastify) => {
  // GET /vocabulary - paginated list with search/filter/sort
  fastify.get<{
    Querystring: {
      page?: string;
      limit?: string;
      search?: string;
      familiarity?: string;
      cefrLevel?: string;
      cluster?: string;
      srsState?: string;
      sortBy?: string;
      sortOrder?: string;
    };
  }>('/vocabulary', async (request) => {
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { search, familiarity, cefrLevel, cluster, srsState, sortBy = 'lemma', sortOrder = 'asc' } = request.query;

    // Build WHERE conditions for the words query
    const conditions: ReturnType<typeof eq>[] = [];

    if (search) {
      conditions.push(ilike(words.lemma, `%${search}%`));
    }

    if (cefrLevel) {
      conditions.push(eq(words.cefrLevel, cefrLevel));
    }

    if (cluster) {
      conditions.push(eq(words.thematicCluster, cluster));
    }

    if (familiarity) {
      // Word has at least one sense with this familiarity
      conditions.push(
        exists(
          fastify.db
            .select({ id: sql`1` })
            .from(wordSenses)
            .where(
              and(
                eq(wordSenses.wordId, words.id),
                eq(wordSenses.familiarity, familiarity as 'never_seen' | 'seen_unsure' | 'understand_in_context'),
              ),
            ),
        ),
      );
    }

    if (srsState === 'none') {
      conditions.push(
        notExists(
          fastify.db
            .select({ id: sql`1` })
            .from(srsCards)
            .innerJoin(wordSenses, eq(srsCards.wordSenseId, wordSenses.id))
            .where(
              and(
                eq(wordSenses.wordId, words.id),
                eq(srsCards.cardType, 'vocabulary'),
              ),
            ),
        ),
      );
    } else if (srsState && srsState !== 'none') {
      conditions.push(
        exists(
          fastify.db
            .select({ id: sql`1` })
            .from(srsCards)
            .innerJoin(wordSenses, eq(srsCards.wordSenseId, wordSenses.id))
            .where(
              and(
                eq(wordSenses.wordId, words.id),
                eq(srsCards.cardType, 'vocabulary'),
                eq(srsCards.state, srsState as 'new' | 'learning' | 'review' | 'relearning'),
              ),
            ),
        ),
      );
    }

    // Determine sort expression
    const sortExpr = sortBy === 'cefr'
      ? cefrOrderExpr
      : sortBy === 'date'
        ? words.createdAt
        : words.lemma;

    const orderFn = sortOrder === 'desc' ? desc : asc;

    // Step 1: Get word IDs for this page
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const pageWords = await fastify.db
      .select({
        id: words.id,
        lemma: words.lemma,
        cefrLevel: words.cefrLevel,
        thematicCluster: words.thematicCluster,
        createdAt: words.createdAt,
      })
      .from(words)
      .where(whereClause)
      .orderBy(orderFn(sortExpr))
      .limit(limit)
      .offset(offset);

    // Step 2: Count total
    const [{ count: total }] = await fastify.db
      .select({ count: sql<number>`count(*)::int` })
      .from(words)
      .where(whereClause);

    if (pageWords.length === 0) {
      return { items: [], total, page, limit };
    }

    const pageWordIds = pageWords.map((w) => w.id);

    // Step 3: Fetch all senses for these words
    const allSenses = await fastify.db
      .select()
      .from(wordSenses)
      .where(inArray(wordSenses.wordId, pageWordIds));

    // Step 4: Fetch SRS card state for those senses
    const senseIdsList = allSenses.map((s) => s.id);
    let srsMap = new Map<number, { id: number; state: string | null }>();

    if (senseIdsList.length > 0) {
      const srsRows = await fastify.db
        .select({
          id: srsCards.id,
          wordSenseId: srsCards.wordSenseId,
          state: srsCards.state,
        })
        .from(srsCards)
        .where(
          and(
            eq(srsCards.cardType, 'vocabulary'),
            inArray(srsCards.wordSenseId, senseIdsList),
          ),
        );

      for (const row of srsRows) {
        if (row.wordSenseId != null) {
          srsMap.set(row.wordSenseId, { id: row.id, state: row.state });
        }
      }
    }

    // Step 5: Assemble response
    const items = pageWords.map((w) => {
      const senses = allSenses
        .filter((s) => s.wordId === w.id)
        .map((s) => ({
          id: s.id,
          partOfSpeech: s.partOfSpeech,
          translation: s.translation,
          familiarity: s.familiarity,
        }));

      const senseStates = senses.map((s) => srsMap.get(s.id)?.state ?? null);
      const hasCard = senseStates.some((st) => st !== null);
      const aggregatedSrsState = pickSrsState(senseStates);

      return {
        id: w.id,
        lemma: w.lemma,
        cefrLevel: w.cefrLevel,
        thematicCluster: w.thematicCluster,
        createdAt: w.createdAt,
        senses,
        srsState: aggregatedSrsState,
        hasCard,
      };
    });

    return { items, total, page, limit };
  });

  // GET /vocabulary/:wordId - word detail
  fastify.get<{ Params: { wordId: string } }>(
    '/vocabulary/:wordId',
    async (request, reply) => {
      const wordId = Number(request.params.wordId);

      // Fetch word
      const [word] = await fastify.db
        .select()
        .from(words)
        .where(eq(words.id, wordId));

      if (!word) {
        return reply.status(404).send({ error: 'Word not found' });
      }

      // Fetch senses with SRS card data
      const sensesRaw = await fastify.db
        .select({
          id: wordSenses.id,
          partOfSpeech: wordSenses.partOfSpeech,
          translation: wordSenses.translation,
          familiarity: wordSenses.familiarity,
          srsCardId: srsCards.id,
          srsState: srsCards.state,
          srsDue: srsCards.due,
          srsReps: srsCards.reps,
        })
        .from(wordSenses)
        .leftJoin(
          srsCards,
          and(
            eq(srsCards.wordSenseId, wordSenses.id),
            eq(srsCards.cardType, 'vocabulary'),
          ),
        )
        .where(eq(wordSenses.wordId, wordId));

      const senses = sensesRaw.map((s) => ({
        id: s.id,
        partOfSpeech: s.partOfSpeech,
        translation: s.translation,
        familiarity: s.familiarity,
        srsCard: s.srsCardId
          ? { id: s.srsCardId, state: s.srsState, due: s.srsDue, reps: s.srsReps }
          : null,
      }));

      // Fetch collocations via shared sentences
      const wordCollocations = await fastify.db
        .selectDistinct({
          id: collocations.id,
          text: collocations.text,
          translation: collocations.translation,
          type: collocations.type,
          cefrLevel: collocations.cefrLevel,
        })
        .from(sentenceWords)
        .innerJoin(sentenceCollocations, eq(sentenceWords.sentenceId, sentenceCollocations.sentenceId))
        .innerJoin(collocations, eq(sentenceCollocations.collocationId, collocations.id))
        .where(eq(sentenceWords.wordId, wordId));

      // Fetch word family (siblings, excluding self)
      let wordFamily: { id: number; lemma: string; cefrLevel: string | null }[] = [];
      if (word.wordFamilyId) {
        wordFamily = await fastify.db
          .select({
            id: words.id,
            lemma: words.lemma,
            cefrLevel: words.cefrLevel,
          })
          .from(words)
          .where(
            and(
              eq(words.wordFamilyId, word.wordFamilyId),
              sql`${words.id} != ${wordId}`,
            ),
          );
      }

      // Fetch sentences
      const wordSentences = await fastify.db
        .select({
          id: sentences.id,
          text: sentences.text,
        })
        .from(sentenceWords)
        .innerJoin(sentences, eq(sentenceWords.sentenceId, sentences.id))
        .where(eq(sentenceWords.wordId, wordId));

      return {
        id: word.id,
        lemma: word.lemma,
        cefrLevel: word.cefrLevel,
        thematicCluster: word.thematicCluster,
        createdAt: word.createdAt,
        senses,
        collocations: wordCollocations,
        wordFamily,
        sentences: wordSentences,
      };
    },
  );

  // POST /vocabulary/:wordId/mark-known
  fastify.post<{ Params: { wordId: string } }>(
    '/vocabulary/:wordId/mark-known',
    async (request) => {
      const wordId = Number(request.params.wordId);

      // Get all sense IDs for this word
      const senses = await fastify.db
        .select({ id: wordSenses.id })
        .from(wordSenses)
        .where(eq(wordSenses.wordId, wordId));

      const senseIdsList = senses.map((s) => s.id);

      if (senseIdsList.length > 0) {
        await fastify.db
          .delete(srsCards)
          .where(
            and(
              eq(srsCards.cardType, 'vocabulary'),
              inArray(srsCards.wordSenseId, senseIdsList),
            ),
          );
      }

      return { success: true };
    },
  );

  // POST /vocabulary/:wordId/reset
  fastify.post<{ Params: { wordId: string } }>(
    '/vocabulary/:wordId/reset',
    async (request) => {
      const wordId = Number(request.params.wordId);

      // Get all sense IDs for this word
      const senses = await fastify.db
        .select({ id: wordSenses.id })
        .from(wordSenses)
        .where(eq(wordSenses.wordId, wordId));

      let created = 0;

      for (const sense of senses) {
        // Check if card already exists
        const existing = await fastify.db
          .select({ id: srsCards.id })
          .from(srsCards)
          .where(
            and(
              eq(srsCards.cardType, 'vocabulary'),
              eq(srsCards.wordSenseId, sense.id),
            ),
          );

        if (existing.length === 0) {
          await fastify.db.insert(srsCards).values({
            cardType: 'vocabulary',
            wordSenseId: sense.id,
            state: 'new',
          });
          created++;
        }
      }

      return { success: true, created };
    },
  );
};

export default vocabularyRoute;
