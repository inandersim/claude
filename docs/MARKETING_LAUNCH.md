# Zirtan — Lansman ve Topluluk Oyun Kitabı

> Eylül 2026. Bu belge **lansman gününü ve ilk 1000 kullanıcıyı** anlatır. Haftalık büyüme
> ritmi ve kanal taktikleri [`GROWTH.md`](GROWTH.md) belgesindedir; buradaki her adımın
> otomasyonu `agents/marketing/` altındadır. Bütçe sıfır: her satır ücretsiz araç ve organik
> erişimle yapılabilir olmalıdır. Yapılamıyorsa buraya yazılmaz.

## 0. Otomasyon haritası

| Ne zaman | Komut | Ne çıkar |
| --- | --- | --- |
| Lansmandan 8 hafta önce | `npm run calendar -- --start <pazartesi> --launch-week 5` | 12 haftalık takvim, slot listesi, kanal `.ics` dosyaları |
| Sürekli | `npm run content -- --langs tr,en,de,ru` | 11 arketipte içerik: kısa/orta/uzun gövde, hashtag, görsel brief, kaynak |
| Her yayın öncesi | `npm run dispatch -- publish --input out/content/content.json` | Kanal başına kopyala-yapıştır paket (`out/packets/`) |
| Lansmandan 2 hafta önce | `npm run aso` | 23 dilde mağaza metni + rakip anahtar kelime analizi |
| Lansman günü | `npm run launch -- --date <gün>` | 10 kanal duyurusu, Product Hunt, Show HN, Reddit planı, basın bülteni, e-posta, mağaza notu, saat saat akış |
| Lansmandan sonra haftalık | `npm run report -- --input metrics.csv` | Huni, kanal/biçim kırılımı, hedef sapması, kural tabanlı öneri |
| Referans döngüsü açılırken | `npm run referral` | Kod şeması, ödül tablosu, K faktörü modeli, API sözleşmesi |

Hepsi **kuru çalışma** varsayılanıyla çalışır: API anahtarı yoksa hiçbir ağ çağrısı yapılmaz,
`out/` altına elle yayınlanacak paket yazılır. Gerçek yayın için `--live`.

## 1. Lansman öncesi 12 hafta

Takvimin fazları (`agents/marketing/calendar.mjs` → `PHASES`):

| Hafta | Faz | Tema | Çıktı |
| --- | --- | --- | --- |
| 1–2 | Temel | Hesaplar, bio, ilk içerik seti, topluluk dinleme | Her kanalda yayın hattı çalışır; ilk 25 içerik |
| 3–4 | Teaser | Geri sayım değil **işe yarar içerik**; kulüp ve rehber ortakları | 20 ortak, bekleme listesi 400 kişi |
| 5 | Lansman | Duyuru, Product Hunt, Show HN, basın | 500 kurulum, PH ilk 10, 5 bağlantı |
| 6–8 | İvme | UGC, Rusça açılım, kulüp etkinlikleri, rehber ortaklıkları | Haftada 2 UGC, VK 400 üye, davet döngüsü |
| 9–12 | Ritim | Kazananı iki katına çıkar, kaybedeni kes | WAU 1500, aktivasyon %35, K > 0,4 |

**Teaser kuralı:** "yakında geliyor" gönderisi atmıyoruz. Lansmandan önceki dört hafta
yayınlanan içerik (rota kartları, ilk yardım serisi, sezon listeleri) uygulama olmadan da
faydalıdır; lansman günü o kitleye "artık bir uygulaması var" demek yeterli olur.

## 2. Lansman günü

Saat saat akış `out/launch/timeline.md` içinde üretilir. Özet:

