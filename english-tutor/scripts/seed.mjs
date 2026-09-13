import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb, nowIso } from '../src/db.mjs';

export function seed(db, queue) {
  const insert = db.prepare(`INSERT INTO cards (kind, headword, pos, level, source_json, group_key, group_label, order_index, stream, topic, freq_rank, status, decided_at)
    VALUES (@kind, @headword, @pos, @level, @source_json, @group_key, @group_label, @order_index, @stream, @topic, @freq_rank, @status, @decided_at)
    ON CONFLICT(kind, headword, pos) DO NOTHING`);
  const seededAt = nowIso();
  let inserted = 0;
  let skipped = 0;
  let preknown = 0;
  db.exec('BEGIN');
  try {
    queue.forEach((item, order_index) => {
      const r = insert.run({
        kind: item.kind, headword: item.headword, pos: item.pos || '', level: item.level || '',
        source_json: JSON.stringify(item.source), group_key: item.group_key, group_label: item.group_label, order_index,
        stream: item.stream || 'main', topic: item.topic ?? null, freq_rank: item.freq_rank ?? null,
        status: item.preknown ? 'known' : 'queued', decided_at: item.preknown ? seededAt : null
      });
      if (r.changes) { inserted++; if (item.preknown) preknown++; } else skipped++;
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { inserted, skipped, preknown };
}

// Обновление данных карточек (source_json, уровень, группа) из нового queue.json,
// когда источники обогатились: транскрипция и озвучка добавились после первого сида.
// Статус, прогресс FSRS и порядок не трогаем.
export function refreshSources(db, queue) {
  const upd = db.prepare(`UPDATE cards SET source_json = @source_json, level = @level, group_key = @group_key,
    group_label = @group_label, topic = @topic, freq_rank = @freq_rank
    WHERE kind = @kind AND headword = @headword AND pos = @pos AND source_json <> @source_json`);
  let updated = 0;
  db.exec('BEGIN');
  try {
    for (const item of queue) {
      updated += upd.run({
        kind: item.kind, headword: item.headword, pos: item.pos || '', level: item.level || '',
        source_json: JSON.stringify(item.source), group_key: item.group_key, group_label: item.group_label,
        topic: item.topic ?? null, freq_rank: item.freq_rank ?? null
      }).changes;
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { updated };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = openDb(process.env.DB_PATH || 'data-db/tutor.sqlite');
  const queue = JSON.parse(fs.readFileSync(new URL('../data/queue.json', import.meta.url), 'utf8'));
  console.log(seed(db, queue));
  if (process.argv.includes('--refresh')) console.log(refreshSources(db, queue));
}
