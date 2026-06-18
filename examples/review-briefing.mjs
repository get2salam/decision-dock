import { readFile } from 'node:fs/promises';

import {
  boundedString,
  safeFiniteNumber,
  safeISODate,
  sanitizeImportPayload,
} from '../js/safe-input.js';

const SAMPLE_BACKUP = {
  schema: 'decision-dock/v3',
  items: [
    {
      title: 'Static site vs richer app first',
      category: 'Product',
      state: 'Comparing',
      score: 9,
      effort: 4,
      metric: 7,
      textOne: 'Founder',
      textTwo: 'Choose the faster trust path',
      date: '2026-04-25',
    },
    {
      title: 'When to hire the first helper',
      category: 'Hiring',
      state: 'Open',
      score: 7,
      effort: 5,
      metric: 5,
      textOne: 'Founder',
      textTwo: 'Define trigger points',
      date: '2026-04-29',
    },
    {
      title: 'Pricing model for early users',
      category: 'Strategy',
      state: 'Chosen',
      score: 8,
      effort: 3,
      metric: 8,
      textOne: 'Founder',
      textTwo: 'Test pilot framing',
      date: '2026-04-24',
    },
  ],
};

const REFERENCE_DATE = '2026-04-24';
const COMPLETED_STATES = new Set(['Chosen', 'Parked']);
const STATE_WEIGHTS = { Open: 3, Comparing: 9, Chosen: 4, Parked: 1 };

function daysUntil(date, referenceDate = REFERENCE_DATE) {
  const safeDate = safeISODate(date, referenceDate);
  const target = new Date(`${safeDate}T00:00:00Z`);
  const reference = new Date(`${referenceDate}T00:00:00Z`);
  return Math.round((target - reference) / 86400000);
}

function normalizeDecision(item) {
  return {
    title: boundedString(item.title, 120) || 'Untitled decision',
    owner: boundedString(item.textOne, 80) || 'Unassigned',
    nextStep: boundedString(item.textTwo, 160) || 'Clarify next step',
    state: boundedString(item.state, 40) || 'Open',
    score: safeFiniteNumber(item.score, 7),
    effort: safeFiniteNumber(item.effort, 3),
    conviction: safeFiniteNumber(item.metric, 6),
    date: safeISODate(item.date, REFERENCE_DATE),
  };
}

function priority(decision) {
  const completed = COMPLETED_STATES.has(decision.state);
  const dueBoost = completed ? 0 : Math.max(0, 4 - Math.max(daysUntil(decision.date), 0)) * 4;
  return (
    decision.score * 6 +
    decision.conviction * 5 +
    dueBoost +
    (STATE_WEIGHTS[decision.state] ?? 0) -
    decision.effort * 4
  );
}

async function loadBackup() {
  const filePath = process.argv[2];
  if (!filePath) return SAMPLE_BACKUP;
  return JSON.parse(await readFile(filePath, 'utf8'));
}

const parsed = await loadBackup();
const result = sanitizeImportPayload(parsed);

if (!result.ok) {
  throw new Error('Expected a Decision Dock export object with an items array.');
}

const active = result.items
  .map(normalizeDecision)
  .filter((decision) => !COMPLETED_STATES.has(decision.state))
  .sort((a, b) => priority(b) - priority(a) || daysUntil(a.date) - daysUntil(b.date));

console.log('Decision Dock review briefing');
console.log(`Reference date: ${REFERENCE_DATE}`);
console.log(`Active decisions: ${active.length}`);

for (const [index, decision] of active.slice(0, 3).entries()) {
  const dueText = daysUntil(decision.date) <= 0 ? 'due now' : `due in ${daysUntil(decision.date)}d`;
  console.log(
    `${index + 1}. ${decision.title} — ${decision.owner}; ${decision.nextStep}; ${dueText}; priority ${priority(decision)}`,
  );
}

if (result.skipped.invalid || result.skipped.overflow) {
  console.log(
    `Skipped records: ${result.skipped.invalid} malformed, ${result.skipped.overflow} over import cap`,
  );
}
