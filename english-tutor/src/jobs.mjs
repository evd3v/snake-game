import { hydrate } from './queue.mjs';
import { requiredTestType, recentSentences } from './review.mjs';
import { renderExplainPrompt, renderTestPrompt } from './prompts.mjs';

export function jobs(db, { explainAhead = 20, perKindAhead = 3, testsWithinHours = 24, now = new Date() } = {}) {
  const seen = new Set();
  const explain = [];
  const push = (row) => {
    if (seen.has(row.id)) return;
    seen.add(row.id);
    const card = hydrate(row);
    explain.push({ card_id: card.id, headword: card.headword, kind: card.kind, prompt: renderExplainPrompt(card) });
  };
  db.prepare(`SELECT * FROM cards WHERE explanation_md IS NULL AND status IN ('shown', 'discussing', 'learning') ORDER BY shown_at, order_index`).all().forEach(push);
  db.prepare(`SELECT * FROM cards WHERE explanation_md IS NULL AND status = 'queued' ORDER BY order_index LIMIT ?`).all(explainAhead).forEach(push);
  for (const kind of ['word', 'pv', 'expr']) {
    db.prepare(`SELECT * FROM cards WHERE explanation_md IS NULL AND status = 'queued' AND kind = ? ORDER BY order_index LIMIT ?`).all(kind, perKindAhead).forEach(push);
  }
  const horizon = new Date(now.getTime() + testsWithinHours * 3600e3).toISOString();
  const tests = db.prepare(`SELECT c.* FROM cards c WHERE c.status = 'learning' AND c.fsrs_due <= ?
    AND NOT EXISTS (SELECT 1 FROM tests t WHERE t.card_id = c.id AND t.used_at IS NULL)
    ORDER BY c.fsrs_due, c.order_index LIMIT 30`).all(horizon).map(hydrate).map((card) => {
    const type = requiredTestType(db, card);
    return { card_id: card.id, headword: card.headword, kind: card.kind, type, prompt: renderTestPrompt(card, type, recentSentences(db, card.id)) };
  });
  return { explain, tests };
}
