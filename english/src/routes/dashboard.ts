import type { FastifyPluginAsync } from 'fastify';
import { sql, eq } from 'drizzle-orm';
import { srsCards } from '../db/schema/srs-cards.ts';
import { words } from '../db/schema/words.ts';

const dashboardRoute: FastifyPluginAsync = async (fastify) => {
  // GET /dashboard/stats (DASH-01)
  fastify.get('/dashboard/stats', async () => {
    // Count SRS cards by type and state
    const cardCounts = await fastify.db
      .select({
        cardType: srsCards.cardType,
        state: srsCards.state,
        count: sql<number>`count(*)::int`,
      })
      .from(srsCards)
      .groupBy(srsCards.cardType, srsCards.state);

    // Total words count (words without SRS cards are "new")
    const [{ totalWords }] = await fastify.db
      .select({ totalWords: sql<number>`count(*)::int` })
      .from(words);

    // Words with SRS cards count (through word_senses)
    const wordsWithCardsResult = await fastify.db.execute(sql`
      SELECT count(DISTINCT ws.word_id)::int AS "wordsWithCards"
      FROM srs_cards sc
      JOIN word_senses ws ON ws.id = sc.word_sense_id
      WHERE sc.card_type = 'vocabulary'
    `);
    const wordsWithCards = (wordsWithCardsResult.rows[0] as any)?.wordsWithCards ?? 0;

    const wordsWithoutCards = totalWords - wordsWithCards;

    const result: Record<string, { new: number; learning: number; known: number }> = {
      words: { new: 0, learning: 0, known: 0 },
      grammar: { new: 0, learning: 0, known: 0 },
      collocations: { new: 0, learning: 0, known: 0 },
    };

    for (const row of cardCounts) {
      const category = row.cardType === 'vocabulary' ? 'words' : row.cardType === 'collocation' ? 'collocations' : 'grammar';
      const state = row.state;
      if (state === 'new') {
        result[category].new += row.count;
      } else if (state === 'learning' || state === 'relearning') {
        result[category].learning += row.count;
      } else if (state === 'review') {
        result[category].known += row.count;
      }
    }

    // Add words without SRS cards as "new"
    result.words.new += wordsWithoutCards;

    return result;
  });

  // GET /dashboard/weak-spots (DASH-02)
  fastify.get('/dashboard/weak-spots', async () => {
    // Vocabulary weak spots
    const vocabWeakSpots = await fastify.db.execute(sql`
      SELECT
        w.id,
        w.lemma AS name,
        ws.translation,
        'vocabulary' AS type,
        count(*)::int AS "totalReviews",
        (count(*) FILTER (WHERE rl.rating <= 2))::float / count(*) AS "failRate"
      FROM review_logs rl
      JOIN srs_cards sc ON sc.id = rl.srs_card_id
      JOIN word_senses ws ON ws.id = sc.word_sense_id
      JOIN words w ON w.id = ws.word_id
      WHERE sc.card_type = 'vocabulary'
      GROUP BY w.id, w.lemma, ws.translation
      HAVING count(*) >= 2
      ORDER BY "failRate" DESC
      LIMIT 10
    `);

    // Grammar weak spots
    const grammarWeakSpots = await fastify.db.execute(sql`
      SELECT
        gp.id,
        gp.pattern AS name,
        gp.description,
        'grammar' AS type,
        count(*)::int AS "totalReviews",
        (count(*) FILTER (WHERE rl.rating <= 2))::float / count(*) AS "failRate"
      FROM review_logs rl
      JOIN srs_cards sc ON sc.id = rl.srs_card_id
      JOIN grammar_patterns gp ON gp.id = sc.grammar_pattern_id
      WHERE sc.card_type = 'grammar'
      GROUP BY gp.id, gp.pattern, gp.description
      HAVING count(*) >= 2
      ORDER BY "failRate" DESC
      LIMIT 10
    `);

    // Combine and sort by failRate DESC
    const combined = [...vocabWeakSpots.rows, ...grammarWeakSpots.rows];
    combined.sort((a: any, b: any) => (b.failRate as number) - (a.failRate as number));

    return combined;
  });

  // GET /dashboard/activity (DASH-03)
  fastify.get('/dashboard/activity', async () => {
    const activityData = await fastify.db.execute(sql`
      WITH review_counts AS (
        SELECT
          date(reviewed_at) AS day,
          count(*)::int AS reviews
        FROM review_logs
        WHERE reviewed_at >= NOW() - INTERVAL '365 days'
        GROUP BY date(reviewed_at)
      ),
      sentence_counts AS (
        SELECT
          date(created_at) AS day,
          count(*)::int AS additions
        FROM sentences
        WHERE created_at >= NOW() - INTERVAL '365 days'
        GROUP BY date(created_at)
      )
      SELECT
        COALESCE(r.day, s.day)::text AS date,
        COALESCE(r.reviews, 0) AS reviews,
        COALESCE(s.additions, 0) AS additions
      FROM review_counts r
      FULL OUTER JOIN sentence_counts s ON r.day = s.day
      ORDER BY date DESC
    `);

    return activityData.rows;
  });

  // GET /dashboard/clusters (DASH-04)
  fastify.get('/dashboard/clusters', async () => {
    const clusterData = await fastify.db.execute(sql`
      SELECT
        w.thematic_cluster AS cluster,
        count(*)::int AS total,
        count(*) FILTER (WHERE sc.state IS NULL OR sc.state = 'new')::int AS new,
        count(*) FILTER (WHERE sc.state IN ('learning', 'relearning'))::int AS learning,
        count(*) FILTER (WHERE sc.state = 'review')::int AS known
      FROM words w
      LEFT JOIN word_senses ws ON ws.word_id = w.id
      LEFT JOIN srs_cards sc ON sc.word_sense_id = ws.id AND sc.card_type = 'vocabulary'
      WHERE w.thematic_cluster IS NOT NULL
      GROUP BY w.thematic_cluster
      ORDER BY total DESC
    `);

    return clusterData.rows;
  });
};

export default dashboardRoute;
