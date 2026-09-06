# Zirtan Yönetim Paneli

Kurucunun ve ekibin tüm süreçleri yönettiği web arayüzü.
React 19 + Vite + TypeScript (strict) + TanStack Query + React Router ile yazıldı;
ağır bir UI kütüphanesi kullanılmaz, bileşenler `src/components` altında kendi
tasarım sistemimizle üretilir.

Panel, mobil uygulamayla **aynı sözleşmeyi** paylaşır:

- Tipler `../src/domain` (kopya yok, tip-only içe aktarım)
- Demo veriler `../src/data/mock/seed*.ts` (uygulamanın tohum verisi)
- Renk/boşluk/tipografi `../src/core/theme/tokens.ts` (Manrope, doğa paleti)

---

## Kurulum ve çalıştırma

```bash
cd admin
npm install
npm run dev        # http://localhost:5180
```

Diğer komutlar:

| Komut               | Açıklama                                                        |
| ------------------- | --------------------------------------------------------------- |
| `npm run dev`       | Geliştirme sunucusu (5180)                                       |
| `npm run build`     | `tsc --noEmit` + üretim derlemesi (`dist/`)                       |
| `npm run typecheck` | Yalnızca tip kontrolü                                            |
| `npm run preview`   | `dist/` çıktısını yerel olarak sunar                             |

> `npm run build` uygulamanın `src/domain` tiplerini de denetler. Ana uygulamada
> sözleşme bozulursa panel derlemesi de kırılır — bu bilinçli bir tercihtir.

---

## Gerçek sunucuya bağlama

Panel iki veri kaynağını da aynı `AdminApi` arayüzüyle kullanır
(`src/data/adminApi.ts`):

| Uygulama        | Dosya                     | Ne zaman                                      |
| --------------- | ------------------------- | --------------------------------------------- |
| `mockAdminApi`  | `src/data/mockAdminApi.ts`| Varsayılan. Tohum veriden okur, gecikme taklidi yapar |
| `restAdminApi`  | `src/data/restAdminApi.ts`| `VITE_ADMIN_API_URL` tanımlıysa               |

```bash
cp .env.example .env
# .env
VITE_ADMIN_API_URL=https://api.zirtan.app/admin
VITE_ADMIN_API_TOKEN=...   # isteğe bağlı; yoksa çerez tabanlı oturum kullanılır
```

Ekran kodu değişmez; yalnızca kaynak değişir. Sol alttaki rozet hangi kaynağın
etkin olduğunu gösterir (**Demo veri** / **Canlı sunucu**).

### Sunucudan beklenen uç noktalar

`restAdminApi` yöntem adlarıyla birebir eşleşen REST uçları kullanır:

```
GET   /auth/me                              GET   /metrics/overview?range=30d
GET   /users?page&pageSize&query&sort&dir   POST  /users/:id/status  { status, reason, days }
POST  /users/:id/role                       POST  /users/:id/plan
POST  /users/:id/revoke-sessions            POST  /users/:id/notes
GET   /moderation/reports                   POST  /moderation/act    { ids, action, reason }
GET   /moderation/log                       GET   /verification/requests
POST  /verification/requests/:id/decide     GET   /bookings
POST  /bookings/:id/release                 POST  /bookings/:id/refund { amountTry, reason }
GET   /bookings/disputes                    POST  /bookings/disputes/:id/resolve
GET   /bookings/commission?range            GET   /sos/incidents
POST  /sos/incidents/:id/assign             POST  /sos/incidents/:id/resolve
GET   /sos/hazards                          POST  /sos/hazards/:id/review
GET   /content · POST /content              PATCH /content/:id · POST /content/:id/status
GET   /marketing/campaigns · /posts         POST  /marketing/posts/:id/schedule · /status
GET   /marketing/referrals · /aso           GET   /agents/runs · /pull-requests · /findings
GET   /system/ci · /health · /releases      POST  /system/rollback   { version, reason }
GET   /settings · PATCH /settings           GET   /audit
```

Listeleme uçları `{ items, total, page, pageSize }` döner.

---

## Roller ve yetkiler

Yetkiler tek yerde tanımlıdır: `src/auth/roles.ts`. Ekranlar ve tehlikeli
işlemler `can(role, permission)` ile korunur (`useCan()` kısayolu).

| Rol           | Kapsam                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------- |
| **admin**     | Her şey: kullanıcılar, moderasyon, doğrulama, ödeme/iade, SOS, içerik, pazarlama, ajanlar, ayarlar, denetim |
| **moderator** | Panorama, kullanıcı görüntüleme + askı/yasak, moderasyon kuyruğu, doğrulama kararı, SOS görüntüleme, tehlike onayı, denetim günlüğü |
| **editor**    | Panorama, içerik (oluştur/düzenle/yayınla), pazarlama                                                |
| **support**   | Panorama, kullanıcı görüntüleme + plan/oturum, doğrulama görüntüleme, rezervasyon/iade/uyuşmazlık, SOS müdahale, denetim günlüğü |