| Saat (TRT) | İş |
| --- | --- |
| 07:30 | Mağaza sürümü canlı mı, bağlantılar ve UTM çalışıyor mu |
| 09:00 | Duyuru gönderileri: Instagram, Telegram, Facebook, VK |
| 09:30 | Ortak tetikleme: kulüp, rehber, grup yöneticileri (hazır mesaj, kişiselleştirilmiş) |
| 10:01 | Product Hunt canlı (00:01 PT) + ilk yorum (maker story) + X zinciri |
| 11:00 | LinkedIn kurucu günlüğü |
| 12:00 | TikTok / Reels / Shorts tanıtım videosu |
| 13:00 | Basın e-postaları (20 kişi) |
| 14:00 | Bekleme listesi e-postası |
| 16:00 | Show HN + r/SideProject |
| 17:00 | Pinterest rehber pinleri |
| 22:00 | Gün sonu sayıları (`report.mjs`) |

**Yapılmayacaklar:** oy dilenmek (Product Hunt kural ihlali), aynı metni birden çok Facebook
grubuna yapıştırmak, r/hiking ve r/CampingandHiking'e duyuru atmak, kullanıcı sayısı uydurmak,
"kurtarma garantisi" ima eden herhangi bir cümle.

## 3. İlk 1000 kullanıcı planı

Reklamsız 1000 kullanıcıya giden yol sırayla üç kaynaktan geçer. Sıra önemlidir: topluluk
olmadan içerik boşa düşer, içerik olmadan mağaza trafiği dönüşmez.

### 3.1 Kaynak dağılımı (hedef)

| Kaynak | Hedef kurulum | Nasıl |
| --- | --- | --- |
| Üniversite kulüpleri | 300 | 12 kulüp × ~25 üye; dönem başı tanıtım + "Güvenli dağ günü" atölyesi |
| Telegram + Facebook grupları | 250 | 5 kamp/doğa grubunda düzenli değer üretimi, 4 şehir Telegram grubu |
| Lansman günü (PH + HN + Reddit + basın) | 200 | Tek günlük sıçrama; SEO otoritesi kalıcı |
| Organik arama (ASO + rehber sayfaları) | 150 | 23 dil mağaza metni + 12 destinasyon rehberi |
| Rehber ve işletme ortakları | 60 | 15 Pro Guide, 5 dalış merkezi, 10 kamp alanı |
| Davet döngüsü | 40 | Ortalama K ≈ 0,2 ile başlar; hedef 0,4 |

### 3.2 Haftalık ilerleme kontrolü

- 1. hafta: 3 kulüp, 2 grup, 30 kurulum → yoksa mesaj değil **kanal** yanlıştır.
- 4. hafta: 150 kurulum, 30 aktif kullanıcı, ilk UGC gönderisi.
- 8. hafta: 600 kurulum, ilk 10 organik davet, iki kulüp kendi etkinliğini uygulamadan duyurmuş olmalı.
- 12. hafta: 1000+ kurulum, WAU/kurulum > %25, aktivasyon > %35.

### 3.3 İlk 100 kullanıcının elle kazanılması

İlk 100 kullanıcı otomasyonla gelmez. Kurucunun elle yaptığı işler:

1. Her yeni kullanıcıya 48 saat içinde kişisel mesaj (şablon değil): "nereye gitmeyi planlıyorsun?"
2. İlk 20 kullanıcıya rota planı çıkarma teklifi — uygulamayı birlikte kullanma.
3. Her tehlike bildirimine yanıt ve teşekkür; ilk 50 bildirim elle doğrulanır.
4. Şikâyeti aynı gün düzeltip kişiye haber verme (bu, ilk sadık çekirdeği kurar).

## 4. Topluluk oyun kitabı

### 4.1 Reddit

