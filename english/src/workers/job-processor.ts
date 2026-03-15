import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/index.ts';
import { bookSentences } from '../db/schema/books.ts';
import { analyzeSentence } from '../lib/ai/analyze-sentence.ts';
import { storeAnalysisResults } from '../services/analysis.ts';
import { generateClozeExercises } from '../services/exercise-generator.ts';

export async function processJob(db: Database, job: Job): Promise<any> {
  switch (job.name) {
    case 'sentence-analysis': {
      const { text, sourceBook, bookSentenceId } = job.data as {
        text: string;
        sourceBook?: string;
        bookSentenceId?: number;
      };
      const analysis = await analyzeSentence(text);
      const result = await storeAnalysisResults(db, text, sourceBook, analysis, {
        autoCreateSrsCards: !bookSentenceId,
      });

      // Link book_sentence to the analysis sentence
      if (bookSentenceId) {
        await db.update(bookSentences)
          .set({ sentenceId: result.sentenceId })
          .where(eq(bookSentences.id, bookSentenceId));
      }

      return result;
    }

    case 'generate-exercises': {
      const { grammarPatternId, pattern, description, count } = job.data as {
        grammarPatternId: number;
        pattern: string;
        description: string;
        count?: number;
      };
      return generateClozeExercises(db, grammarPatternId, pattern, description, count ?? 6);
    }

    default:
      throw new Error(`Unknown job type: ${job.name}`);
  }
}
