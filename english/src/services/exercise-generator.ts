import { generateText, Output } from 'ai';
import { getModel } from '../lib/ai/provider.ts';
import { clozeExerciseSchema } from '../lib/ai/cloze-schemas.ts';
import { CLOZE_SYSTEM_PROMPT, buildClozePrompt } from '../lib/ai/cloze-prompts.ts';
import { grammarExercises } from '../db/schema/grammar-exercises.ts';
import type { Database } from '../db/index.ts';

export async function generateClozeExercises(
  db: Database,
  grammarPatternId: number,
  pattern: string,
  description: string,
  count = 6,
): Promise<number> {
  const { output } = await generateText({
    model: getModel(),
    output: Output.object({ schema: clozeExerciseSchema }),
    system: CLOZE_SYSTEM_PROMPT,
    prompt: buildClozePrompt(pattern, description, count),
  });

  if (!output || !output.exercises.length) {
    throw new Error(
      `AI returned no exercises for grammar pattern: "${pattern}"`,
    );
  }

  const rows = output.exercises.map((ex) => ({
    grammarPatternId,
    sentence: ex.sentence,
    clozeAnswer: ex.answer,
    difficultyLevel: ex.difficulty,
    hint: ex.hint ?? null,
  }));

  await db.insert(grammarExercises).values(rows);

  return rows.length;
}
