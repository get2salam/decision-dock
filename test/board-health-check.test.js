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
const healthScript = fileURLToPath(new URL('../examples/board-health-check.mjs', import.meta.url));

async function runHealthCheck(args = []) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [healthScript, ...args], {
      cwd: repoRoot,
    });
    assert.equal(stderr, '');
    return { lines: stdout.trim().split('\n'), exitCode: 0 };
  } catch (error) {
    assert.equal(error.stderr, '');
    return { lines: error.stdout.trim().split('\n'), exitCode: error.code };
  }
}

test('board health check flags the sample board issues and exits non-zero', async () => {
  const { lines, exitCode } = await runHealthCheck();

  assert.deepEqual(lines, [
    'Decision Dock board health check',
    'Reference date: 2026-04-24',
    'Decisions checked: 4',
    'Issues found: 2',
    '- Pricing model for early users: missing owner',
    '- When to hire the first helper: missing next step, overdue review (was due 2026-04-20)',
  ]);
  assert.equal(exitCode, 1);
});

test('board health check reports a clean board and exits zero', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'decision-dock-health-'));
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
            date: '2026-04-30',
          },
          null,
        ],
      }),
    );

    const { lines, exitCode } = await runHealthCheck([exportPath]);

    assert.deepEqual(lines, [
      'Decision Dock board health check',
      'Reference date: 2026-04-24',
      'Decisions checked: 1',
      'Issues found: 0',
      'Board is healthy: every decision has an owner, a next step, and no overdue reviews.',
      'Skipped records: 1 malformed, 0 over import cap',
    ]);
    assert.equal(exitCode, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
