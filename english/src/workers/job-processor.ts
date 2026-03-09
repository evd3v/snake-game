import type { Job } from 'bullmq';
import type { Database } from '../db/index.ts';
import { analyzeSentence } from '../lib/ai/analyze-sentence.ts';
import { storeAnalysisResults } from '../services/analysis.ts';
import { generateClozeExercises } from '../services/exercise-generator.ts';

export async function processJob(db: Database, job: Job): Promise<any> {
  switch (job.name) {
    case 'sentence-analysis': {
      const { text, sourceBook } = job.data as {
        text: string;
        sourceBook?: string;
      };
      const analysis = await analyzeSentence(text);
      return storeAnalysisResults(db, text, sourceBook, analysis);
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
