import { eq, inArray } from 'drizzle-orm';
import type { Database } from '../db/index.ts';
import { wordFamilies } from '../db/schema/word-families.ts';
import { words } from '../db/schema/words.ts';

export async function linkWordFamilies(
  db: Database,
  wordFamilyGroups: { root: string; forms: string[] }[],
  insertedWords: Map<string, number>,
): Promise<void> {
  for (const group of wordFamilyGroups) {
    // 1. Find existing words in DB that match any form in this group
    const allForms = group.forms.map((f) => f.toLowerCase());
    const existingWords = await db
      .select({ id: words.id, lemma: words.lemma, wordFamilyId: words.wordFamilyId })
      .from(words)
      .where(inArray(words.lemma, allForms));

    // 2. Check if any existing word already has a word_family_id
    let familyId: number | null = null;
    for (const w of existingWords) {
      if (w.wordFamilyId !== null) {
        familyId = w.wordFamilyId;
        break;
      }
    }

    // 3. If no family found via words, check if word_families row with matching rootWord exists
    if (familyId === null) {
      const existingFamily = await db
        .select({ id: wordFamilies.id })
        .from(wordFamilies)
        .where(eq(wordFamilies.rootWord, group.root.toLowerCase()));

      if (existingFamily.length > 0) {
        familyId = existingFamily[0].id;
      }
    }

    // 4. If still no family, create one
    if (familyId === null) {
      const inserted = await db
        .insert(wordFamilies)
        .values({ rootWord: group.root.toLowerCase() })
        .returning({ id: wordFamilies.id });

      familyId = inserted[0].id;
    }

    // 5. Collect all word IDs to update (from existing DB words + newly inserted)
    const wordIdsToUpdate: number[] = [];

    for (const w of existingWords) {
      wordIdsToUpdate.push(w.id);
    }

    for (const form of allForms) {
      const insertedId = insertedWords.get(form);
      if (insertedId !== undefined && !wordIdsToUpdate.includes(insertedId)) {
        wordIdsToUpdate.push(insertedId);
      }
    }

    // 6. Update all words to share the same word_family_id
    if (wordIdsToUpdate.length > 0) {
      await db
        .update(words)
        .set({ wordFamilyId: familyId })
        .where(inArray(words.id, wordIdsToUpdate));
    }
  }
}
