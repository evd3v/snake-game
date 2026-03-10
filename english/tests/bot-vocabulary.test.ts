import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('bot vocabulary flow removal', () => {
  it('vocabulary handler file is removed', () => {
    const filePath = path.resolve(__dirname, '../src/bot/handlers/vocabulary.ts');
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('word selection keyboard file is removed', () => {
    const filePath = path.resolve(__dirname, '../src/bot/keyboards/analysis.ts');
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
