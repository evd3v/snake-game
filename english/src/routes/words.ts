import type { FastifyPluginAsync } from 'fastify';
import { eq, inArray, and, sql } from 'drizzle-orm';
import { words, sentenceWords } from '../db/schema/words.ts';
import { wordSenses } from '../db/schema/word-senses.ts';
import { srsCards } from '../db/schema/srs-cards.ts';

const wordsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { sentenceId: string } }>(
    '/sentences/:sentenceId/words',
    async (request) => {
      const sentenceId = Number(request.params.sentenceId);

      // Join words -> sentenceWords, LEFT JOIN word_senses for translation/familiarity
      const rows = await fastify.db
        .select({
          id: words.id,
          lemma: words.lemma,
          cefrLevel: words.cefrLevel,
          thematicCluster: words.thematicCluster,
          position: sentenceWords.position,
          translation: wordSenses.translation,
          familiarity: wordSenses.familiarity,
          partOfSpeech: wordSenses.partOfSpeech,
          senseId: wordSenses.id,
        })
        .from(words)
        .innerJoin(sentenceWords, eq(words.id, sentenceWords.wordId))
        .leftJoin(wordSenses, eq(words.id, wordSenses.wordId))
        .where(eq(sentenceWords.sentenceId, sentenceId))
        .orderBy(sentenceWords.position);

      // Deduplicate: pick first sense per word (by word id + position)
      const seen = new Set<string>();
      const uniqueRows = rows.filter((r) => {
        const key = `${r.id}:${r.position}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const wordIds = uniqueRows.map((r) => r.id);
      let srsWordSenseIds = new Set<number>();

      if (wordIds.length > 0) {
        // Check SRS cards via word_senses
        const srsRows = await fastify.db
          .select({ wordSenseId: srsCards.wordSenseId })
          .from(srsCards)
          .where(
            and(
              eq(srsCards.cardType, 'vocabulary'),
              inArray(
                srsCards.wordSenseId,
                fastify.db
                  .select({ id: wordSenses.id })
                  .from(wordSenses)
                  .where(inArray(wordSenses.wordId, wordIds)),
              ),
            ),
          );

        srsWordSenseIds = new Set(srsRows.map((r) => r.wordSenseId!).filter(Boolean));
      }

      return uniqueRows.map(({ position, ...word }) => ({
        id: word.id,
        lemma: word.lemma,
        cefrLevel: word.cefrLevel,
        thematicCluster: word.thematicCluster,
        translation: word.translation ?? null,
        familiarity: word.familiarity ?? null,
        partOfSpeech: word.partOfSpeech ?? null,
        senseId: word.senseId ?? null,
        hasSrsCard: word.senseId ? srsWordSenseIds.has(word.senseId) : false,
      }));
    },
  );

  fastify.patch<{ Params: { id: string }; Body: { familiarity: string } }>(
    '/words/:id/familiarity',
    {
      schema: {
        body: {
          type: 'object',
          required: ['familiarity'],
          properties: {
            familiarity: {
              type: 'string',
              enum: ['never_seen', 'seen_unsure', 'understand_in_context'],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const id = Number(request.params.id);
      const { familiarity } = request.body;

      // Update all word_senses for this word_id
      const updated = await fastify.db
        .update(wordSenses)
        .set({ familiarity: familiarity as typeof wordSenses.$inferInsert.familiarity })
        .where(eq(wordSenses.wordId, id))
        .returning();

      if (updated.length === 0) {
        return reply.status(404).send({ error: 'Word senses not found' });
      }

      return updated[0];
    },
  );
};

export default wordsRoute;
