#!/usr/bin/env node
/**
 * Kaçırma sesleri üretici — bağımlılıksız, 16-bit mono 22.05 kHz WAV.
 * Kullanım: `node tools/sounds/generate.mjs [çıktı-dizini]` (varsayılan: assets/sounds)
 */
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SAMPLE_RATE = 22050;
export const MAX_BYTES = 200 * 1024;

const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                          */
/* ------------------------------------------------------------------ */

/** Deterministik sözde rastgele (aynı dosya her üretimde bit düzeyinde aynı). */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

function buffer(seconds) {
  return new Float64Array(Math.round(seconds * SAMPLE_RATE));
}

/** Basit doğrusal zarf (saniye cinsinden başlangıç/bitiş). */
function envelope(i, n, attack = 0.01, release = 0.05) {
  const a = Math.min(1, i / (attack * SAMPLE_RATE));
  const r = Math.min(1, (n - i) / (release * SAMPLE_RATE));
  return Math.min(a, r);
}

/** Tepe değeri normalize eder (0.95) ve 16-bit PCM'e çevirir. */
export function toPcm16(samples, peak = 0.95) {
  let max = 0;
  for (const v of samples) max = Math.max(max, Math.abs(v));
  const gain = max > 0 ? peak / max : 1;
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.max(-1, Math.min(1, samples[i] * gain));
    out[i] = Math.round(v * 32767);
  }
  return out;
}

/** RIFF/WAVE başlığı + PCM verisi. */
export function encodeWav(pcm, sampleRate = SAMPLE_RATE) {
  const dataBytes = pcm.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // fmt chunk boyutu
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < pcm.length; i += 1) buf.writeInt16LE(pcm[i], 44 + i * 2);
  return buf;
}

/* ------------------------------------------------------------------ */
/* Sesler                                                               */
/* ------------------------------------------------------------------ */

/** 3 sn, 380 Hz testere + 2–4. harmonikler, hafif vibrato. */
export function airHorn() {
  const s = buffer(3);
  const n = s.length;
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    const f = 380 * (1 + 0.012 * Math.sin(TAU * 5.5 * t));
    phase += (TAU * f) / SAMPLE_RATE;
    const saw = 2 * ((phase / TAU) % 1) - 1;
    let v = saw;
    for (let h = 2; h <= 4; h += 1) v += Math.sin(phase * h) / h;
    s[i] = v * envelope(i, n, 0.03, 0.15);
  }
  return s;
}

/** 4 sn, 600↔1200 Hz üçgen sweep (her yarım saniyede yön değiştirir). */
export function siren() {
  const s = buffer(4);
  const n = s.length;
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    const tri = Math.abs(((t * 1.0) % 1) * 2 - 1); // 0..1..0 her saniye
    const f = 600 + 600 * tri;
    phase += (TAU * f) / SAMPLE_RATE;
    s[i] = (Math.sin(phase) + 0.3 * Math.sin(2 * phase)) * envelope(i, n, 0.02, 0.1);
  }
  return s;
}

/** 2 sn, 3 kHz + 3.1 kHz vuru (beat). */
export function whistle() {
  const s = buffer(2);
  const n = s.length;
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    s[i] = (Math.sin(TAU * 3000 * t) + Math.sin(TAU * 3100 * t)) * 0.5 * envelope(i, n, 0.02, 0.1);
  }
  return s;
}

/** 2 sn, 150–250 Hz gürültülü formant benzeri patlama ×3. */
export function shout() {
  const s = buffer(2);
  const n = s.length;
  const rnd = rng(7);
  const bursts = [0.05, 0.7, 1.35];
  const len = 0.5 * SAMPLE_RATE;
  for (const start of bursts) {
    const s0 = Math.round(start * SAMPLE_RATE);
    let phase = 0;
    let noise = 0;
    for (let i = 0; i < len && s0 + i < n; i += 1) {
      const p = i / len;
      const f0 = 150 + 100 * Math.sin(Math.PI * p);
      phase += (TAU * f0) / SAMPLE_RATE;
      // Harmonikçe zengin ses teli + formant bandında süzülmüş gürültü
      let v = 0;
      for (let h = 1; h <= 8; h += 1) v += Math.sin(phase * h) / (h * 0.8);
      noise = 0.85 * noise + 0.15 * (rnd() * 2 - 1);
      const formant = Math.sin(TAU * 700 * (i / SAMPLE_RATE)) * noise * 2.5;
      const env = Math.sin(Math.PI * p) ** 0.6;
      s[s0 + i] += (v + formant) * env;
    }
  }
  return s;
}

