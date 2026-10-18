export const SUBJECTS = [
  { id: 'chinese', name: '语文', max: 150, target: 115 },
  { id: 'math', name: '数学', max: 150, target: 135 },
  { id: 'english', name: '英语', max: 150, target: 120 },
  { id: 'physics', name: '物理', max: 100, target: 90 },
  { id: 'chemistry', name: '化学', max: 100, target: 85 },
  { id: 'elective', name: '生物', max: 100, target: 75 },
];
export const STATUSES = ['未学', '学习中', '已掌握'];
export const BACKUP_VERSION = 1;
const DAY = 86400000;

export function localDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + days));
}

export function makeInitialData() {
  return {
    version: BACKUP_VERSION,
    settings: { baseline: 280, goal: 620, subjects: structuredClone(SUBJECTS) },
    scores: [], tasks: [], mistakes: [], points: [], sessions: [],
    timer: { subjectId: 'math', taskId: '', accumulatedSec: 0, runningSince: null },
  };
}

export function uid() {
  return globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function latestScores(data) {
  const latest = {};
  for (const score of data.scores) {
    if (!latest[score.subjectId] || `${score.date}|${score.createdAt}` > `${latest[score.subjectId].date}|${latest[score.subjectId].createdAt}`) latest[score.subjectId] = score;
  }
  return latest;
}

export function scoreSummary(data) {
  const latest = latestScores(data);
  const complete = data.settings.subjects.every(s => latest[s.id]);
  return { complete, total: complete ? data.settings.subjects.reduce((n, s) => n + latest[s.id].score, 0) : null, latest };
}

export function nextReviewDate(date, completedCount) {
  const intervals = [1, 3, 7, 14, 30];
  return addDays(date, intervals[Math.min(completedCount, intervals.length - 1)]);
}

export function weekDates(today = new Date()) {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const offset = (base.getDay() + 6) % 7;
  base.setDate(base.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => addDays(localDate(base), i));
}

export function weeklyStats(data, today = new Date()) {
  const dates = weekDates(today);
  const daily = dates.map(date => ({ date, minutes: 0, completed: 0 }));
  const byDate = Object.fromEntries(daily.map(row => [row.date, row]));
  for (const session of data.sessions) if (byDate[session.date]) byDate[session.date].minutes += session.minutes;
  for (const task of data.tasks) if (task.done && byDate[task.date]) byDate[task.date].completed++;
  return {
    daily,
    minutes: daily.reduce((sum, row) => sum + row.minutes, 0),
    completed: daily.reduce((sum, row) => sum + row.completed, 0),
    due: data.tasks.filter(t => dates.includes(t.date)).length,
  };
}

function isDate(x) {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const [y, m, d] = x.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
const str = (x, max = 2000) => typeof x === 'string' && x.length <= max;
const num = (x, max = 1000000) => Number.isFinite(x) && x >= 0 && x <= max;
const id = x => str(x, 100) && x.length > 0;

export function validateData(data) {
  if (!data || typeof data !== 'object' || data.version !== BACKUP_VERSION) throw new Error('备份版本不受支持');
  if (!data.settings || !num(data.settings.baseline, 750) || !num(data.settings.goal, 750)) throw new Error('总分设置无效');
  const subjects = data.settings.subjects;
  if (!Array.isArray(subjects) || subjects.length !== 6 || subjects.some((s, i) => s.id !== SUBJECTS[i].id || !str(s.name, 20) || !s.name.trim() || !num(s.max, 750) || s.max === 0 || !num(s.target, s.max))) throw new Error('科目设置无效');
  const subjectIds = new Set(subjects.map(s => s.id));
  for (const field of ['scores', 'tasks', 'mistakes', 'points', 'sessions']) if (!Array.isArray(data[field]) || data[field].length > 20000) throw new Error(`${field} 数据无效或过多`);
  for (const x of data.scores) if (!id(x.id) || !subjectIds.has(x.subjectId) || !isDate(x.date) || !num(x.score, subjects.find(s => s.id === x.subjectId).max) || !num(x.createdAt, 1e15)) throw new Error('成绩记录无效');
  for (const x of data.tasks) if (!id(x.id) || !subjectIds.has(x.subjectId) || !isDate(x.date) || !str(x.title, 160) || !x.title.trim() || !num(x.plannedMinutes, 1440) || typeof x.done !== 'boolean') throw new Error('任务记录无效');
  for (const x of data.mistakes) if (!id(x.id) || !subjectIds.has(x.subjectId) || !isDate(x.createdDate) || !isDate(x.nextReview) || !str(x.question) || !x.question.trim() || !str(x.answer) || !str(x.reason) || !num(x.reviewCount, 1000)) throw new Error('错题记录无效');
  for (const x of data.points) if (!id(x.id) || !subjectIds.has(x.subjectId) || !str(x.title, 160) || !x.title.trim() || !STATUSES.includes(x.status)) throw new Error('知识点记录无效');
  for (const x of data.sessions) if (!id(x.id) || !subjectIds.has(x.subjectId) || !isDate(x.date) || !num(x.minutes, 1440) || x.minutes === 0) throw new Error('学习记录无效');
  const t = data.timer;
  if (!t || !subjectIds.has(t.subjectId) || !str(t.taskId, 100) || !num(t.accumulatedSec, 86400) || (t.runningSince !== null && !num(t.runningSince, 1e15))) throw new Error('计时数据无效');
  return data;
}

export function parseBackup(text) {
  if (text.length > 5_000_000) throw new Error('备份文件过大');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('文件不是有效 JSON'); }
  return validateData(parsed);
}
