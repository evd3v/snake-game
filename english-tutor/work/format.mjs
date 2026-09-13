const KIND = { word: 'слово', pv: 'фразовый глагол', expr: 'выражение' };

function meta(card, tail) {
  return [KIND[card.kind] || card.kind, card.level || null, card.group_label || null, tail].filter(Boolean).join(' · ');
}

export function formatNext(body) {
  return `${body.explanation_md.trim()}\n\n_${meta(body.card, `в очереди ${body.queued_left}`)}_\nок / знаю / вопрос`;
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

export function formatReview(body) {
  const task = body.wanted_type === 'cloze' || /_{3,}/.test(body.test.sentence) ? 'вставь слово' : 'что значит выделенное';
  return [
    `Повторение · осталось ${body.left_today} · ${task}`,
    '',
    body.test.sentence,
    '',
    `||${body.test.answer}||`,
    '',
    '1 снова · 2 трудно · 3 норм · 4 легко'
  ].join('\n');
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

export function formatStatus(s) {
  const line = (label, c) => `${label}: выучено ${c.learned}, учу ${c.learning}, знал ${c.known}, отложено ${c.shown}, в очереди ${c.queued}`;
  return [
    `Выучено ${s.all.learned} из ${s.all.total} · учу ${s.all.learning} · ждёт сегодня ${s.all.due_today} · серия ${s.streak}`,
    line('Слова', s.word),
    line('Фразовые', s.pv),
    line('Выражения', s.expr)
  ].join('\n');
}

export function formatDecision(decision, r) {
  const a = r.status.all;
  if (decision === 'learn') return `В повторении. Учу ${a.learning}, выучено ${a.learned}, ждёт сегодня ${a.due_today}.`;
  if (decision === 'known') return `Записал как «знал». Всего таких ${a.known}.`;
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
