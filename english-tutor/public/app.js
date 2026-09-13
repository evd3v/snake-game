const $ = (sel) => document.querySelector(sel);
const KIND = { word: 'слово', pv: 'фразовый глагол', expr: 'выражение' };
const STATUS = { queued: 'в очереди', shown: 'отложено', discussing: 'обсуждается', learning: 'учу', known: 'знал', suspended: 'убрано' };

async function api(url, opts = {}) {
  const r = await fetch(url, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...opts });
  if (r.status === 401) { showLogin(); throw new Error('401'); }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
  return body;
}
const post = (url, payload) => api(url, { method: 'POST', body: JSON.stringify(payload || {}) });

function md(text) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let s = esc(text || '');
  s = s.replace(/(^|\n)((?:&gt;!? ?[^\n]*(?:\n|$))+)/g, (m, lead, block) => `${lead}<blockquote>${block.replace(/\n$/, '').split('\n').map((l) => l.replace(/^&gt;!? ?/, '')).join('\n')}</blockquote>`);
  return s.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/(^|\s)_([^_\n]+)_/g, '$1<i>$2</i>').replace(/\|\|([^|]+)\|\|/g, '<span class="answer">$1</span>');
}

function show(tab) {
  for (const s of document.querySelectorAll('main > section')) s.hidden = s.id !== tab;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('active', b.dataset.tab === tab);
  try { localStorage.setItem('et_tab', tab); } catch {}
  if (tab === 'status') loadStatus();
  if (tab === 'list') loadList();
}
function showLogin() { $('#tabs').hidden = true; show('login'); }

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').hidden = true;
  try {
    await post('/api/login', { password: new FormData(e.target).get('password') });
    e.target.reset();
    start();
  } catch (err) {
    $('#login-error').textContent = err.message;
    $('#login-error').hidden = false;
  }
});

async function start() {
  try { await api('/api/me'); } catch { return; }
  $('#tabs').hidden = false;
  let tab = 'status';
  try { tab = localStorage.getItem('et_tab') || 'status'; } catch {}
  show(['status', 'learn', 'review', 'list'].includes(tab) ? tab : 'status');
}
$('#tabs').addEventListener('click', (e) => { if (e.target.dataset.tab) show(e.target.dataset.tab); });

async function loadStatus() {
  const s = await api('/api/status');
  $('#status-cards').innerHTML = [
    ['Выучено', s.all.learned], ['Учу', s.all.learning], ['Ждёт сегодня', s.all.due_today],
    ['Осталось в очереди', s.all.queued], ['Знал заранее', s.all.known], ['Серия дней', s.streak]
  ].map(([l, v]) => `<div class="tile"><b>${v}</b>${l}</div>`).join('');
  const row = (k, c) => `<tr><th>${KIND[k] || 'всего'}</th><td>${c.total}</td><td>${c.learned}</td><td>${c.learning}</td><td>${c.known}</td><td>${c.shown}</td><td>${c.queued}</td></tr>`;
  $('#status-table').innerHTML = '<tr><th></th><th>всего</th><th>выучено</th><th>учу</th><th>знал</th><th>отложено</th><th>в очереди</th></tr>' +
    ['word', 'pv', 'expr', 'all'].map((k) => row(k, s[k])).join('');
}

let learnCard = null;
function renderLearn(body) {
  learnCard = body.card;
  $('#learn-card').hidden = false;
  $('#learn-meta').textContent = `${KIND[body.card.kind]} · ${body.card.level || ''} ${body.card.group_label ? '· ' + body.card.group_label : ''} · в очереди ${body.queued_left}`;
  $('#learn-explanation').innerHTML = body.explanation_md ? md(body.explanation_md) : `<b>${body.card.headword}</b><br><span class="muted">Разбор ещё готовится (генератор на work). Можно решить сейчас или отложить.</span>`;
  $('#learn-message').textContent = '';
}
$('#learn-next').addEventListener('click', async () => {
  try { renderLearn(await api(`/api/next?kind=${$('#learn-kind').value}`)); }
  catch (e) { $('#learn-message').textContent = e.message; $('#learn-card').hidden = true; }
});
async function learnDecide(decision) {
  if (!learnCard) return;
  const r = await post(`/api/cards/${learnCard.id}/${decision}`);
  $('#learn-card').hidden = true;
  $('#learn-message').textContent = decision === 'learn' ? `В повторении. Учу: ${r.status.all.learning}, выучено: ${r.status.all.learned}` : 'Отмечено как известное';
  learnCard = null;
}
$('#learn-learn').addEventListener('click', () => learnDecide('learn'));
$('#learn-known').addEventListener('click', () => learnDecide('known'));
$('#learn-skip').addEventListener('click', () => { $('#learn-card').hidden = true; $('#learn-message').textContent = 'Отложено, найдёшь в списке со статусом «отложено»'; learnCard = null; });

