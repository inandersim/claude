import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { MAX_BYTES, SAMPLE_RATE, SOUNDS, encodeWav, generateAll, toPcm16 } from './generate.mjs';

test('WAV başlığı: RIFF/WAVE, PCM mono 16-bit 22.05 kHz', () => {
  const pcm = toPcm16(new Float64Array(SAMPLE_RATE));
  const wav = encodeWav(pcm);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.toString('ascii', 12, 16), 'fmt ');
  assert.equal(wav.readUInt16LE(20), 1);
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), SAMPLE_RATE);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.toString('ascii', 36, 40), 'data');
  assert.equal(wav.readUInt32LE(40), pcm.length * 2);
  assert.equal(wav.readUInt32LE(4), wav.length - 8);
});

test('sekiz ses üretilir, her biri ≤ 200 KB ve süreleri doğru', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zirve-sounds-'));
  const report = generateAll(dir);
  assert.equal(report.length, 8);
  const expected = {
    'air_horn.wav': 3,
    'siren.wav': 4,
    'whistle.wav': 2,
    'shout.wav': 2,
    'clap.wav': 2,
    'metal_clang.wav': 2,
    'ultrasonic.wav': 3,
    'stomp.wav': 2,
  };
  for (const { name, bytes } of report) {
    assert.ok(bytes <= MAX_BYTES, `${name} ${bytes} bayt`);
    const wav = readFileSync(join(dir, name));
    const seconds = wav.readUInt32LE(40) / 2 / SAMPLE_RATE;
    assert.equal(Math.round(seconds), expected[name], name);
    assert.ok(name in SOUNDS);
  }
});

test('sesler sessiz değil ve normalize', () => {
  for (const [name, make] of Object.entries(SOUNDS)) {
    const pcm = toPcm16(make());
    let peak = 0;
    for (const v of pcm) peak = Math.max(peak, Math.abs(v));
    assert.ok(peak > 20000 && peak <= 32767, `${name} tepe ${peak}`);
  }
});
