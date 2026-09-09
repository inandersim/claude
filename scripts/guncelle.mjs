#!/usr/bin/env node
/**
 * Yerel kopyayı günceller.
 *
 *   npm run guncelle              # çek, gerekiyorsa kur, doğrula
 *   npm run guncelle -- --sessiz  # yalnızca değişiklik varsa konuş
 *   npm run guncelle -- --hizli   # doğrulamayı atla
 *
 * Güvenli tarafta durur ve **hiçbir zaman kullanıcının işini ezmez**:
 *
 *   · kaydedilmemiş değişiklik varsa durur (çıkış 2),
 *   · yanlış daldaysa durur,
 *   · yalnızca ileri sarma (fast-forward) yapar — birleştirme çatışması üretmez,
 *   · hiçbir şey değişmediyse hiçbir şey yapmaz.
 *
 * Tek uygulama burada; `guncelle.ps1` yalnızca Windows'a özgü işi (zamanlanmış
 * görev kaydı) yapar ve bu betiği çağırır. Aynı mantığı iki dilde yazmak, ikisi
 * zamanla ayrışacağı için tercih edilmedi.
 *
 * Çıkış kodları: 0 güncel/güncellendi · 1 hata · 2 kaydedilmemiş değişiklik.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VARSAYILAN_DAL = 'claude/outdoor-adventure-social-app-du8h5t';

const argv = process.argv.slice(2);
const bayrak = (ad) => argv.includes(`--${ad}`);
const secenek = (ad, varsayilan) => {
  const eq = argv.find((a) => a.startsWith(`--${ad}=`));
  if (eq) return eq.slice(ad.length + 3);
  const i = argv.indexOf(`--${ad}`);
  if (i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  return varsayilan;
};

let sessiz = bayrak('sessiz');
const hizli = bayrak('hizli');
const kok = resolve(secenek('klasor', ROOT));
const dal = secenek('dal', VARSAYILAN_DAL);

const yaz = (m) => {
  if (!sessiz) console.log(m);
};
const basli = (m) => yaz(`\n-- ${m} ${'-'.repeat(Math.max(0, 58 - m.length))}`);
const tamam = (m) => yaz(`  [tamam] ${m}`);
const bilgi = (m) => yaz(`  ${m}`);
const uyari = (m) => console.warn(`  [uyarı] ${m}`);
const hata = (m) => console.error(`  [hata]  ${m}`);

/**
 * Her koşumun tek satırlık kaydı.
 *
 * **Neden gerekti:** zamanlanmış görev `--sessiz --hizli` ile çalışıyor.
 * Betik güvenli tarafta durduğunda (kaydedilmemiş değişiklik → çıkış 2,
 * yanlış dal → çıkış 1) ekrana bir şey basmıyor ve görev de sessizce
 * "başarısız" oluyordu. Sonuç: kullanıcı günlerce güncellenmediğini fark
 * ediyor ama **sebebini görecek hiçbir yer yok.**
 *
 * Dosya proje kökünde `guncelle.log`; son 200 satır tutulur.
 */
const GUNLUK = join(kok, 'guncelle.log');
const GUNLUK_SATIR = 200;

function gunlukle(durum, ayrinti = '') {
  try {
    const satir = `${new Date().toISOString()}  ${durum}${ayrinti ? `  ${ayrinti}` : ''}\n`;
    appendFileSync(GUNLUK, satir, 'utf8');
    // Dosya sınırsız büyümesin; kırpma ucuz ve nadiren gerekir.
    const mevcut = readFileSync(GUNLUK, 'utf8').split('\n');
    if (mevcut.length > GUNLUK_SATIR * 2) {
      writeFileSync(GUNLUK, mevcut.slice(-GUNLUK_SATIR).join('\n'), 'utf8');
    }
  } catch {
    // Günlük yazılamıyorsa güncelleme yine de sürsün; bu bir teşhis aracı.
  }
}

/** Çıkışları tek yerden geçir ki hiçbir sonuç kayıtsız kalmasın. */
function cik(kod, durum, ayrinti = '') {
  gunlukle(durum, ayrinti);
  process.exit(kod);
}