/** 2 sn, 6 kısa beyaz gürültü patlaması (alkış). */
export function clap() {
  const s = buffer(2);
  const n = s.length;
  const rnd = rng(11);
  const len = Math.round(0.08 * SAMPLE_RATE);
  for (let k = 0; k < 6; k += 1) {
    const s0 = Math.round((0.05 + k * 0.3) * SAMPLE_RATE);
    for (let i = 0; i < len && s0 + i < n; i += 1) {
      const decay = Math.exp(-i / (0.012 * SAMPLE_RATE));
      s[s0 + i] += (rnd() * 2 - 1) * decay;
    }
  }
  return s;
}

/** 2 sn, inharmonik kısmi tonlar 800/1330/2100/3500 Hz, hızlı sönüm ×4. */
export function metalClang() {
  const s = buffer(2);
  const n = s.length;
  const partials = [800, 1330, 2100, 3500];
  for (let k = 0; k < 4; k += 1) {
    const s0 = Math.round(k * 0.45 * SAMPLE_RATE);
    const len = Math.round(0.45 * SAMPLE_RATE);
    for (let i = 0; i < len && s0 + i < n; i += 1) {
      const t = i / SAMPLE_RATE;
      let v = 0;
      partials.forEach((f, idx) => {
        v += (Math.sin(TAU * f * t) * Math.exp(-t * (6 + idx * 4))) / (idx + 1);
      });
      s[s0 + i] += v;
    }
  }
  return s;
}

/** 3 sn, 19–20 kHz sweep (22.05 kHz örneklemede Nyquist altı). */
export function ultrasonic() {
  const s = buffer(3);
  const n = s.length;
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    const f = 19000 + 1000 * (0.5 + 0.5 * Math.sin(TAU * 2 * t));
    phase += (TAU * f) / SAMPLE_RATE;
    s[i] = Math.sin(phase) * envelope(i, n, 0.05, 0.05);
  }
  return s;
}

/** 2 sn, 60–90 Hz darbeler (yere vurma). */
export function stomp() {
  const s = buffer(2);
  const n = s.length;
  const rnd = rng(23);
  for (let k = 0; k < 5; k += 1) {
    const s0 = Math.round((0.05 + k * 0.38) * SAMPLE_RATE);
    const len = Math.round(0.3 * SAMPLE_RATE);
    let phase = 0;
    for (let i = 0; i < len && s0 + i < n; i += 1) {
      const t = i / SAMPLE_RATE;
      const f = 90 - 30 * Math.min(1, t / 0.15);
      phase += (TAU * f) / SAMPLE_RATE;
      const thump = Math.sin(phase) * Math.exp(-t * 12);
      const click = (rnd() * 2 - 1) * Math.exp(-t * 90) * 0.4;
      s[s0 + i] += thump + click;
    }
  }
  return s;
}

export const SOUNDS = {
  'air_horn.wav': airHorn,
  'siren.wav': siren,
  'whistle.wav': whistle,
  'shout.wav': shout,
  'clap.wav': clap,
  'metal_clang.wav': metalClang,
  'ultrasonic.wav': ultrasonic,
  'stomp.wav': stomp,
};

/** Tüm sesleri üretir; `{ name, bytes }` listesi döner. */
export function generateAll(outDir) {
  mkdirSync(outDir, { recursive: true });
  const report = [];
  for (const [name, make] of Object.entries(SOUNDS)) {
    const wav = encodeWav(toPcm16(make()));
    if (wav.length > MAX_BYTES) throw new Error(`${name} çok büyük: ${wav.length} bayt`);
    writeFileSync(join(outDir, name), wav);
    report.push({ name, bytes: statSync(join(outDir, name)).size });
  }
  return report;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(process.argv[2] ?? join(here, '..', '..', 'assets', 'sounds'));
  const report = generateAll(outDir);
  for (const r of report) console.log(`${r.name.padEnd(18)} ${(r.bytes / 1024).toFixed(1)} KB`);
  console.log(`→ ${outDir}`);
}