| Subreddit | Kural | Ne yapılır | Sıklık |
| --- | --- | --- | --- |
| r/hiking, r/CampingandHiking | Kendi ürününü tanıtmak yasak / %10 kuralı | Trip report: etap tablosu, maliyet, dürüst dezavantaj, fotoğraf | Ayda 1–2 |
| r/Turkey, r/TurkeyTravel | Seyahat sorularına cevap, reklam yasak | "Türkiye'de trekking nereden başlanır" tipi sorulara kapsamlı yanıt | Haftada 2 yorum |
| r/climbing, r/scuba, r/Ultralight | Soru–cevap, ekipman | Geyikbayırı sezonu, Kaş dalış noktaları, hafif paketleme | Haftada 1 |
| r/SideProject, r/androidapps, r/iosapps | Kendi projeni tanıtmak serbest | "I built…" şeffaf gönderi, açık yol haritası, eksikler listesi | Lansmanda + ayda 1 |
| r/solotravel, r/backpacking | Deneyim paylaşımı | "Yalnız yürüyüşte haber bırakma" konulu somut yanıtlar | Haftada 1 |
| r/Nepal, r/trekking | Yerel bilgi | EBC/Annapurna izin ve maliyet güncellemeleri | Ayda 1 |
| r/zirtanapp | Kendi topluluğun | Sürüm notu, özellik oylaması, hata bildirimi | Haftada 1 |

Kurallar: hesap 30 gün / 200 karma olmadan gönderi yok; başlıkta indirme çağrısı yok; bağlantı
gövdenin sonunda; eleştiriye savunma değil "haklısın, ekledik" ile dönülür; her gönderiden
sonra 24 saat yorumlarda kalınır.

### 4.2 Facebook grupları

Türkiye'de kamp ve doğa kitlesinin büyük kısmı hâlâ Facebook gruplarında. Grup **türleri**
(isim listesi zamanla değişir, tür kalır):

- Kamp ve karavan grupları (100K+ üyeli birkaç büyük grup)
- İl bazlı doğa yürüyüşü grupları: İstanbul, Ankara, İzmir, Antalya, Bursa, Trabzon
- Dağcılık kulübü ve federasyon grupları
- Dalış grupları (Kaş, Bodrum, Ayvalık, Saros)
- "Yürüyüş arkadaşı arıyorum" grupları — ZMatch'in birebir karşılığı, en yüksek dönüşüm
- Rota odaklı gruplar: Likya Yolu, Kaçkar, Kapadokya, Karadeniz yaylaları
- Rusça "Турция — походы / Анталия" grupları

Girme sırası: (1) katıl, kuralları oku, iki hafta yalnızca yorum yaz; (2) üçüncü haftadan
itibaren haftada 1 trip report; (3) grup yöneticisine kulüp/etkinlik profili teklifi
(moderatöre tehlike bildirimi onaylama yetkisi); (4) uygulama adı yalnızca sorulduğunda geçer.

### 4.3 Telegram

- Ana kanal `@zirtanapp`: günde 1–2 kart (bugün nereye, tehlike uyarısı, hafta sonu anketi).
- Şehir grupları: Zirtan İstanbul / Ankara / İzmir / Antalya + Rusça Zirtan Анталия.
- Her şehir grubunun **gönüllü elçisi** olur: karşılığı 1 yıl Pro + kurucu rozeti.
- Hafta sonu buluşması duyurusu kulüp etkinliği olarak uygulamada açılır (dogfooding).

### 4.4 Dağcılık ve doğa forumları, dernekler

- TDF (Türkiye Dağcılık Federasyonu) kulüp listesi: her ile en az bir kulüp; eğitim takvimi duyuruları.
- Yerel dernekler: doğa sporları kulüpleri, mağaracılık dernekleri, yamaç paraşütü kulüpleri (Ölüdeniz, Pamukkale), kayak kulüpleri (Uludağ, Erciyes, Palandöken).
- Bölge forumları ve topluluk siteleri: rota tarifleri, GPX paylaşımı; katkı = doğrulanmış GPX + tehlike notu.
- Uluslararası: UKClimbing (Kalymnos/Geyikbayırı forumları), Summitpost, Caucasus/Nepal odaklı Facebook ve Telegram grupları, Alpler için Alpenverein bölge grupları.

