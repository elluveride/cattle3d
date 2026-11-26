import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseMemberLines } from '../src/domain/members.js';
import { parsePresets, formatPresets } from '../src/domain/presets.js';
import { expandSchedule } from '../src/domain/schedule.js';
import { generateCode, isValidCode } from '../src/domain/codes.js';
import { sha256 } from '../src/domain/sha256.js';
import { hashPin, verifyPin, isValidPin } from '../src/domain/pin.js';

test('member lines: optional subteam after a comma, blanks skipped', () => {
  assert.deepEqual(parseMemberLines('Ava R., Programming\n\n  Ben T.  \nCy, Build, Pit', 'Build'), [
    { name: 'Ava R.', subteam: 'Programming' },
    { name: 'Ben T.', subteam: 'Build' },
    { name: 'Cy', subteam: 'Build, Pit' },
  ]);
});

test('behavior presets round-trip and skip junk', () => {
  const { presets, skipped } = parsePresets('Helped out | +5\nTools left | -3\nno points here\nZero | 0');
  assert.deepEqual(presets, [{ label: 'Helped out', delta: 5 }, { label: 'Tools left', delta: -3 }]);
  assert.equal(skipped, 2);
  assert.deepEqual(parsePresets(formatPresets(presets)).presets, presets);
});

test('weekly schedule expands from the start date', () => {
  assert.deepEqual(expandSchedule({ startDate: '2026-03-04', weekdays: [1, 3], weeks: 2 }), [
    '2026-03-04', '2026-03-09', '2026-03-11', '2026-03-16',
  ]);
  assert.deepEqual(expandSchedule({ startDate: '2026-03-04' }), ['2026-03-04']);
});

test('check-in codes are 4 digits and avoid taken ones', () => {
  const taken = Array.from({ length: 8999 }, (_, i) => String(1000 + i));
  assert.equal(generateCode(taken, () => 0), '9999');
  assert.ok(isValidCode(generateCode([])));
  assert.equal(isValidCode('12a4'), false);
});

test('sha256 matches known vectors and node:crypto', () => {
  assert.equal(sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  for (let n = 0; n < 150; n++) {
    const input = `${'x'.repeat(n)}✓é`;
    assert.equal(sha256(input), createHash('sha256').update(input).digest('hex'));
  }
});

test('PINs: 4-8 digits, verified against salted hash', () => {
  const admin = { salt: 'pepper', hash: hashPin('2468', 'pepper') };
  assert.equal(verifyPin(admin, '2468'), true);
  assert.equal(verifyPin(admin, '1357'), false);
  assert.equal(verifyPin(null, '2468'), false);
  assert.equal(isValidPin('123'), false);
  assert.equal(isValidPin('12345678'), true);
});
