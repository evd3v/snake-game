import { z } from 'zod';

export const clozeExerciseSchema = z.object({
  exercises: z.array(
    z.object({
      sentence: z
        .string()
        .describe('English sentence with "___" replacing the key grammar element'),
      answer: z
        .string()
        .describe('The correct word/phrase that fills the blank'),
      difficulty: z
        .number()
        .int()
        .min(1)
        .max(3)
        .describe('Difficulty level: 1=simple, 2=moderate, 3=complex'),
      hint: z
        .string()
        .optional()
        .describe('Optional hint for the learner'),
    }),
  ),
});

export type ClozeExercises = z.infer<typeof clozeExerciseSchema>;
