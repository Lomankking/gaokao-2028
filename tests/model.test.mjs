import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInitialData, validateData, parseBackup, scoreSummary, nextReviewDate, weeklyStats, localDate } from '../dist/model.mjs';

test('initial data validates and score summary uses baseline until all subjects exist', () => {
  const data = makeInitialData();
  assert.doesNotThrow(() => validateData(data));
  assert.equal(scoreSummary(data).total, null);
  data.scores = data.settings.subjects.map((s, i) => ({ id: `s${i}`, subjectId: s.id, score: s.target, date: '2026-10-18', createdAt: i + 1 }));
  assert.equal(scoreSummary(data).total, 620);
});

test('review schedule uses increasing intervals', () => {
  assert.equal(nextReviewDate('2026-10-18', 0), '2026-10-19');
  assert.equal(nextReviewDate('2026-10-18', 2), '2026-10-25');
  assert.equal(nextReviewDate('2026-10-18', 9), '2026-11-17');
});

test('weekly stats starts on Monday and counts minutes and tasks', () => {
  const data = makeInitialData();
  data.sessions.push({ id:'a', subjectId:'math', date:'2026-10-12', minutes:45 });
  data.tasks.push({ id:'b', subjectId:'math', date:'2026-10-18', title:'x', plannedMinutes:20, done:true });
  const stats = weeklyStats(data, new Date(2026, 9, 18));
  assert.equal(stats.daily[0].date, '2026-10-12');
  assert.equal(stats.minutes, 45); assert.equal(stats.completed, 1);
});

test('backup parser rejects malformed or unsafe data', () => {
  assert.throws(() => parseBackup('{"version":1}'), /总分设置无效/);
  const data = makeInitialData();
  assert.deepEqual(parseBackup(JSON.stringify(data)).settings.goal, 620);
  data.tasks.push({ id:'x', subjectId:'math', date:'not-date', title:'bad', plannedMinutes:1, done:false });
  assert.throws(() => validateData(data), /任务记录无效/);
});

test('local date is stable for a local calendar date', () => assert.equal(localDate(new Date(2026, 9, 18)), '2026-10-18'));
