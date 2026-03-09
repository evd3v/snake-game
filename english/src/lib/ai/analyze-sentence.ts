import { generateText, NoObjectGeneratedError, Output } from 'ai';
import { getModel } from './provider.ts';
import { sentenceAnalysisSchema, type SentenceAnalysis } from './schemas.ts';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts.ts';

export async function analyzeSentence(
  sentence: string,
): Promise<SentenceAnalysis> {
  try {
    const { output } = await generateText({
      model: getModel(),
      output: Output.object({ schema: sentenceAnalysisSchema }),
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(sentence),
    });

    if (!output) {
      throw new Error(
        `AI returned no structured output for sentence: "${sentence}"`,
      );
    }

    return output;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new Error(
        `AI failed to generate valid analysis for sentence: "${sentence}". Cause: ${error.message}`,
      );
    }
    throw error;
  }
}