/** Komutu çalıştırır; çıktı ve çıkış kodunu döner (asla fırlatmaz). */
function calistir(komut, args, { cwd = kok } = {}) {
  const r = spawnSync(komut, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
  return { kod: r.status ?? 1, cikti: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

const git = (...args) => calistir('git', args);

/** Başarısızsa çıkar; git'in hata metnini gizlemez. */
function gitZorunlu(...args) {
  const r = git(...args);
  if (r.kod !== 0) {
    hata(`git ${args.join(' ')} başarısız`);
    if (r.cikti) console.error(`    ${r.cikti.split('\n').slice(0, 5).join('\n    ')}`);
    cik(1, 'HATA', `git ${args.join(' ')}`);
  }
  return r.cikti;
}

/**
 * Ağ hatasında üstel bekleyerek tekrar dener (2s, 4s, 8s, 16s).
 * Kimlik doğrulama hatası ağ hatası değildir; tekrar denemek anlamsızdır.
 */
function fetchDene() {
  for (let deneme = 1; deneme <= 4; deneme += 1) {
    const r = git('fetch', 'origin', dal);
    if (r.kod === 0) return true;
    if (/authentication|permission denied|could not read/i.test(r.cikti)) {
      hata('Depoya erişim reddedildi — kimlik bilgilerini kontrol et.');
      return false;
    }
    const bekle = 2 ** deneme;
    uyari(`Ağ hatası — ${bekle} saniye sonra tekrar denenecek (${deneme}/4)`);
    // Eş zamanlı bekleme: bu betik tek iş yapar, karmaşıklık eklemeye değmez.
    spawnSync(process.execPath, ['-e', `setTimeout(()=>{}, ${bekle * 1000})`]);
  }
  hata('Depoya ulaşılamadı.');
  return false;
}

function npmCalistir(args, cwd, aciklama) {
  bilgi(`${aciklama}...`);
  const r = calistir('npm', args, { cwd });
  if (r.kod !== 0) {
    hata(`${aciklama} başarısız`);
    const satirlar = r.cikti.split('\n').filter((l) => /npm error|ERR!/.test(l)).slice(0, 20);
    for (const l of satirlar) console.error(`    ${l}`);
    cik(1, 'HATA', aciklama);
  }
  tamam(aciklama);
}

/* ------------------------------------------------------------------ */

if (!existsSync(join(kok, '.git'))) {
  hata(`Bu bir git deposu değil: ${kok}`);
  cik(1, 'HATA', `git deposu değil: ${kok}`);
}

basli('Yerel durum');

const mevcutDal = gitZorunlu('rev-parse', '--abbrev-ref', 'HEAD');
if (mevcutDal !== dal) {
  hata(`Farklı daldasın: ${mevcutDal} (beklenen: ${dal})`);
  bilgi(`Geçmek için: git checkout ${dal}`);
  cik(1, 'DURDU', `yanlış dal: ${mevcutDal} (beklenen ${dal})`);
}

// Kaydedilmemiş değişiklik varsa hiçbir şey yapma: `git merge` bunları taşımaya
// çalışır ve yarım kalmış bir işi bozabilir. Durmak, kurtarmaktan ucuzdur.
const kirli = gitZorunlu('status', '--porcelain');
if (kirli) {
  uyari('Kaydedilmemiş değişikliğin var — güncelleme atlandı.');
  for (const l of kirli.split('\n').slice(0, 10)) console.warn(`    ${l}`);
  console.warn('  Önce kaydet (git add -A && git commit) ya da geri al (git stash).');
  cik(2, 'DURDU', 'kaydedilmemiş değişiklik var');
}

basli('Uzak değişiklikler');

const oncekiCommit = gitZorunlu('rev-parse', 'HEAD');
if (!fetchDene()) cik(1, 'HATA', 'git fetch başarısız (ağ?)');

const uzakCommit = gitZorunlu('rev-parse', `origin/${dal}`);
if (oncekiCommit === uzakCommit) {
  tamam('Zaten güncel.');
  cik(0, 'GÜNCEL');
}

// Buradan sonra gerçekten bir değişiklik var; sessiz kipte bile konuşulmalı,
// yoksa zamanlanmış görev sessizce güncelleme yapar ve kimse fark etmez.
sessiz = false;

const yeniSayisi = gitZorunlu('rev-list', '--count', `${oncekiCommit}..${uzakCommit}`);
bilgi(`${yeniSayisi} yeni commit:`);
for (const l of gitZorunlu('log', '--oneline', '--no-decorate', `${oncekiCommit}..${uzakCommit}`)
  .split('\n')
  .slice(0, 15)) {
  console.log(`    ${l}`);
}

const degisenler = gitZorunlu('diff', '--name-only', `${oncekiCommit}..${uzakCommit}`).split('\n');

const ff = git('merge', '--ff-only', `origin/${dal}`);
if (ff.kod !== 0) {
  hata('İleri sarma yapılamadı — yerel geçmiş uzaktan ayrılmış.');
  bilgi('Elle çözmek gerekiyor: git status');
  cik(1, 'DURDU', 'ileri sarma yapılamadı (geçmiş ayrışmış)');
}
tamam(`Güncellendi: ${uzakCommit.slice(0, 7)}`);

/**
 * Bağımlılık kurulumu dakikalar sürer ve çoğu güncellemede gereksizdir; yalnızca
 * ilgili `package.json` / kilit dosyası bu aralıkta değiştiyse çalıştırılır.
 */
const ALT_PAKETLER = [
  { yol: '.', ad: 'Ana uygulama', on: '' },
  { yol: 'admin', ad: 'Yönetim paneli', on: 'admin/' },
  { yol: 'server/ai-gateway', ad: 'AI ağ geçidi', on: 'server/ai-gateway/' },
  { yol: 'agents/marketing', ad: 'Pazarlama ajanları', on: 'agents/marketing/' },
];

const kurulacak = ALT_PAKETLER.filter((p) => {
  if (!existsSync(join(kok, p.yol, 'package.json'))) return false;
  return degisenler.some((d) => {
    if (!/package(-lock)?\.json$/.test(d)) return false;
    // Kök paket: yolun içinde `/` olmamalı; alt paket: kendi ön ekiyle başlamalı.
    return p.on === '' ? !d.includes('/') : d.startsWith(p.on);
  });
});

if (kurulacak.length) {
  basli('Bağımlılıklar');
  for (const p of kurulacak) {
    npmCalistir(['install', '--no-audit', '--no-fund'], join(kok, p.yol), p.ad);
  }
} else {
  bilgi('Bağımlılık değişmemiş — npm install atlandı.');
}

if (!hizli) {
  basli('Doğrulama');
  npmCalistir(['run', 'typecheck'], kok, 'Tip denetimi');
  npmCalistir(['test', '--', '--ci', '--silent'], kok, 'Testler');
}

console.log('\n  Güncelleme tamam.');
console.log('  Metro çalışıyorsa yeniden başlat: npm run web\n');
gunlukle('GÜNCELLENDİ', `${oncekiCommit.slice(0, 7)} → ${uzakCommit.slice(0, 7)}`);
