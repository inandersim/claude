/**
 * Yetki sınırı testleri: riskli dosya tespiti, yasak liste, izin listesi.
 * Çalıştır: node --test agents/selfheal/risk.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { matchGlob, classifyPath, assessChangeSet, findingRisk } from './lib/risk.mjs';

test('matchGlob: yıldız tek bölümde, çift yıldız klasörler arasında eşleşir', () => {
  assert.ok(matchGlob('src/**/*.ts', 'src/a.ts'));
  assert.ok(matchGlob('src/**/*.ts', 'src/a/b/c.ts'));
  assert.ok(!matchGlob('src/**/*.ts', 'src/a.tsx'));
  assert.ok(!matchGlob('src/*.ts', 'src/a/b.ts'), 'tek yıldız klasör ayırıcısını geçmemeli');
  assert.ok(matchGlob('**/*.pem', 'gizli.pem'), 'çift yıldız kök dosyayla da eşleşmeli');
  assert.ok(matchGlob('**/*.pem', 'a/b/gizli.pem'));
});

test('riskli dosya tespiti: ödeme, SOS ve kimlik alanları kategorilenir', () => {
  const odeme = classifyPath('src/domain/pricing.ts');
  assert.equal(odeme.risky, true);
  assert.deepEqual(odeme.riskCategories, ['odeme']);

  const sos = classifyPath('src/features/satellite/components/HoldSosButton.tsx');
  assert.equal(sos.risky, true);
  assert.deepEqual(sos.riskCategories, ['sos']);

  const kimlik = classifyPath('src/features/auth/store.ts');
  assert.equal(kimlik.risky, true);
  assert.deepEqual(kimlik.riskCategories, ['kimlik']);

  const sıradan = classifyPath('src/features/zmatch/hooks/useMatchFilters.ts');
  assert.equal(sıradan.risky, false);
  assert.equal(sıradan.allowed, true);
});

test('riskli dosya tespiti: dosya adına gömülü anahtar kelimeler de yakalanır', () => {
  assert.equal(classifyPath('src/features/kids/PaymentSheet.tsx').risky, true);
  assert.equal(classifyPath('src/features/fun/SosShortcut.tsx').risky, true);
  assert.equal(classifyPath('src/data/authClient.ts').risky, true);
});

test('yasak liste: sırlar, kilit dosyaları ve CI tanımları hiçbir koşulda değiştirilemez', () => {
  for (const p of ['.env', '.env.local', 'package-lock.json', 'package.json', 'app.json', 'eas.json', '.github/workflows/ci.yml', 'gizli/anahtar.pem']) {
    const c = classifyPath(p);
    assert.equal(c.denied, true, `${p} yasak olmalı`);
    assert.equal(c.allowed, false, `${p} izinli olmamalı`);
  }
});

test('self-modification lock: hat kendi kurallarını ve ajan talimatlarını değiştiremez', () => {
  assert.equal(classifyPath('agents/selfheal/lib/risk.mjs').denied, true);
  assert.equal(classifyPath('agents/selfheal/budgets.json').denied, true);
  assert.equal(classifyPath('.claude/agents/root-cause.md').denied, true);
  // AI CTO tüzüğü ve politikası da aynı kilidin altındadır: hat kendi
  // otonomi seviyesini, risk eşiklerini ya da kapılarını yükseltemez.
  assert.equal(classifyPath('agents/cto/policy.json').denied, true);
  assert.equal(classifyPath('agents/cto/lib/pipeline.mjs').denied, true);
  assert.equal(classifyPath('docs/AI_CTO.md').denied, true);
  // Diğer belgeler kilitli değil — kilit dar tutulmalı, yoksa hat
  // hiçbir belgeyi güncelleyemez hâle gelir.
  assert.equal(classifyPath('docs/ARCHITECTURE.md').denied, false);
});

test('izin listesi dışı yollar reddedilir (yasak olmasalar bile)', () => {
  const c = classifyPath('server/ai-gateway/index.ts');
  assert.equal(c.denied, false);
  assert.equal(c.allowed, false, 'server/ ALLOW listesinde değil');
});

test('klasör ipucu içindeki dosyalarla aynı şekilde sınıflanır', () => {
  assert.equal(classifyPath('src/features/zmatch/').allowed, true);
  assert.equal(classifyPath('src/features/satellite/').risky, true);
  assert.equal(classifyPath('.github/workflows/').denied, true);
});

test('assessChangeSet: tek bir yasak dosya tüm kümeyi reddeder', () => {
  const temiz = assessChangeSet(['src/features/zmatch/a.ts', 'src/domain/__tests__/a.test.ts']);
  assert.equal(temiz.ok, true);
  assert.equal(temiz.needsHuman, false);

  const kirli = assessChangeSet(['src/features/zmatch/a.ts', 'package-lock.json']);
  assert.equal(kirli.ok, false);
  assert.equal(kirli.denied.length, 1);
});

test('assessChangeSet: riskli dosya kümeyi geçerli bırakır ama insan onayı ister', () => {
  const r = assessChangeSet(['src/domain/emergency.ts']);
  assert.equal(r.ok, true, 'riskli dosya yasak değildir, sadece onay gerektirir');
  assert.equal(r.needsHuman, true);
  assert.deepEqual(r.riskCategories, ['sos']);
});

test('assessChangeSet: boş değişiklik kümesi geçerli sayılmaz', () => {
  assert.equal(assessChangeSet([]).ok, false);
});

test('findingRisk: riskli bulgu otomatik düzeltilebilir sayılmaz', () => {
  assert.equal(findingRisk({ files: ['src/domain/rescue.ts'] }).autoFixable, false);
  assert.equal(findingRisk({ files: ['src/features/tracks/x.ts'] }).autoFixable, true);
  assert.equal(findingRisk({ files: [] }).autoFixable, false, 'dosya bilinmiyorsa otomatik düzeltme yok');
});