let review = null;
async function reviewNext() {
  review = await api('/api/review/next');
  $('#review-answer').hidden = true;
  $('#review-grades').hidden = true;
  $('#review-reveal').hidden = false;
  if (!review.card) {
    $('#review-card').hidden = true;
    $('#review-left').textContent = 'На сегодня всё повторено';
    $('#review-message').textContent = '';
    return;
  }
  $('#review-card').hidden = false;
  $('#review-left').textContent = `Осталось сегодня: ${review.left_today}`;
  $('#review-meta').textContent = `${KIND[review.card.kind]} · ${review.wanted_type === 'cloze' ? 'вставь слово' : 'что значит выделенное'}`;
  if (!review.test) {
    $('#review-sentence').textContent = review.card.headword;
    $('#review-message').textContent = 'Предложение ещё готовится (генератор на work), загляни через 10 минут или спроси /review в Telegram.';
    $('#review-reveal').hidden = true;
    return;
  }
  $('#review-sentence').textContent = review.test.sentence;
  $('#review-answer').textContent = review.test.answer;
  $('#review-message').textContent = '';
}
$('#review-start').addEventListener('click', reviewNext);
$('#review-reveal').addEventListener('click', () => { $('#review-answer').hidden = false; $('#review-grades').hidden = false; $('#review-reveal').hidden = true; });
$('#review-grades').addEventListener('click', async (e) => {
  const rating = Number(e.target.dataset.rating);
  if (!rating || !review?.card) return;
  const g = await post(`/api/review/${review.card.id}/grade`, { rating, test_id: review.test ? review.test.id : null });
  $('#review-message').textContent = `Следующий раз через ${g.scheduled_days} дн.`;
  await reviewNext();
});

async function loadList() {
  const p = new URLSearchParams({ status: $('#list-status').value, kind: $('#list-kind').value, q: $('#list-q').value });
  const { items } = await api(`/api/cards?${p}`);
  $('#list-table').innerHTML = '<tr><th>слово</th><th>поток</th><th>статус</th><th>срок</th></tr>' + items.map((c) =>
    `<tr class="clickable" data-id="${c.id}"><td>${c.headword}</td><td>${KIND[c.kind]}</td><td>${STATUS[c.status]}</td><td>${c.fsrs_due ? c.fsrs_due.slice(0, 10) : ''}</td></tr>`).join('');
}
$('#list-go').addEventListener('click', loadList);
$('#list-table').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) openCard(Number(tr.dataset.id)); });

let cardId = null;
async function openCard(id) {
  cardId = id;
  const d = await api(`/api/cards/${id}`);
  for (const s of document.querySelectorAll('main > section')) s.hidden = s.id !== 'card';
  $('#card-meta').textContent = `${d.card.headword} · ${KIND[d.card.kind]} · ${STATUS[d.card.status]} ${d.card.group_label ? '· ' + d.card.group_label : ''}`;
  $('#card-explanation').innerHTML = d.card.explanation_md ? md(d.card.explanation_md) : '<span class="muted">Разбора ещё нет</span>';
  $('#card-notes').innerHTML = d.notes.map((n) => `<li>${md(n.text)} <span class="muted">${n.ts.slice(0, 10)}</span></li>`).join('') || '<li class="muted">нет</li>';
  $('#card-history').innerHTML = d.history.map((h) => `<tr><td>${h.ts.slice(0, 10)}</td><td>${h.rating}</td><td>${h.sentence || ''}</td></tr>`).join('');
}
$('#card-back').addEventListener('click', () => show('list'));
$('#card-learn').addEventListener('click', async () => { await post(`/api/cards/${cardId}/learn`); openCard(cardId); });
$('#card-known').addEventListener('click', async () => { await post(`/api/cards/${cardId}/known`); openCard(cardId); });
$('#card-suspend').addEventListener('click', async () => { await post(`/api/cards/${cardId}/suspend`); openCard(cardId); });

start();
