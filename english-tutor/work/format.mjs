const KIND = { word: 'слово', pv: 'фразовый глагол', expr: 'выражение' };

function meta(card, tail) {
  return [KIND[card.kind] || card.kind, card.level || null, card.group_label || null, tail].filter(Boolean).join(' · ');
}

export const LEARN_BUTTONS = '[[BUTTONS: 👍 Учу | 🤝 Знаю // Дальше]]';
export const GRADE_BUTTONS = '[[BUTTONS: 1 снова | 2 трудно // 3 норм | 4 легко]]';

export function formatNext(body) {
  const audio = body.card.source?.audio;
  return [
    body.explanation_md.trim(),
    '',
    `_${meta(body.card, `в очереди ${body.queued_left}`)}_`,
    ...(audio ? [`[🔊 послушать](${audio})`] : []),
    LEARN_BUTTONS
  ].join('\n');
}

export function formatNeedExplanation(body) {
  return [
    `[НУЖЕН РАЗБОР] карточка ${body.card.id} (${body.card.headword}) ещё без разбора. Напиши его строго по промпту ниже, сохрани командой`,
    `  node ~/projects/personal-git/english-tutor/work/tutor.mjs explain ${body.card.id} <<'MD'`,
    `  <текст разбора>`,
    `  MD`,
    `и отправь в чат то, что команда напечатает.`,
    '',
    body.prompt
  ].join('\n');
}

const REVIEW_HINT = {
  pair: 'какой из двух вариантов сюда подходит',
  cloze: 'какое слово на месте пропуска',
  context: 'что значит слово из списка'
};

export function formatReview(body) {
  const type = body.test.type || (body.wanted_type === 'cloze' || /_{3,}/.test(body.test.sentence) ? 'cloze' : 'context');
  return [
    `**Повторение** · осталось ${body.left_today}`,
    `_${REVIEW_HINT[type] || REVIEW_HINT.context}_`,
    '',
    `> ${body.test.sentence}`,
    '',
    `Ответ: ||${body.test.answer}||`,
    GRADE_BUTTONS
  ].join('\n');
}

export function lookupNote(body) {
  if (body.created) return '_Этого слова не было в списках, добавил своей карточкой._';
  if (body.previous_status === 'learning' && body.card?.known_at) return '_Ты отмечал это слово как знакомое._';
  if (body.previous_status === 'learning') return '_Это слово уже в повторении._';
  return '';
}

export function formatNeedTest(body) {
  return [
    `[НУЖЕН ТЕСТ] для карточки ${body.card.id} (${body.card.headword}) нет готового предложения. Составь его по промпту ниже, сохрани командой`,
    `  node ~/projects/personal-git/english-tutor/work/tutor.mjs test ${body.card.id} <<'JSON'`,
    `  {"type": "${body.wanted_type}", "sentence": "...", "answer": "..."}`,
    `  JSON`,
    `и отправь в чат то, что команда напечатает. Если команда ответила «Ошибка: предложение не прошло проверку», составь другое.`,
    '',
    body.prompt
  ].join('\n');
}

export function bar(done, total, width = 12) {
  if (!total) return '░'.repeat(width);
  const filled = Math.min(width, Math.round((done / total) * width));
  return '▓'.repeat(filled) + '░'.repeat(width - filled);
}

export function formatStatus(s) {
  const main = ['word', 'pv', 'expr'].reduce((acc, k) => ({
    total: acc.total + s[k].total, queued: acc.queued + s[k].queued,
    learning: acc.learning + s[k].learning, learned: acc.learned + s[k].learned, known: acc.known + s[k].known
  }), { total: 0, queued: 0, learning: 0, learned: 0, known: 0 });
  const passed = main.total - main.queued;
  const line = (label, c) => `${label} — учу ${c.learning} · выучил ${c.learned} · знал ${c.known} · осталось ${c.queued}`;
  const out = [
    `**Английский** · учу ${s.all.learning} · выучил ${s.all.learned} · ждёт сегодня ${s.all.due_today}`,
    '',
    `${bar(passed, main.total)} ${passed} из ${main.total} разобрано`,
    '',
    '**Основная очередь**',
    line('слова B2-C1', s.word),
    line('фразовые', s.pv),
    line('выражения', s.expr)
  ];
  if (s.basic && s.basic.total) {
    out.push('', '**Бытовой слой** (A1-B1 и повседневное)', `знаю ${s.basic.known} · учу ${s.basic.learning} · проверить ${s.basic.queued}`);
  }
  out.push('', `_серия ${s.streak} ${s.streak === 1 ? 'день' : 'дней'} подряд_`);
  out.push('[[BUTTONS: Дальше | Повторение // Аудит]]');
  return out.join('\n');
}

// Пачка бытовых слов: отмечаем номерами только незнакомые, остальные уходят в «знаю».
export function formatAudit(body) {
  if (!body.items.length) return 'Бытовой слой проверен целиком.';
  const list = body.items.map((i) => `${i.n} ${i.headword}${i.ru ? ` (${i.ru})` : ''}`).join(' · ');
  return [
    `**Аудит бытового слоя** · осталось ${body.left}`,
    '_пришли номера тех, которых НЕ знаешь; остальные запишу как знакомые_',
    '',
    `> ${list}`,
    '[[BUTTONS: Все знаю | Стоп]]'
  ].join('\n');
}

export function formatAuditResult(body) {
  const head = `Записал знакомыми ${body.known}. Осталось проверить ${body.left}.`;
  if (!body.moved.length) return `${head}\n[[BUTTONS: Ещё пачка | Дальше]]`;
  return `${head}\nВ очередь на разбор: ${body.moved.join(', ')}.\n[[BUTTONS: Ещё пачка | Дальше]]`;
}

export function formatDecision(decision, r) {
  const a = r.status.all;
  if (decision === 'learn') return `В повторении. Учу ${a.learning}, выучено ${a.learned}, ждёт сегодня ${a.due_today}.`;
  if (decision === 'known') return `Записал как знакомое: в повторение придёт через 3 месяца. Таких ${a.known}.`;
  return 'Обсуждаем. Скажи «ок», когда станет понятно.';
}

export function parseGrade(text) {
  const t = String(text || '').trim().toLowerCase();
  if (/^(1|снова|не понял|не поняла|нет)$/.test(t)) return 1;
  if (/^(2|трудно|сложно)$/.test(t)) return 2;
  if (/^(3|норм|нормально|понял|поняла|ок|да)$/.test(t)) return 3;
  if (/^(4|легко|изи)$/.test(t)) return 4;
  return null;
}
