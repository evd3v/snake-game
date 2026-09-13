import { fsrs, createEmptyCard, generatorParameters, Rating, State } from 'ts-fsrs';

const scheduler = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: false }));

export const MATURE_DAYS = 21;
export { Rating, State };

export function toFields(card) {
  return {
    fsrs_due: card.due.toISOString(),
    fsrs_stability: card.stability,
    fsrs_difficulty: card.difficulty,
    fsrs_elapsed_days: card.elapsed_days,
    fsrs_scheduled_days: card.scheduled_days,
    fsrs_reps: card.reps,
    fsrs_lapses: card.lapses,
    fsrs_learning_steps: card.learning_steps,
    fsrs_state: card.state,
    fsrs_last_review: card.last_review ? card.last_review.toISOString() : null
  };
}

export function fromRow(row) {
  return {
    due: new Date(row.fsrs_due),
    stability: row.fsrs_stability,
    difficulty: row.fsrs_difficulty,
    elapsed_days: row.fsrs_elapsed_days,
    scheduled_days: row.fsrs_scheduled_days,
    reps: row.fsrs_reps,
    lapses: row.fsrs_lapses,
    learning_steps: row.fsrs_learning_steps,
    state: row.fsrs_state,
    last_review: row.fsrs_last_review ? new Date(row.fsrs_last_review) : undefined
  };
}

export function emptyFsrsFields(now = new Date()) {
  return toFields(createEmptyCard(now));
}

export function applyRating(row, rating, now = new Date()) {
  if (![1, 2, 3, 4].includes(Number(rating))) throw new Error('rating must be 1..4');
  const { card, log } = scheduler.next(fromRow(row), now, Number(rating));
  return { fields: toFields(card), log };
}

export function isMature(row) {
  return row.fsrs_state === State.Review && row.fsrs_scheduled_days >= MATURE_DAYS;
}
