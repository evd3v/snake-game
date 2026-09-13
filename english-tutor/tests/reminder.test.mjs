import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reminderDue } from '../src/reminder.mjs';

test('reminderDue: время совпало, сегодня не слали, есть что повторять', () => {
  assert.equal(reminderDue({ at: '21:00', nowLocalHHMM: '21:00', today: '2026-09-13', sentDay: '', dueToday: 3 }), true);
  assert.equal(reminderDue({ at: '21:00', nowLocalHHMM: '20:59', today: '2026-09-13', sentDay: '', dueToday: 3 }), false);
  assert.equal(reminderDue({ at: '21:00', nowLocalHHMM: '21:00', today: '2026-09-13', sentDay: '2026-09-13', dueToday: 3 }), false);
  assert.equal(reminderDue({ at: '21:00', nowLocalHHMM: '21:00', today: '2026-09-13', sentDay: '', dueToday: 0 }), false);
  assert.equal(reminderDue({ at: '', nowLocalHHMM: '21:00', today: '2026-09-13', sentDay: '', dueToday: 3 }), false);
});
