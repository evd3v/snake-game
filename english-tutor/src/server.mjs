import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import { openDb, nowIso, httpError } from './db.mjs';
import { nextCard, undecidedCard, pendingCard, resolveId, decide, suspend, setExplanation, addNote, cardDetails, listCards, status, getCard, lookupCard, learnerContext, auditBatch, auditMark } from './queue.mjs';
import { reviewNext, addTest, grade, currentReview } from './review.mjs';
import { jobs } from './jobs.mjs';
import { renderExplainPrompt, renderTestPrompt } from './prompts.mjs';
import { startReminder } from './reminder.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DAYS = 30;

export function buildApp({ db, env, logger = false }) {
  const app = Fastify({ logger });
  app.register(fastifyCookie);
  app.register(fastifyStatic, { root: path.join(here, '..', 'public'), prefix: '/' });

  app.setErrorHandler((err, req, reply) => {
    const code = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    if (code === 500) app.log.error(err);
    reply.code(code).send({ error: code === 500 ? 'внутренняя ошибка' : err.message });
  });

  const sessionOk = (token) => {
    if (!token) return false;
    const row = db.prepare('SELECT expires_at FROM sessions WHERE token = ?').get(token);
    return Boolean(row && row.expires_at > nowIso());
  };

  // Хук авторизации регистрируется раньше, чем плагин cookie успевает добавить свой парсер,
  // поэтому cookie читаем из заголовка сами.
  const cookieValue = (req, name) => {
    if (req.cookies && req.cookies[name]) return req.cookies[name];
    const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return m ? decodeURIComponent(m[1]) : null;
  };

  app.addHook('onRequest', async (req) => {
    if (!req.url.startsWith('/api/')) return;
    if (req.url === '/api/health' || req.url === '/api/login') return;
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (env.API_TOKEN && bearer && bearer === env.API_TOKEN) return;
    if (sessionOk(cookieValue(req, 'et_session'))) return;
    throw httpError(401, 'нужна авторизация');
  });

  app.get('/api/health', async () => ({ ok: true }));

  app.post('/api/login', async (req, reply) => {
    const password = String(req.body?.password || '');
    if (!env.DASHBOARD_PASSWORD || password !== env.DASHBOARD_PASSWORD) throw httpError(401, 'неверный пароль');
    const token = crypto.randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + SESSION_DAYS * 86400e3).toISOString();
    db.prepare('INSERT INTO sessions(token, expires_at) VALUES (?, ?)').run(token, expires);
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(nowIso());
    reply.setCookie('et_session', token, { path: '/', httpOnly: true, sameSite: 'lax', secure: env.COOKIE_SECURE !== '0', maxAge: SESSION_DAYS * 86400 });
    return { ok: true };
  });

  app.post('/api/logout', async (req, reply) => {
    const token = cookieValue(req, 'et_session');
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    reply.clearCookie('et_session', { path: '/' });
    return { ok: true };
  });

  app.get('/api/me', async () => ({ ok: true }));
  app.get('/api/status', async () => status(db));

  app.get('/api/next', async (req) => {
    const kind = req.query.kind || null;
    const stream = req.query.stream || 'main';
    const undecided = req.query.force === '1' ? null : undecidedCard(db, { kind, stream });
    const card = undecided || nextCard(db, { kind, stream });
    if (!card) throw httpError(404, kind ? `очередь ${kind} пуста` : 'очередь пуста');
    const queued_left = db.prepare(`SELECT COUNT(*) AS c FROM cards WHERE status = 'queued' AND stream = ?`).get(stream).c;
    return { card, repeat: Boolean(undecided), explanation_md: card.explanation_md, prompt: card.explanation_md ? null : renderExplainPrompt(card, learnerContext(db, card)), queued_left };
  });

  app.get('/api/pending', async () => ({ card: pendingCard(db) }));

  app.post('/api/cards/lookup', async (req) => {
    const { card, created, previous_status } = lookupCard(db, req.body?.text);
    const queued_left = db.prepare(`SELECT COUNT(*) AS c FROM cards WHERE status = 'queued'`).get().c;
    return { card, created, previous_status, explanation_md: card.explanation_md, prompt: card.explanation_md ? null : renderExplainPrompt(card, learnerContext(db, card)), queued_left };
  });

  app.post('/api/cards/known-bulk', async (req) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
    if (!ids.length) throw httpError(400, 'ids пуст');
    let updated = 0;
    for (const id of ids) {
      const card = getCard(db, id);
      if (!card || !['queued', 'shown', 'discussing'].includes(card.status)) continue;
      decide(db, id, 'known');
      updated++;
    }
    return { updated };
  });

  app.get('/api/audit', async (req) => auditBatch(db, req.query.limit));
  app.post('/api/audit', async (req) => auditMark(db, req.body?.unknown || []));

  app.get('/api/cards', async (req) => ({ items: listCards(db, req.query) }));
  app.get('/api/cards/:id', async (req) => cardDetails(db, resolveId(db, req.params.id)));

  app.post('/api/cards/:id/explanation', async (req) => ({ card: setExplanation(db, resolveId(db, req.params.id), req.body?.md) }));
  for (const decision of ['learn', 'known', 'discuss']) {
    app.post(`/api/cards/:id/${decision}`, async (req) => {
      const card = decide(db, resolveId(db, req.params.id), decision);
      return { card, status: status(db) };
    });
  }
  app.post('/api/cards/:id/suspend', async (req) => ({ card: suspend(db, resolveId(db, req.params.id)), status: status(db) }));
  app.post('/api/cards/:id/notes', async (req) => ({ note: addNote(db, resolveId(db, req.params.id), req.body?.text) }));

  app.get('/api/review/next', async () => {
    const r = reviewNext(db);
    if (!r) return { card: null, test: null, wanted_type: null, prompt: null, left_today: 0 };
    return { card: r.card, test: r.test, wanted_type: r.wanted_type, prompt: r.test ? null : renderTestPrompt(r.card, r.wanted_type, r.history), left_today: r.left_today };
  });

  const reviewId = (param) => {
    if (param === 'current') {
      const { cardId } = currentReview(db);
      if (!cardId) throw httpError(404, 'нет текущей карточки повторения: сначала /review');
      return cardId;
    }
    const n = Number(param);
    if (!Number.isInteger(n)) throw httpError(400, 'id должен быть числом');
    if (!getCard(db, n)) throw httpError(404, 'карточка не найдена');
    return n;
  };

  app.post('/api/review/:id/test', async (req) => ({ test: addTest(db, reviewId(req.params.id), req.body || {}) }));

  app.post('/api/review/:id/grade', async (req) => {
    const cardId = reviewId(req.params.id);
    const current = currentReview(db);
    const testId = req.body?.test_id ?? (current.cardId === cardId ? current.testId : null);
    const g = grade(db, cardId, Number(req.body?.rating), testId);
    const next_left = db.prepare(`SELECT COUNT(*) AS c FROM cards WHERE status = 'learning' AND fsrs_due <= ?`).get(nowIso()).c;
    return { ...g, next_left };
  });

  app.get('/api/jobs', async (req) => jobs(db, {
    explainAhead: Number(req.query.explain) || 20,
    testsWithinHours: Number(req.query.tests_hours) || 24
  }));

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const env = process.env;
  const db = openDb(env.DB_PATH || 'data-db/tutor.sqlite');
  const app = buildApp({ db, env, logger: true });
  startReminder({ db, env, log: app.log });
  app.listen({ port: Number(env.PORT) || 3000, host: '0.0.0.0' }).catch((e) => {
    app.log.error(e);
    process.exit(1);
  });
}