Katkı biçimi her yerde aynı: **önce bilgi, sonra kimlik.** Rota tarifini, sezon uyarısını,
maliyet tablosunu ver; imzada uygulama adı yeterlidir.

### 4.5 Üniversite kulüpleri

Uygulamada 14 kulüp dizini hazır (ODTÜ, Boğaziçi, İTÜ, Hacettepe, Ege, Bilkent, KTÜ, Akdeniz,
Sabancı, Ankara, Dokuz Eylül, YTÜ, ETH Zürich, Edinburgh).

**Ücretsiz kulüp paketi:** kulüp profili, etkinlik + RSVP, .edu ile öğrenci doğrulama, kulüp
ligi, üyelere 1 ay Pro.
**Karşılığı:** dönemde 1 ortak gönderi, etkinlikte "Zirtan ile RSVP", gezi sonrası UGC (izinle).

Takvim: dönem başı (Eylül–Ekim ve Şubat) tanıtım günleri → QR'lı A5 afiş + 2 dakikalık demo;
dönem ortası "Güvenli dağ günü" atölyesi (2 saat: ilk yardım rehberleri + tehlike haritası +
kısa yürüyüş); dönem sonu kulüpler arası XP ligi.

### 4.6 Yerel rehberler ve işletmeler

- İlk 20 rehbere Pro Guide 3 ay ücretsiz; sonrasında ₺399/ay **ya da** yalnızca %5 komisyon.
- Hedef profiller: dağcılık federasyonu eğitmenleri, PADI/SSI dalış eğitmenleri (Kaş, Bodrum, Ayvalık), yamaç paraşütü pilotları (Ölüdeniz), Kapadokya yürüyüş rehberleri, kayak öğretmenleri, Nepal'de Türkçe/İngilizce konuşan trekking ajansları.
- Rehber ne verir: haftada 1 ortak içerik (POV drone — SHGM ve millî park kurallarına uygun), müşterilerine davet kodu.
- Kamp alanı ve pansiyonlar: kütüphane kaydını doğrulama karşılığı öne çıkan profil; QR'lı masa kartı.

### 4.7 İçerik ortaklıkları

- Konuk yazı: outdoor bloglarına hazır, SEO uyumlu, orijinal fotoğraflı rehber — karşılığında bir bağlantı. Ayda 2.
- Ortak seri: bir YouTube kanalı ile "rota + güvenlik" bölümleri; veri ve harita bizden, çekim onlardan.
- Podcast/YouTube röportajları: açık veri hattı ve topluluk tehlike haritası teknik olarak ilgi çeker.
- Basın açıları: "Türkiye'nin ilk topluluk kaynaklı tehlike haritası", "açık veriyle 10 ülke lokasyon kütüphanesi", "üniversite kulüplerini tek uygulamada birleştiren öğrenci ağı", sezonluk "Kaçkar'da güvenli trekking için 10 kural".

### 4.8 Spam olmayan katkının beş kuralı

1. Bir başlığa yalnızca o başlığın sorusuna cevap veriyorsan yazılır.
2. Bağlantı yalnızca sorulduğunda ya da gövdenin sonunda, UTM ile.
3. Aynı metin iki yere gitmez; kanal biçimlendiricisi zaten farklı uzunluk üretir.
4. Ürün adı bir gönderide en fazla bir kez geçer.
5. Eleştiri silinmez, savunulmaz: kabul edilir ve yol haritasına yazılır.

## 5. Referans (davet) sistemi — ürün tarafı tasarımı

Model ve metinler `npm run referral` ile üretilir (`out/referral/`). Özet:

### 5.1 Kod ve ödül

