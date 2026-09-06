# Zirtan web sitesi

Sıfır bağımlılıklı statik site üreticisi (Node 22). Uygulamanın tohum verilerinden (`src/data/mock/seed*.ts`,
`src/domain/pricing.ts`, `src/domain/rescue.ts`) rota, destinasyon, kütüphane, tırmanış, kurs ve plan sayfalarını
TR (`/`) ve EN (`/en/`) olarak üretir; GitHub Pages ya da Cloudflare Pages'e dağıtılır.

```
website/
├── build.mjs                # sayfa kaydı, GPX, sitemap, robots, manifest, statik dosyalar → dist/
├── serve.mjs                # geliştirme sunucusu (temiz URL + 404)
├── scripts/
│   ├── export-data.mjs      # TS tohumları → src/data/generated/*.json
│   ├── ts-loader.mjs        # `@/` takma adı ve uzantısız .ts çözümleyici (Node module hook)
│   ├── check-links.mjs      # dist içi kırık bağlantı / fragment / sitemap taraması
│   ├── screenshots.mjs      # Playwright ile masaüstü + mobil ekran görüntüleri
│   └── og-image.mjs         # public/img/og-default.png üretimi (Playwright)
├── src/
│   ├── templates/*.js       # template-literal şablonlar (layout, components, home, routes, …)
│   ├── i18n/{tr,en}.json    # arayüz metinleri (TR kaynak)
│   ├── data/fallback/*.json # tohum yüklenemezse kullanılan örnek veri
│   ├── data/generated/      # export çıktısı (git'e girmez)
│   ├── styles.css           # tek CSS: değişkenler, açık/koyu tema, grid
│   └── client/site.js       # gezinme, tema, filtreler, bekleme listesi, tembel Leaflet
├── public/                  # olduğu gibi kopyalanır (ekran görüntüleri, OG görseli)
└── dist/                    # çıktı
```

## Geliştirme

```bash
cd website
npm run build        # export + build → dist/
npm run dev          # http://localhost:8140 (dist/ sunar)
npm run check        # kırık iç bağlantı taraması
npm run shots        # .cache/shots/*.png (Playwright gerekir)
```

Kökten biçim denetimi: `npx prettier --check "website/**/*.{js,mjs,css,json,md}"`.

### Veri nasıl okunuyor?

`scripts/export-data.mjs` kendini `node --experimental-transform-types` ile yeniden başlatır ve
`scripts/ts-loader.mjs` kancasıyla `@/domain` gibi takma adları `src/` altına çözer. Böylece `tsx`
ya da başka bir derleyici gerekmez. `seed.destinations.ts` yazımı yarım kalmışsa (başka bir araç
üzerinde çalışıyorsa) dosyanın kapanmamış dizisi `.cache/` altındaki bir kopyada kapatılıp yeniden
denenir; o da olmazsa `src/data/fallback/destinations.json` kullanılır. Kurslar ve planlar için de
aynı yedek mantığı vardır.

Rotalar üç kaynaktan derlenir: `seed.ts` `seedRoutes` (basit yol; yükseklik profili tahminidir),
`seed.maps.ts` `seedSavedRoutes` (A\* planlayıcı çıktısı, gerçek profil) ve destinasyon etapları
(etap irtifalarından profil). Her rota için `dist/gpx/<slug>.gpx` yazılır.

## Yapılandırma (ortam değişkenleri)

| Değişken                           | Varsayılan                                    | Açıklama                                            |
| ---------------------------------- | --------------------------------------------- | --------------------------------------------------- |
| `SITE_URL`                         | `https://zirtan.app`                          | Kanonik adres; alt yol (`/repo`) otomatik algılanır |
| `WAITLIST_ACTION`                  | `https://formspree.io/f/REPLACE_WITH_FORM_ID` | Bekleme listesi POST hedefi (Formspree/Buttondown)  |
| `APP_STORE_URL` / `PLAY_STORE_URL` | yer tutucu mağaza adresleri                   | Mağaza rozetleri                                    |
| `APP_SCHEME` / `APP_UNIVERSAL_URL` | `zirve` / `https://zirve.app` (app.json)      | Derin bağlantı şeması ve evrensel bağlantı kökü     |
| `GITHUB_URL`                       | `https://github.com/inandersim/claude`        | Kaynak kod bağlantısı                               |

`WAITLIST_ACTION` ayarlanmadıysa form gönderimi tarayıcıda simüle edilir (teşekkür mesajı gösterir).

## Dağıtım

### GitHub Pages

`.github/workflows/website.yml`: `main` ve `claude/**` dallarına push → `npm ci && npm run build` →
`actions/deploy-pages`. Depo ayarlarında **Pages → Source: GitHub Actions** seçili olmalı.
Özel alan adı için depo değişkeni `SITE_URL` (ör. `https://zirtan.app`) tanımlayın; aksi hâlde
`https://<kullanıcı>.github.io/<repo>` alt yoluyla üretilir.

### Cloudflare Pages

1. Cloudflare Pages → Create project → GitHub deposunu bağla.
2. Build command: `cd website && npm ci && npm run build` · Build output directory: `website/dist`.
3. Environment variables: `NODE_VERSION=22`, `SITE_URL=https://zirtan.app` (+ isteğe bağlı `WAITLIST_ACTION`).
4. `dist/_headers` önbellek ve güvenlik başlıklarını ekler; `404.html` otomatik kullanılır.

## İçerik güncelleme

- Arayüz metinleri: `src/i18n/tr.json` (kaynak) ve `en.json` — aynı anahtar yapısı.
- Rehber, kaya, kütüphane ve kurs içerikleri uygulama tohumlarından gelir; oradaki değişiklik
  `npm run build` ile siteye yansır.
- SSS, yasal metinler, basın kiti: `src/i18n/*.json` içindeki `home.faq`, `privacy`, `kvkk`, `press`.
- Ekran görüntüleri: `public/img/screens/*.png` (390×844 @2x). Sekiz görsel ana sayfa şeridi ve basın kitinde kullanılır.
- Marka görselleri build sırasında SVG olarak üretilir (`src/templates/illustrations.js`).

## Bilinen eksikler

- Destinasyon rehber metinleri ve tohum açıklamaları yalnızca Türkçe; EN sayfalarda arayüz İngilizce, uzun metin Türkçe kalır (uyarı gösterilir).
- Mağaza bağlantıları ve QR kodu yer tutucudur; `zirve://` derin bağlantı şeması app.json'u izler (marka Zirtan olsa da şema henüz değişmedi).
- Harita karoları OpenStreetMap'ten (ücretsiz, atıflı) yüklenir; yoğun trafikte kendi karo sağlayıcınıza geçin.
