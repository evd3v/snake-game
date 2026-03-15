import { createRequire } from 'node:module';
import * as cheerio from 'cheerio';
import sbd from 'sbd';

const require = createRequire(import.meta.url);
const { EPub } = require('epub2');

export interface ParsedChapter {
  id: string;
  title: string;
  order: number;
  sentences: string[];
}

export interface ParsedBook {
  title: string;
  author: string | null;
  coverBase64: string | null;
  chapters: ParsedChapter[];
}

export async function parseEpub(filePath: string): Promise<ParsedBook> {
  const epub = await EPub.createAsync(filePath);

  // Extract metadata
  const title = epub.metadata.title || 'Untitled';
  const author = epub.metadata.creator || null;

  // Extract cover
  let coverBase64: string | null = null;
  const coverId = epub.metadata.cover;
  if (coverId) {
    try {
      const [data, mimeType] = await epub.getImageAsync(coverId);
      coverBase64 = `data:${mimeType};base64,${data.toString('base64')}`;
    } catch {
      /* no cover available */
    }
  }

  // Extract chapters from spine order
  const chapters: ParsedChapter[] = [];
  for (let i = 0; i < epub.flow.length; i++) {
    const chapter = epub.flow[i];
    try {
      const html = await epub.getChapterAsync(chapter.id);
      const $ = cheerio.load(html);
      const text = $('body').text()
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (text.length < 20) continue; // Skip empty/cover chapters

      const sentences = sbd.sentences(text, { newline_boundaries: true });
      if (sentences.length === 0) continue;

      chapters.push({
        id: chapter.id,
        title: chapter.title || `Chapter ${chapters.length + 1}`,
        order: chapters.length,
        sentences,
      });
    } catch {
      /* skip unreadable chapters */
    }
  }

  return { title, author, coverBase64, chapters };
}
