import { readFile } from 'node:fs/promises';

import {
  boundedString,
  safeFiniteNumber,
  safeISODate,
  sanitizeImportPayload,
} from '../js/safe-input.js';

const SAMPLE_BOARD = {
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
      date: '2026-04-29',
    },
    {
      title: 'Pricing model for early users',
      category: 'Strategy',
      state: 'Open',
      score: 8,
      effort: 3,
      metric: 8,
      textOne: '',
      textTwo: 'Test pilot framing',
      date: '2026-04-30',
    },
    {
      title: 'When to hire the first helper',
      category: 'Hiring',
      state: 'Open',
      score: 7,
      effort: 5,
      metric: 5,
      textOne: 'Founder',
      textTwo: '',
      date: '2026-04-20',
    },
    {
      title: 'Legacy vendor renewal',
      category: 'Ops',
      state: 'Chosen',
      score: 6,
      effort: 2,
      metric: 6,
      textOne: 'Ops lead',
      textTwo: 'Renew on existing terms',
      date: '2026-04-10',
    },
  ],
};

const REFERENCE_DATE = '2026-04-24';
const COMPLETED_STATES = new Set(['Chosen', 'Parked']);

function daysUntil(date, referenceDate = REFERENCE_DATE) {
  const safeDate = safeISODate(date, referenceDate);
  const target = new Date(`${safeDate}T00:00:00Z`);
  const reference = new Date(`${referenceDate}T00:00:00Z`);
  return Math.round((target - reference) / 86400000);
}

function normalizeDecision(item) {
  return {
    title: boundedString(item.title, 120) || 'Untitled decision',
    owner: boundedString(item.textOne, 80),
    nextStep: boundedString(item.textTwo, 160),
    state: boundedString(item.state, 40) || 'Open',
    conviction: safeFiniteNumber(item.metric, 6),
    date: safeISODate(item.date, REFERENCE_DATE),
  };
}

function findIssues(decision) {
  const issues = [];
  if (!decision.owner) issues.push('missing owner');
  if (!decision.nextStep) issues.push('missing next step');
  if (!COMPLETED_STATES.has(decision.state) && daysUntil(decision.date) < 0) {
    issues.push(`overdue review (was due ${decision.date})`);
  }
  return issues;
}

async function loadBoard() {
  const filePath = process.argv[2];
  if (!filePath) return SAMPLE_BOARD;
  return JSON.parse(await readFile(filePath, 'utf8'));
}

const parsed = await loadBoard();
const result = sanitizeImportPayload(parsed);

if (!result.ok) {
  throw new Error('Expected a Decision Dock export object with an items array.');
}

const decisions = result.items.map(normalizeDecision);
const report = decisions
  .map((decision) => ({ decision, issues: findIssues(decision) }))
  .filter((entry) => entry.issues.length > 0);

console.log('Decision Dock board health check');
console.log(`Reference date: ${REFERENCE_DATE}`);
console.log(`Decisions checked: ${decisions.length}`);
console.log(`Issues found: ${report.length}`);

for (const { decision, issues } of report) {
  console.log(`- ${decision.title}: ${issues.join(', ')}`);
}

if (report.length === 0) {
  console.log('Board is healthy: every decision has an owner, a next step, and no overdue reviews.');
}

if (result.skipped.invalid || result.skipped.overflow) {
  console.log(
    `Skipped records: ${result.skipped.invalid} malformed, ${result.skipped.overflow} over import cap`,
  );
}

if (report.length > 0) {
  process.exitCode = 1;
}
