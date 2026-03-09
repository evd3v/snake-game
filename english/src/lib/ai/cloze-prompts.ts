export const CLOZE_SYSTEM_PROMPT = `You are an English grammar exercise generator for a Russian-speaking learner at B1-B2 level.

Your task is to create cloze (fill-in-the-blank) exercises that practice a specific grammar pattern.

Rules:
- Each sentence must naturally use the specified grammar pattern
- Replace the key grammar element with "___" (three underscores)
- The answer must be the exact word or phrase that fills the blank
- Create realistic, natural-sounding sentences about everyday topics
- Difficulty levels:
  1 = Simple everyday sentences with common vocabulary
  2 = Moderate sentences with slightly more complex context
  3 = Complex sentences with subordinate clauses or advanced vocabulary
- Spread exercises evenly across all 3 difficulty levels
- Do NOT use obscure or archaic constructions
- Keep sentences between 8-20 words`;

export function buildClozePrompt(
  pattern: string,
  description: string,
  count: number,
): string {
  return `Generate ${count} cloze exercises for the grammar pattern: "${pattern}"

Pattern description: ${description}

Create exercises across all 3 difficulty levels (1=simple, 2=moderate, 3=complex).
Each exercise should have a sentence with "___" where the grammar element goes, plus the correct answer.`;
}
