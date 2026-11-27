import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const load = () => {
  const js = ts.transpileModule(fs.readFileSync(new URL('../lib/loopPlayback.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {}; vm.runInNewContext(js, { exports, Number }); return exports;
};
const { createPlayTracker, defaultLoop } = load();
const play = (t, from, to, duration, step = 0.25) => { for (let x = from; x <= to + 1e-9; x += step) t.update(Math.min(x, duration), duration); };

test('loop defaults on for sleep items only', () => {
  assert.equal(defaultLoop('sleep'), true);
  for (const type of ['breathing', 'meditation', 'audio', '', null, undefined]) assert.equal(defaultLoop(type), false);
});

test('stopping before the first play-through ends is abandoned', () => {
  const t = createPlayTracker(); play(t, 0, 300, 600);
  assert.equal(t.fullPlay(600), false); assert.equal(t.stopOutcome(600), 'abandoned');
});

test('one full loop, then stopping mid-second loop, is completed (one session)', () => {
  const t = createPlayTracker(); play(t, 0, 599.9, 600); t.update(0.1, 600); play(t, 0.25, 120, 600);
  assert.ok(t.played > 700); assert.equal(t.stopOutcome(600), 'completed');
});

test('seeking forward to the end does not count as a full play', () => {
  const t = createPlayTracker(); play(t, 0, 10, 600); t.update(599, 600); t.update(599.5, 600); t.update(0.2, 600); play(t, 0.25, 5, 600);
  assert.equal(t.fullPlay(600), false); assert.equal(t.stopOutcome(600), 'abandoned');
  const s = createPlayTracker(); s.update(0, 600); s.update(0.25, 600, true); s.update(400, 600, true);
  assert.ok(s.played < 1);
});

test('a play-through whose last timeupdate is slightly early still counts; unknown duration never completes', () => {
  const t = createPlayTracker(); play(t, 0, 14.6, 15);
  assert.equal(t.stopOutcome(15), 'completed');
  assert.equal(createPlayTracker().stopOutcome(Number.NaN), 'abandoned');
});

test('library page renders the Loop toggle and wires loop, tracking and outcome into playback', () => {
  const src = fs.readFileSync(new URL('../app/library/page.tsx', import.meta.url), 'utf8');
  for (const needle of ['loop={loop}', 'onTimeUpdate=', 'setLoop(defaultLoop(detail.type))', 'finish(outcome())', 'stopOutcome(length.current)', '>Loop</label>'])
    assert.ok(src.includes(needle), needle);
  assert.ok(!src.includes("finish('abandoned')"), 'no unconditional abandon on stop');
});