- Kod: 6 karakter, `ABCDEFGHJKMNPQRSTUVWXYZ23456789` alfabesi (0/O, 1/I/L yok) → ~887 milyon kombinasyon; sunucu tekillik denetler.
- Kulüp kodu ayrı ön ek: `KLP-<kısaltma>` (ör. `KLP-ODTU`). Rehber kodu: `RHB-<kısaltma>`.
- Ödül: davet edilen kaydolunca **7 gün Pro**; davet edilen **ilk maceraya çıkınca** her iki tarafa 7 gün daha. 3 nitelikli davet → 1 ay Pro; 10 → "Kurucu" rozeti + zirve pasaportu damgası + 3 ay Pro.
- Kulüp kodu ile gelen üye nitelikli olunca kulübe 50 XP (kişiye değil kulübe — iç rekabeti bozmaz).
- Rehber kodu ile gelen müşteri rezervasyon yaparsa o rezervasyonda komisyon %5 → %3.

### 5.2 Paylaşım anları (ürün yüzeyleri)

Rota tamamlandı kartı · rozet kazanıldı · haftalık özet · ZMatch boş durum ekranı ("arkadaşın
yoksa çağır") · kulüp etkinliği oluşturuldu · tehlike bildirimi onaylandı.

### 5.3 Kötüye kullanım engelleri

Cihaz kimliği başına tek ödül · aynı /24 IP bloğunda 72 saat bekleme ve elle onay · nitelik için
e-posta doğrulama + gerçek etkinlik · kullanıcı başına ayda 20 ödüllü davet · kod kupon
sitelerinde görülürse döndürülür.

### 5.4 Ölçüm

| Metrik | Hedef | Yorum |
| --- | --- | --- |
| Davet başına kurulum | > 0,30 | Altındaysa paylaşım metni ya da anı yanlış |
| Nitelik oranı | > 0,55 | Altındaysa ilk deneyim tıkanıyor |
| K faktörü | > 0,40 | Organik büyümenin ~%30'unu taşır |
| Ödül maliyeti / kurulum | < ₺15 | Nakit ödül yok, yalnızca Pro günü |

### 5.5 KOORDİNATÖR GEREKLİ

Aşağıdakiler **pazarlama tarafında yapılamaz**; ürün, backend, tasarım ve hukuk tarafında iş açılmalıdır.
Ayrıntılı sözleşme: `agents/marketing/out/referral/api-contract.md`.

1. **Backend:** `GET /v1/referral/me`, `POST /v1/referral/claim`, `POST /v1/referral/qualify` (iç olay), `GET /v1/referral/leaderboard?scope=club` uçları. Kod üretimi sunucuda; istemci üretmez.
2. **Backend:** kötüye kullanım kuralları ödül yazma yolunda; elle onay kuyruğu ve ödül geri alma yolu.
3. **Uygulama:** altı paylaşım yüzeyine davet düğmesi; metinler `out/referral/share-copy.md` dosyasından (tr/en/de/ru).
4. **Uygulama:** ertelenmiş derin bağlantı (deferred deep link) — `zirtan.app/i/<kod>` → mağaza → ilk açılışta kod otomatik dolar.
5. **Veri/analitik:** `invite_shared`, `invite_opened`, `invite_claimed`, `referral_qualified`, `reward_granted` olayları; haftalık K faktörü `report.mjs` girdisine yazılır.
6. **Tasarım:** paylaşım kartı şablonları (1080×1920 story, 1080×1350 gönderi); kod büyük ve okunur; kart uygulama içinde üretilir.
7. **Hukuk/finans:** kampanya koşulları sayfası; Pro gün hediyesinin muhasebede promosyon olarak izlenmesi; davet metinlerinde ödül koşulunun açık yazılması (yanıltıcı promosyon riski).
8. **Ürün:** mağaza sürüm notu ve ASO metinleri `out/aso/` ile birebir aynı olmalı; sürüm çıkarken güncellenir.
9. **Ürün:** `zirtan.app/basin` basın kiti sayfası (logo, ekran görüntüleri, künye, kurucu fotoğrafı) lansmandan 2 hafta önce yayında olmalı.
10. **Ürün:** uygulama içi olay hattı (kurulum → kayıt → ilk eşleşme/rota → 7. gün dönüş) lansmandan önce doğrulanmalı; aktivasyon ölçülemezse rapor eksik kalır.

## 6. Ölçüm ve karar kuralları

Haftalık rapor `npm run report -- --input <csv>` ile üretilir. Girdi, kanal dışa aktarımlarının
birleştirildiği tek CSV'dir (başlık: `date,channel,post_id,format,reach,impressions,engagements,link_clicks,installs,signups,activations,followers_delta,invites_sent,invites_qualified`;
her kanalın nereden dışa aktarılacağı `npm run dispatch -- metrics` çıktısındadır).