Ekranların menüde görünmesi de bu izinlere bağlıdır; yetkisiz bir adrese
doğrudan gidilirse "yetkiniz yok" kartı gösterilir.

Demo ortamında sağ üstteki **panel hesabı** seçicisiyle rol değiştirilerek
yetkilendirme denenebilir (gerçek sunucuda bu yerini oturum açmaya bırakır).

---

## Onay ve denetim günlüğü

Tehlikeli her işlem (askıya alma, yasaklama, içerik kaldırma, iade, emanet
aktarımı, bakım modu, sürüm geri alma…) önce bir **onay diyaloğu** açar ve
gerekçe ister. İşlem tamamlandığında **denetim günlüğüne** kim/ne/ne zaman/neden
kaydı yazılır (`AdminApi.audit`). Günlük "Denetim günlüğü" ekranından
aranabilir ve yapan kişi/hedef türüne göre süzülebilir.

---

## Ekranlar

1. **Panorama** — DAU, yeni kayıt, gönderi/rota/rezervasyon, gelir, açık SOS, moderasyon kuyruğu, ajan durumu; zaman serisi grafikleri (kendi SVG bileşenlerimiz)
2. **Kullanıcılar** — arama/filtre/sıralama/sayfalama, profil detayı, telefon doğrulaması, plan, askı/yasak, rol atama, oturum kapatma, not
3. **Moderasyon** — bildirilen gönderi/yorum/mesaj/makale/soru kuyruğu, toplu işlem, moderasyon günlüğü
4. **Doğrulama** — eğitmen (Pro Guide), işletme, kulüp, doktor, yazar başvuruları; belge görüntüleme, onay/ret/ek belge
5. **Rezervasyon ve ödeme** — emanet durum makinesi (bekliyor → bloke → emanette → aktarıldı / iade), iade, uyuşmazlık çözümü, komisyon raporu
6. **SOS ve güvenlik** — canlı olay haritası (SVG), olay zaman çizelgesi, kurtarma merkezi ataması, tehlike bildirimi onayı
7. **İçerik** — destinasyon/tarihî alan/tür/kurs/TV/haber/makale editörü; 23 dilde çeviri durumu ve eksik alanlar
8. **Pazarlama** — kampanya takvimi, platform bazlı gönderi kuyruğu ve performansı, davet/referans istatistikleri, ASO anahtar kelimeleri
9. **Ajanlar ve sistem** — ajan çalışmaları, açılan PR'lar, bulgular, CI durumu, hata oranı/p95, sürümler ve geri alma
10. **Ayarlar** — özellik bayrakları, bakım modu, duyuru bandı, oran sınırları, komisyon oranları
11. **Denetim günlüğü** — tüm yönetimsel işlemlerin izi

---

## Dil ve erişilebilirlik

- Arayüz Türkçedir; metinler `src/i18n/tr.ts` içinde toplanır, İngilizce karşılıkları `src/i18n/en.ts`.
  `en.ts` `Record<AdminTranslationKey, string>` olarak tiplendiği için eksik anahtar derlemede yakalanır.
- Sağ üstten dil ve tema (açık/koyu) değiştirilebilir; seçim `localStorage`'da saklanır.
- Klavye ile tam gezinme, "İçeriğe geç" bağlantısı, tablo başlıklarında `aria-sort`,
  diyaloglarda `role="dialog"` + odak yönetimi + Esc, grafiklerde `role="img"` ve `aria-label`,
  bildirimlerde `aria-live`. Renkler uygulamanın kontrast doğrulanmış paletinden gelir.

---

## Klasör yapısı

```
admin/
├── src/
│   ├── auth/         rol tanımları (roles.ts) ve oturum bağlamı (session.tsx)
│   ├── charts/       SVG grafik bileşenleri (çizgi, sütun, halka, kıvılcım)
│   ├── components/   tasarım sistemi: tablo, modal, bildirim, form parçaları, harita
│   ├── data/         AdminApi sözleşmesi + mock/rest uygulamaları + mock depo
│   ├── hooks/        liste durumu (arama/filtre/sıralama/sayfa) adres çubuğunda
│   ├── i18n/         tr.ts (kaynak) ve en.ts
│   ├── layout/       kabuk (kenar çubuğu, üst çubuk, duyuru bandı) ve menü tanımı
│   ├── pages/        11 ekran
│   ├── shims/        RN'e bağlı modüller için tip stub'ları
│   ├── theme/        uygulama token'larından CSS değişkeni üretimi
│   └── utils/        biçimlendirme (tarih, para, yüzde)
├── public/fonts/     Manrope (yerel; dış istek yok)
└── screenshots/      Playwright turunun ekran görüntüleri
```

## Notlar

- Mock veri **bellekte** tutulur: sayfa tam yenilendiğinde demo değişiklikleri sıfırlanır
  (SPA içi gezinmede korunur). Gerçek sunucuda böyle bir kısıt yoktur.
- Avatarlar yerel SVG olarak üretilir; panel çevrimdışı da temiz konsolla çalışır.
- Ana uygulamanın `src/` klasörü panelden **hiç değiştirilmez**, yalnızca okunur.
