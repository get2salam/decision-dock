import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  IMPORT_LIMITS,
  boundedString,
  safeFiniteNumber,
  safeISODate,
  sanitizeImportPayload,
} from '../js/safe-input.js';

test('boundedString truncates over-long strings', () => {
  const long = 'a'.repeat(IMPORT_LIMITS.maxFieldLength + 50);
  const result = boundedString(long);
  assert.equal(result.length, IMPORT_LIMITS.maxFieldLength);
});

test('boundedString returns empty string for null, undefined, and non-string objects', () => {
  assert.equal(boundedString(null), '');
  assert.equal(boundedString(undefined), '');
  assert.equal(boundedString({}), '');
  assert.equal(boundedString([]), '');
  assert.equal(boundedString(NaN), '');
  assert.equal(boundedString(Infinity), '');
});

test('boundedString stringifies finite numbers', () => {
  assert.equal(boundedString(42), '42');
  assert.equal(boundedString(0), '0');
});

test('boundedString honors a custom max length', () => {
  assert.equal(boundedString('hello world', 5), 'hello');
});

test('safeFiniteNumber falls back for non-finite values', () => {
  assert.equal(safeFiniteNumber('5', 0), 5);
  assert.equal(safeFiniteNumber('not a number', 7), 7);
  assert.equal(safeFiniteNumber(NaN, 7), 7);
  assert.equal(safeFiniteNumber(Infinity, 7), 7);
  assert.equal(safeFiniteNumber(null, 7), 7);
  assert.equal(safeFiniteNumber(undefined, 7), 7);
});

test('safeISODate accepts valid ISO calendar dates', () => {
  assert.equal(safeISODate('2026-04-25'), '2026-04-25');
  assert.equal(safeISODate('2026-02-28'), '2026-02-28');
});

test('safeISODate rejects malformed and impossible dates', () => {
  assert.equal(safeISODate('foo', '2026-01-01'), '2026-01-01');
  assert.equal(safeISODate('2026-13-01', '2026-01-01'), '2026-01-01');
  assert.equal(safeISODate('2026-02-30', '2026-01-01'), '2026-01-01');
  assert.equal(safeISODate('2026/04/25', '2026-01-01'), '2026-01-01');
  assert.equal(safeISODate('', '2026-01-01'), '2026-01-01');
  assert.equal(safeISODate(null, '2026-01-01'), '2026-01-01');
  assert.equal(safeISODate(undefined, '2026-01-01'), '2026-01-01');
});

test('sanitizeImportPayload rejects non-object payloads', () => {
  assert.equal(sanitizeImportPayload(null).ok, false);
  assert.equal(sanitizeImportPayload([]).ok, false);
  assert.equal(sanitizeImportPayload('hello').ok, false);
  assert.equal(sanitizeImportPayload(42).ok, false);
});

test('sanitizeImportPayload accepts an empty object', () => {
  const result = sanitizeImportPayload({});
  assert.equal(result.ok, true);
  assert.deepEqual(result.items, []);
  assert.deepEqual(result.ui, {});
  assert.deepEqual(result.skipped, { invalid: 0, overflow: 0 });
});

test('sanitizeImportPayload skips non-object items and reports the count', () => {
  const result = sanitizeImportPayload({
    items: [{ title: 'ok' }, null, 'bad', 42, [], { title: 'also ok' }],
  });
  assert.equal(result.items.length, 2);
  assert.equal(result.skipped.invalid, 4);
  assert.equal(result.skipped.overflow, 0);
});

test('sanitizeImportPayload caps the item count and counts the overflow', () => {
  const huge = Array.from({ length: IMPORT_LIMITS.maxImportItems + 25 }, (_, idx) => ({
    title: `t${idx}`,
  }));
  const result = sanitizeImportPayload({ items: huge });
  assert.equal(result.items.length, IMPORT_LIMITS.maxImportItems);
  assert.equal(result.skipped.overflow, 25);
  assert.equal(result.skipped.invalid, 0);
});

test('sanitizeImportPayload ignores ui that is not a plain object', () => {
  assert.deepEqual(sanitizeImportPayload({ ui: 'nope' }).ui, {});
  assert.deepEqual(sanitizeImportPayload({ ui: [] }).ui, {});
  assert.deepEqual(sanitizeImportPayload({ ui: { search: 'kept' } }).ui, { search: 'kept' });
});

test('sanitizeImportPayload honors a custom maxItems option', () => {
  const result = sanitizeImportPayload({ items: [{}, {}, {}, {}] }, { maxItems: 2 });
  assert.equal(result.items.length, 2);
  assert.equal(result.skipped.overflow, 2);
});