Karar kuralları (raporun sonunda da yazılıdır):

- Etkileşim oranı > %5 → o biçimin haftalık hacmini iki katına çıkar.
- İki hafta üst üste < %2 → biçimi kes.
- Tıklama → kurulum < %10 → mağaza metni ve ekran görüntülerini değiştir (tek değişken, 14 gün ölç).
- Aktivasyon < %35 → içerik değil ürün sorunu: ilk 5 dakikayı düzelt.
- K < 0,2 → paylaşım anı yanlış yerde; ödülü değil **anı** değiştir.
- Erişim düşerken etkileşim oranı sabitse sorun hacimdedir, içerikte değil.

## 7. Risk ve etik sınırlar

- **Güvenlik abartısı yok.** SOS bir bildirim aracıdır; kurtarma garantisi verilmez. İlk yardım içerikleri eğitim amaçlıdır ve her güvenlik gönderisinde acil numara yazılır. Yasak ifade listesi `agents/marketing/lib/brand.mjs` içindedir ve yayın öncesi otomatik denetlenir (ihlalde gönderi durur).
- **Olmayan özellik tanıtılmaz.** Gerçek uydu SOS iletimi, giyilebilir senkron, resmî çığ bülteni ve uygulama içi ödeme yol haritasındadır; lansman metinlerinde "yakında" olarak bile geçmez.
- **Kullanıcı verisi paylaşılmaz.** Ekran görüntülerinde isim ve konum maskelenir; DM içeriği yayınlanmaz (KVKK/GDPR).
- **UGC yalnızca yazılı izinle**, @atıf ve "izinle paylaşıldı" ibaresiyle. İzin ekran görüntüsü saklanır.
- **Açık veri atfı** her harita ve kütüphane görselinde: "© OpenStreetMap katkıcıları (ODbL 1.0) · Wikidata (CC0)".
- **Drone** görüntüsü SHGM kuralları ve millî park yasaklarına uygun olmalı; tarihi alanlarda drone yasağı ayrıca kontrol edilir.
- **Sponsorlu iş birliği** varsa etiketlenir: #işbirliği / #reklam (TR), #ad (EN), #реклама (RU).
- **Rakip karalanmaz.** Fark anlatılır; rakip adı mağaza metinlerinde geçmez (yalnızca iç analizde).

## 8. Bir haftalık işleyiş (tek kişi, ~12 saat)

| Gün | İş |
| --- | --- |
| Pazartesi | `report.mjs` → karar; `content` + `dispatch publish` ile haftanın paketleri |
| Salı | Çekim ve kurgu (1 dikey video + 2 kısa), Canva karuseller |
| Çarşamba | Yayın (paketlerden), Facebook grup yorumları 30 dk, Reddit 15 dk |
| Perşembe | Kulüp/rehber DM'leri (10), UGC izinleri, ortak içerik koordinasyonu |
| Cuma | Rusça içerik, Telegram hafta sonu anketi, yanıt taslakları (`dispatch reply`) |
| Hafta sonu | Etkinlik (kulüp gezisi / şehir grubu buluşması) → UGC ham malzeme; günlük story |

Ayrıntılı kanal taktikleri: [`GROWTH.md`](GROWTH.md) · komut ayrıntıları:
[`agents/marketing/README.md`](../agents/marketing/README.md).
