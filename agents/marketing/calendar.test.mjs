import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildCalendar, expandPhases, PHASES, repurposingMarkdown, WEEKLY_CADENCE } from './calendar.mjs';
import { CHANNEL_IDS } from './channels/index.mjs';
import { minutesOf, parseDate } from './lib/dates.mjs';

const cal = buildCalendar({ start: '2026-10-05', weeks: 12, launchWeek: 5 });

test('12 hafta, doğru tarihler ve faz sırası', () => {
  assert.equal(cal.weeks.length, 12);
  assert.equal(cal.startDate, '2026-10-05');
  assert.equal(cal.weeks[0].startDate, '2026-10-05');
  assert.equal(cal.weeks[11].startDate, '2026-12-21');
  for (const w of cal.weeks) {
    assert.equal(parseDate(w.startDate).getUTCDay(), 1, `${w.week}. hafta Pazartesi başlamalı`);
    assert.ok(w.theme.length > 10 && w.goal.length > 10);
    assert.ok(w.kpi.length >= 2 && w.tasks.length >= 3);
  }
});

test('lansman haftası ve lansman günü', () => {
  const launch = cal.weeks.find((w) => w.isLaunchWeek);
  assert.equal(launch.week, 5);
  assert.equal(cal.launchDate, '2026-11-03');
  const launchSlots = launch.slots.filter((s) => s.launchDay);
  assert.equal(launchSlots.length, 10, 'her kanal için bir lansman slotu');
  assert.deepEqual([...new Set(launchSlots.map((s) => s.channel))].sort(), [...CHANNEL_IDS].sort());
  assert.ok(launchSlots.every((s) => s.date === cal.launchDate));
  assert.ok(launchSlots.every((s) => s.note && s.note.length > 5));
});

test('faz iskeleti lansman haftasını kaydırır', () => {
  const shifted = expandPhases(12, 3);
  assert.equal(shifted[2].id, 'launch');
  assert.equal(expandPhases(12, 5)[4].id, 'launch');
  assert.equal(PHASES.reduce((a, p) => a + p.weeks, 0), 12);
});

test('slotlar kanal kadansına uyar ve tarihe göre sıralıdır', () => {
  for (const w of cal.weeks) {
    for (const id of CHANNEL_IDS) {
      const slots = w.slots.filter((s) => s.channel === id && !s.launchDay);
      assert.equal(slots.length, WEEKLY_CADENCE[id], `${w.week}. hafta ${id}`);
    }
    for (let i = 1; i < w.slots.length; i += 1) {
      const a = w.slots[i - 1];
      const b = w.slots[i];
      assert.ok(a.date < b.date || (a.date === b.date && minutesOf(a.time) <= minutesOf(b.time)), 'sıralama');
    }
    for (const s of w.slots) {
      assert.ok(s.date >= w.startDate && s.date <= w.endDate, 'slot hafta içinde');
      assert.match(s.time, /^\d{2}:\d{2}$/u);
      assert.ok(s.title.length > 5 && s.contentId.length > 3);
    }
  }
});

test('toplam slot sayısı ve dil dağılımı', () => {
  const weekly = Object.values(WEEKLY_CADENCE).reduce((a, b) => a + b, 0);
  assert.equal(cal.totalSlots, weekly * 12 + 10);
  const langs = new Set(cal.weeks.flatMap((w) => w.slots.map((s) => s.lang)));
  assert.ok(langs.has('tr') && langs.has('en') && langs.has('ru'));
});

test('yeniden kullanım belgesi iki zincir tanımlar', () => {
  const md = repurposingMarkdown();
  assert.match(md, /bir çekim, sekiz çıktı/u);
  assert.match(md, /tiktok/u);
  assert.match(md, /pinterest/u);
  assert.match(md, /## Metin içerikler için zincir/u);
});
