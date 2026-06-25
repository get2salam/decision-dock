import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const briefingScript = fileURLToPath(new URL('../examples/review-briefing.mjs', import.meta.url));

async function runBriefing(args = []) {
  const { stdout, stderr } = await execFileAsync(process.execPath, [briefingScript, ...args], {
    cwd: repoRoot,
  });
  assert.equal(stderr, '');
  return stdout.trim().split('\n');
}

test('review briefing example prints deterministic sample priorities', async () => {
  const lines = await runBriefing();

  assert.deepEqual(lines.slice(0, 5), [
    'Decision Dock review briefing',
    'Reference date: 2026-04-24',
    'Active decisions: 2',
    '1. Static site vs richer app first — Founder; Choose the faster trust path; due in 1d; priority 94',
    '2. When to hire the first helper — Founder; Define trigger points; due in 5d; priority 50',
  ]);
});

test('review briefing example accepts exported JSON and reports skipped records', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'decision-dock-briefing-'));
  const exportPath = join(dir, 'export.json');

  try {
    await writeFile(
      exportPath,
      JSON.stringify({
        items: [
          {
            title: 'Refresh onboarding decision',
            state: 'Open',
            score: 8,
            effort: 2,
            metric: 6,
            textOne: 'Ops lead',
            textTwo: 'Pick one rollout path',
            date: '2026-04-23',
          },
          null,
          'bad row',
        ],
      }),
    );

    const lines = await runBriefing([exportPath]);

    assert.equal(lines[2], 'Active decisions: 1');
    assert.equal(
      lines[3],
      '1. Refresh onboarding decision — Ops lead; Pick one rollout path; due now; priority 89',
    );
    assert.equal(lines[4], 'Skipped records: 2 malformed, 0 over import cap');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
