# Zirtan — Sıfır Bütçeli Büyüme Oyun Kitabı

> Eylül 2026. Hedef: reklam harcaması olmadan, tek kişilik bir ekiple ilk 90 günde **5.000 kurulum, 1.500 haftalık aktif kullanıcı, 40 kulüp/rehber ortağı**. Otomasyon için `agents/marketing/` (Claude API tabanlı plan / üretim / yanıt / analiz / yayın ajanları) kullanılır; bu belge _ne_ ve _neden_, ajanlar _nasıl_ sorusuna cevap verir.

## 0. İlkeler

1. **Değer önce, uygulama sonra.** Her gönderi tek başına faydalı olmalı (rota, güvenlik, mevsim bilgisi); uygulama en fazla bir cümle.
2. **Bir içerik, yedi kanal.** Bir Reel çekilir → TikTok, Shorts, VK Clips, Telegram, Facebook, Reddit (metin hâli), blog (SEO) olarak yeniden kullanılır.
3. **Güvenlikte abartı yok.** "Asla kaybolmazsın", "kurtarma garantisi" gibi ifadeler yasaktır (`agents/marketing/src/brand.ts` → `FORBIDDEN_PHRASES`). Her güvenlik içeriğinde "acil durumda 112".
4. **Topluluk kendi içeriğini üretir.** UGC (izinle) her zaman kendi içeriğimizden daha iyi çalışır.
5. **Ölç, kes, tekrarla.** Haftalık `analyze`; iki hafta üst üste etkileşim oranı < %2 olan biçim kesilir.

## 1. Konumlandırma ve mesaj

**Tek cümle:** _Zirve — doğayı birlikte keşfet. Yakınındaki doğrulanmış maceraperestlerle eşleş, topluluk tehlike haritasına bak, dağdan canlı yayın aç, ülkeye göre SOS ve çevrimdışı ilk yardımla daha güvenli çık._

Rakiplerin hiçbirinde bir arada olmayan dört fark (bkz. [STRATEGY.md](STRATEGY.md) §3):

| Fark                             | Kullanıcı diliyle                                           | Kanıt gösterimi                                                 |
| -------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| **ZMatch**                       | "Yalnız çıkmak istemiyorum ama kimi bulacağımı bilmiyorum." | Eşleşme ekranı (isimler maskeli), doğrulama rozeti, güven skoru |
| **Tehlike haritası**             | "Bu patikada geçen hafta heyelan olmuş, kimse söylemedi."   | Radar görünümü, "Ben de gördüm" onayı, yakındakilere uyarı      |
| **Canlı yayın + drone**          | "Zirveden canlı — irtifa 3.200 m, rüzgâr 40 km/s."          | Telemetri şeritli oynatıcı ekranı                               |
| **Ülkeye göre SOS + ilk yardım** | "Kaçkar'da telefon çekmezken ne yapacağımı biliyorum."      | Basılı tut SOS, çevrimdışı 12 rehber, en yakın kurtarma         |

**Mesaj hiyerarşisi:** güvenlik (herkes) → birlikte (sosyal) → keşif (kütüphane/rota) → ekonomi (rehber, market, konaklama). Reklamsız büyümede en çok paylaşılan tema **güvenlik hikâyeleri**, en çok kurulum getiren tema **"birlikte çık"** (ZMatch) olur; ikisini aynı gönderide birleştir.

**Söylenmeyecekler:** kullanıcı sayısı uydurma, "en iyi outdoor uygulaması", rakip karalama, gerçek uydu SOS iletimi / giyilebilir senkron / resmî çığ bülteni (v1.4 yol haritası) vaadi.

## 2. Hedef kitleler ve kanca

| Kitle                                                               | Nerede                                               | Kanca                                                                        | İlk 90 gün hedefi                            |
| ------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------- |
| Üniversite doğa sporları kulüpleri                                  | Instagram, WhatsApp, kampüs etkinlikleri             | Kulüp sayfası + etkinlik RSVP + .edu doğrulama + kulüp sıralaması (ücretsiz) | 25 kulüp, 1.200 öğrenci                      |
| Kamp toplulukları                                                   | Facebook grupları (en büyükleri 100K+ üye), Telegram | Kütüphane (kamp alanı + su + tehlike), canlı konum                           | 5 grupta düzenli varlık                      |
| Dalış okulları ve dalgıçlar                                         | Instagram, PADI merkezleri, Kaş/Bodrum/Ayvalık       | Buddy eşleşme + dalış merkezi profili + rezervasyon                          | 10 dalış merkezi profili                     |
| Rehberler / eğitmenler                                              | Instagram DM, dağcılık federasyonu kursları          | Pro Guide: rezervasyon, %5 komisyon, öne çıkan profil, drone yayını          | 15 Pro Guide (3 ay ücretsiz)                 |
| Rusça konuşanlar (Kafkasya, Kırgızistan, Türkiye'de tatil/yerleşik) | VK, Telegram, Antalya-Alanya toplulukları            | Rusça arayüz, Likya/Kapadokya/Kaçkar rehberleri, ülkeye göre SOS             | VK 1.000 üye, 400 kurulum                    |
| Tek başına yürüyenler / güvenlik odaklı                             | Reddit, YouTube, Instagram                           | Canlı konum + SOS + ilk yardım + tehlike haritası                            | "Yalnız çıkıyorsan" serisi 100K görüntülenme |

## 3. Kanal kanal ücretsiz taktikler

### 3.1 Instagram (ana vitrin)

**Profil:** kullanıcı adı `@zirtanapp`; bio'da 3 satır (ne, kim için, CTA) + tek bağlantı (Linktree yerine kendi `zirtan.app/ig` yönlendirmesi, UTM'li). Öne çıkan hikâyeler: _Nasıl çalışır · Güvenlik · Rotalar · Kulüpler · Rusça_.

**Haftalık ritim (tek kişi için gerçekçi):** 2 Reel + 1 karusel + 1 tek görsel + her gün 1–3 story + 1 iş birliği gönderisi (Collab).

**Reel serileri** (senaryolar `agents/marketing/templates/reel-scripts.md`):

- **"Kaçkar'da 3 gün"** — 3 bölüm, her bölüm 20–30 sn; gün-etap-irtifa-su noktası; 3. sahnede tehlike haritası ekranı. Aynı kalıp Likya Yolu (4 bölüm), Aladağlar (2), Kapadokya (2) için tekrarlanır.
- **POV drone** — zirveden geriye "reveal", altyazıda yer/irtifa; Pro Guide ortaklarının drone görüntüsü (izinli; SHGM/millî park kuralları).
- **"Bunu yapma #N"** güvenlik serisi — 10 bölüm; kanca 1 sn hatalı hareket, 5 sn neden, 8 sn doğrusu, "112" alt yazısı. En yüksek paylaşım oranı beklenen seri; yorumlardan yeni bölüm konuları toplanır.
- **"Yalnız çıkıyorsan"** — 3 adım (rota kaydet, canlı konum paylaş, SOS nasıl çalışır).
- **Kulüp tanıtımı** — 5 üye × 2 sn + RSVP ekranı.

**Hashtag setleri** (`brand.ts` → `HASHTAGS`; gönderi başına 8–12: 3 çekirdek + 4 niş + 3 yerel):

- TR çekirdek: `#zirve #zirtanapp #doğa #outdoor #kamp #trekking #dağcılık` · niş: `#tırmanış #dalış #yamaçparaşütü #patikakoşusu #solotrekking` · yerel: `#kaçkar #likyayolu #kapadokya #aladağlar #ağrıdağı #geyikbayırı #olimpos`
- EN çekirdek: `#zirtanapp #hiking #outdoors #camping #trekking #adventure` · niş: `#climbing #scubadiving #paragliding #trailrunning #solohiking` · yerel: `#turkey #lycianway #cappadocia #kackar #kalymnos`
- Hashtag'ler açıklamanın sonunda; `#keşfet #fyp` gibi genel etiketler kullanılmaz (niş erişimi düşürür).

**UGC yeniden paylaşım:** `#zirtanapp` ve konum etiketlerini günlük tara; DM ile izin iste (şablon: `templates/community-scripts.md`), izin ekran görüntüsünü sakla, gönderide `@atıf` + "izinle paylaşıldı". Haftada 2 UGC gönderisi hedef.

**Hikâye şablonları** (`templates/story-templates.md`): günlük "Bugün nereye?" (anket sticker), anlık tehlike uyarısı (emoji yok, kırmızı şerit, 112), UGC, kulüp etkinliği geri sayımı, Pazar haftalık özeti.

**İş birliği gönderileri (Collab):** her kulüp/rehber/dalış merkezi ile ayda 1 ortak gönderi → iki kitleye birden düşer, reklam maliyeti sıfır. Sıra: kulüp gezisi öncesi duyuru → gezi sonrası UGC karuseli.

**Yorum stratejisi:** ilk 60 dakika içinde her yoruma yanıt (`reply` ajanı taslak üretir, insan onaylar). Büyük outdoor hesaplarının gönderilerine "değer katan" yorumlar (rota bilgisi, güvenlik notu) — link yok.

### 3.2 Facebook grupları ve sayfa

Türkiye'de kamp/doğa kitlesi hâlâ Facebook gruplarında. Grup türleri: kamp/karavan grupları (100K+ üyeli birkaç grup), il bazlı doğa yürüyüşü grupları (İstanbul, Ankara, İzmir, Antalya, Bursa), dağcılık kulüpleri, dalış grupları, "yürüyüş arkadaşı arıyorum" grupları, Likya Yolu / Kaçkar / Kapadokya odaklı gruplar, Rusça "Турция — походы" grupları.

**Kural: değer ver, spam yapma.**

1. Gruba gir, kuralları oku (çoğunda link/reklam yasak). İlk 2 hafta yalnızca yorum: rota sorularına somut cevap (etap, su, mevsim).
2. 3. haftadan itibaren haftada 1 gönderi: trip report (fotoğraf + etap tablosu + güvenlik notu). Uygulama yalnızca sorulursa ya da "tehlike haritasında işaretledim" gibi doğal bağlamda.
3. Grup yöneticileriyle DM: "grubunuz için Zirtan'de özel etkinlik sayfası / kulüp profili açalım" — yöneticiye moderatör rozeti ve tehlike bildirimlerini onaylama yetkisi.
4. Sayfa: haftada 2 gönderi (karusel + uzun metin), yorumlara ilk 1 saatte yanıt. Hashtag en fazla 3, bağlantı UTM'li metnin sonunda.
5. Facebook'ta en iyi biçim: **fotoğraf albümü** (3–6 kare, ilk kare manzara) ve **anket**.

### 3.3 VK (Rusça pazar)

Neden: Kafkasya (Gürcistan, Ermenistan, Dağıstan), Kırgızistan/Kazakistan trekking topluluğu ve Türkiye'de yaşayan/tatil yapan Rusça konuşanlar için AllTrails/Komoot Rusça içerikte zayıf; VK reklamsız erişimde hâlâ cömert.

- **Topluluk (сообщество)** aç: "Zirtan — походы и приключения в Турции". Kapak, kısa açıklama, "Ссылка в приложение" düğmesi, tartışma başlıkları (Ликийская тропа, Каппадокия, Качкар, Дайвинг в Каше).
- **İçerik:** Rusça uzun gönderi (VK'da uzun metin sorun değil): "Ликийская тропа за 4 дня" etap etap, ulaşım (Antalya havalimanı → Fethiye otobüs), fiyatlar (TL ve RUB), sezon, su, kamp. 5–8 Rusça hashtag (`#ликийскаятропа #турция #поход #треккинг #zirtanapp`).
- **VK Clips:** Reel'lerin Rusça altyazılı sürümü.
- **"Предложить новость":** büyük походы/треккинг topluluklarına haftada 1 içerik öner (spam değil, tam trip report).
- **Rus dilli Telegram/VK "Анталия/Аланья" yerleşik toplulukları:** hafta sonu yürüyüş etkinlikleri (ZMatch + kulüp etkinliği) — yerel Rusça konuşan bir gönüllü "elçi" bul (Pro 1 yıl ücretsiz karşılığı).
- **VK API ücretsiz:** `wall.post` + `photos.getWallUploadServer` ile `post --channel vk` yayınlar; istatistik `stats.get` ile CSV'ye alınır.

### 3.4 TikTok ve YouTube Shorts

- Aynı dikey video üç yere: TikTok → Shorts → Reels (CapCut'tan filigransız dışa aktar).
- TikTok'ta açıklama 1–2 cümle + 3–5 niş hashtag; 1.000 takipçi altında link yok → "Zirtan'yi ara" de.
- **Seri mantığı** algoritmanın sevdiği şey: "Bunu yapma #1…#10", "3 gün / 3 bölüm". Yorumlara **video ile yanıt** — en ucuz ikinci içerik.
- Shorts: başlıkta `#Shorts`, uzun videolara "bölüm" olarak bağla; sabitlenmiş yorumda UTM'li bağlantı.
- Haftada 3 TikTok, 2 Shorts (TikTok tekrarları). Ölçüm: izlenme tamamlama oranı > %40 ve paylaşım/izlenme > %1 olan kalıp tekrarlanır.

### 3.5 Telegram — kanal + Zirtan grupları

- **Kanal `@zirtanapp`:** günde 1–2 kısa kart: "Bugün nereye?" (yer, km, süre, hava, su, topluluk notu), anlık tehlike uyarıları (tehlike haritasından, onaylı olanlar), hafta sonu rota anketi (Pazar), haftalık özet. Bot API ile `post --channel telegram` otomatik yayınlar.
- **Şehir grupları:** Zirtan İstanbul / Ankara / İzmir / Antalya (+ Rusça Zirtan Анталия). Kural: etkinlik odaklı, her hafta sonu en az bir "birlikte çıkalım" başlığı; grup yöneticisi = o şehirdeki gönüllü elçi.
- Anketler katılımı 3–5 kat artırır; her kanal gönderisine emoji tepki açık.
- Telegram'dan uygulamaya geçiş: derin bağlantı `zirtan://` + UTM.

### 3.6 Reddit

Reddit'te "reklam kokan her şey banlanır". Hesap 30 gün / 200 karma olmadan gönderi atma.

| Subreddit                               | Kural (özet)                              | Ne yapılır                                                                                               |
| --------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| r/hiking, r/CampingandHiking            | Kendi ürününü tanıtmak yasak / %10 kuralı | Trip report (Kaçkar, Likya): fotoğraf, etap tablosu, maliyet, dürüst dezavantaj                          |
| r/Turkey, r/TurkeyTravel                | Seyahat sorularına cevap                  | "Türkiye'de trekking nereden başlanır?" tarzı sorulara kapsamlı yanıt; profilde bağlantı                 |
| r/climbing, r/scuba, r/Ultralight       | Soru–cevap, ekipman                       | Geyikbayırı sezonu, Kaş dalış noktaları; deneyim paylaşımı                                               |
| r/SideProject, r/androidapps, r/iosapps | Kendi projeni tanıtmak serbest            | "I built an outdoor safety + partner-matching app for Türkiye — feedback?" (AMA tonu, açık yol haritası) |
| r/zirtanapp (kendi topluluğun)           | —                                         | Sürüm notları, özellik oylaması, hata bildirimleri                                                       |

Hashtag yok; başlık spesifik; bağlantı gövdenin sonunda; eleştiriye "haklısın, ekledik" ile dön. Haftada 1 kaliteli gönderi + günde 10 dk yorum.

### 3.7 YouTube uzun format → SEO

8–15 dakikalık rehber videoları arama trafiği getirir ve blog yazısına dönüşür: "Kaçkar Dağları trekking rehberi 2026: rota, ulaşım, konaklama, maliyet", "Likya Yolu'na nasıl başlanır", "Everest Base Camp nasıl gidilir (Türkiye'den)", "Geyikbayırı tırmanış rehberi", "Kaş'ta dalış: 5 nokta".

- Başlık ≤ 60 karakter, anahtar kelime başta; küçük resimde ≤ 4 kelime.
- Açıklama: 2 satır özet + UTM bağlantı, bölüm zaman damgaları, 3 hashtag.
- Her videodan 3 Short + 1 blog yazısı + 1 Reddit trip report çıkar.
- 2 haftada 1 video (tek kişi için sürdürülebilir).

### 3.8 ASO (App Store / Google Play)

Ücretsiz ve kalıcı en büyük kurulum kaynağı. Anahtar kelimeler (TR / EN); başlıkta 1, alt başlıkta 2, açıklamada doğal tekrar:

- **Başlık:** "Zirtan: Doğa, Kamp & Trekking" / "Zirtan: Hiking, Camping & Climbing"
- **Alt başlık (iOS) / kısa açıklama (Play):** "Yürüyüş arkadaşı bul, tehlike haritası, SOS" / "Find hiking partners, hazard map, SOS"
- **Anahtar kelimeler (iOS 100 karakter):** TR `kamp,trekking,dağcılık,tırmanış,dalış,rota,gps,yürüyüş,doğa,kamp alanı,sos,ilk yardım,kaçkar,likya` · EN `hiking,trail,camping,climbing,scuba,trekking,gps,offline map,sos,first aid,turkey,lycian way`
- **Ekran görüntüleri:** 1) ZMatch 2) tehlike haritası radar 3) canlı yayın telemetri 4) SOS + ilk yardım 5) kütüphane/rota 6) kulüpler. Her görselde tek cümle başlık, TR/EN/RU yerelleştirme (ASO'da 9 dilin hepsine en azından başlık/alt başlık).
- **Değerlendirme isteği:** ilk başarılı eşleşme ya da tamamlanan rota sonrası uygulama içi istem (spam değil). Yorumlara yanıt ver (Play'de sıralamaya etkisi var).
- Ölçüm: App Store Connect "Search" kaynaklı kurulum, Play Console "Store listing" dönüşüm oranı; ayda bir anahtar kelime değişimi test et.

### 3.9 SEO landing sayfaları (destinasyon rehberleri)

`zirtan.app/rehber/<destinasyon>` altında statik sayfalar (Expo web export ya da ayrı statik site; ücretsiz barındırma: GitHub Pages / Cloudflare Pages). Her sayfa: özet, etaplar tablosu, ulaşım, mevsim, su, güvenlik (tehlike haritası kesiti), kamp/konaklama (kütüphaneden), SSS (FAQ schema), "Zirtan'de aç" derin bağlantısı.

İlk 12 sayfa: Kaçkar Dağları · Likya Yolu · Kapadokya yürüyüş vadileri · Aladağlar · Ağrı Dağı tırmanışı · Geyikbayırı · Olympos · Kaş dalış noktaları · Uludağ kış · Erciyes · **"Everest Base Camp nasıl gidilir"** (Türkçe'de rakipsiz) · **"Kilimanjaro tırmanışı Türkiye'den"**. EN sürümleri: "Lycian Way complete guide", "Kaçkar trekking guide", "Cappadocia hiking valleys". RU: "Ликийская тропа: полный гид".

YouTube videosu + blog + Reddit gönderisi + Pinterest pini aynı içeriğin dört yüzüdür.

### 3.10 Product Hunt / Indie Hackers / Hacker News lansmanı

- **Hazırlık (2 hafta):** 30 sn tanıtım videosu, 5 ekran görüntüsü, "maker" hikâyesi (Türkiye'de outdoor güvenliği + açık veri), hunter bulma (outdoor/travel kategorisinde aktif biri).
- **Gün:** Salı–Perşembe 00:01 PT; ilk 2 saatte kulüp/Telegram topluluğunu yönlendir (oy dilenme değil, "geri bildirim bırakın"). Tüm yorumlara 10 dk içinde yanıt.
- **Indie Hackers:** "Building an outdoor super-app for Türkiye with open data" günlüğü; aylık metrik paylaşımı (şeffaflık ilgi çeker).
- **Hacker News "Show HN":** açık veri hattı (`tools/data-pipeline`, OSM/Wikidata) teknik açıdan ilgi görür; başlık "Show HN: Open-data outdoor location library + hazard map for Türkiye".
- Beklenen: 300–800 kurulum, 5–10 blog/haber bağlantısı (SEO otoritesi).

### 3.11 Referans döngüsü (davet kodu → Pro günü)

- Her kullanıcının davet kodu; davet edilen ilk maceraya çıkınca **ikisi de 7 gün Pro** kazanır. Kilometre taşları: 3 davet → 1 ay Pro, 10 davet → "Kurucu" rozeti + zirve pasaportu damgası.
- Kulüp kodu: kulüp üyeleri aynı kodla gelir → kulüp sıralamasında XP; en çok üye getiren kulübe dönem sonu ekipman ödülü (ortak markadan, ücretsiz).
- Paylaşım anları: rota tamamlama kartı, rozet, haftalık özet — her biri "arkadaşını davet et" düğmesi ve hazır görsel (Instagram story boyutu).
- Ölçüm: davet başına kurulum (hedef > 0,3), viral katsayı K = davet × dönüşüm (hedef 0,4 → 90. günde organik büyümenin %30'u).

### 3.12 Üniversite kulüpleriyle ortak etkinlik

Uygulamada 14 kulüp dizini zaten var (ODTÜ, Boğaziçi, İTÜ, Hacettepe, Ege, Bilkent, KTÜ, Akdeniz, Sabancı, Ankara, Dokuz Eylül, YTÜ, ETH Zürich, Edinburgh).

**Paket (ücretsiz):** kulüp profili + etkinlik RSVP + .edu doğrulama + kulüp sıralaması + üyelere 1 ay Pro. **Karşılığı:** kulüp Instagram'ında 1 Collab gönderi, etkinlikte "Zirtan ile RSVP", gezi sonrası UGC.

- Dönem başı (Eylül–Ekim) kulüp tanıtım günleri: QR'lı A5 afiş (Canva), 2 dakikalık demo.
- Ortak etkinlik: "Güvenli dağ günü" — 2 saat ilk yardım/tehlike haritası atölyesi (uygulamadaki 12 rehber üzerinden) + kısa yürüyüş; her etkinlik 1 Reel + 1 karusel + Telegram duyurusu.
- Kulüpler arası **dönem ligi** (XP sıralaması) — kulüp gruplarında organik rekabet.

### 3.13 Rehber / eğitmen ortaklıkları (komisyon)

- İlk 20 rehbere **Pro Guide 3 ay ücretsiz**, sonrasında ₺399/ay ya da yalnızca %5 komisyon; rezervasyon getirmezsek ücret yok.
- Rehber ne kazanır: rezervasyon takvimi, ödeme güveni (emanet), öne çıkan profil, drone yayını, öğrencilerinin ZMatch'te "doğrulanmış" rozeti.
- Rehber ne verir: haftada 1 Collab içerik (POV drone, güvenlik ipucu), müşterilerine davet kodu.
- Hedef profiller: dağcılık federasyonu eğitmenleri, PADI/SSI dalış eğitmenleri (Kaş, Bodrum, Ayvalık), yamaç paraşütü pilotları (Ölüdeniz), Kapadokya yürüyüş rehberleri, kayak öğretmenleri (Uludağ, Erciyes, Palandöken).

### 3.14 Basın ve outdoor blogları

- Liste: Türkçe doğa/gezi blogları ve siteleri (doğa yürüyüşü rehber siteleri, kamp/karavan blogları, dağcılık dergileri), İngilizce Türkiye seyahat blogları (Lycian Way odaklı), Rusça Türkiye gezi kanalları, üniversite gazeteleri, teknoloji basını (yerli uygulama hikâyesi).
- Açı: "Türkiye'nin ilk topluluk kaynaklı tehlike haritası", "açık veriyle 10 ülke, 10 tür lokasyon kütüphanesi", "üniversite kulüplerini tek uygulamada birleştiren öğrenci ağı", sezonluk "Kaçkar'da güvenli trekking için 10 kural" (hazır içerik ver, uygulama bir cümle).
- Basın kiti (`zirtan.app/basin`): logo, ekran görüntüleri, kurucu fotoğrafı, 3 paragraf, rakamlar (yalnızca gerçek olanlar).
- Konuk yazı: blog sahibine hazır, SEO uyumlu, orijinal fotoğraflı rehber (karşılığında bir bağlantı). Ayda 2.

## 4. 90 günlük takvim

Başlangıç: ilk Pazartesi (`plan --start`). Haftalık hacim: IG 4–5 + story, TikTok 3, Shorts 2, FB 2 + grup yorumları, VK 2–3, TG 5, Reddit 1, YT uzun 2 haftada 1. `plan` ajanı bu iskeleti tarih ve KPI'larla üretir.

| Hafta | Tema                                      | Odak kanal                 | İçerik türü                                                                | KPI (hafta sonu)                                    |
| ----- | ----------------------------------------- | -------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| 1     | Temel: profiller, bio, ilk 9 gönderi      | IG, TG, VK                 | "Zirtan nedir" karuseli, 3 tanıtım Reel'i, Telegram kanalı, VK topluluğu    | IG 300 takipçi, TG 100, VK 100                      |
| 2     | Güvenlik #1: "Bunu yapma" 1–3             | IG, TikTok, Shorts         | 3 kısa video, ilk UGC izni, ASO metinleri yayında                          | 10K görüntülenme, 150 kurulum                       |
| 3     | "Kaçkar'da 3 gün" serisi                  | IG, TikTok, YT, Reddit     | 3 bölüm Reel + uzun YT video + r/hiking trip report + Kaçkar landing       | Reel erişim 1.500, kaydetme 40, landing 300 ziyaret |
| 4     | Kulüp dönemi başlıyor                     | IG, TG, kampüs             | 5 kulüp Collab, "Güvenli dağ günü" duyurusu, kulüp ligi                    | 8 kulüp, 300 öğrenci                                |
| 5     | Rusça açılış: Likya Yolu                  | VK, TG (RU)                | "Ликийская тропа за 4 дня" uzun gönderi + Clips, Antalya RU grubu          | VK 400 üye, 120 RU kurulum                          |
| 6     | Kamp toplulukları                         | FB grupları, TG            | Kamp alanı kütüphanesi karuseli, 5 grupta trip report, ilk anket           | FB erişim 5K, 5 grup yöneticisi ortaklığı           |
| 7     | Rehber ortaklığı                          | IG DM, Collab              | 10 rehbere teklif, 2 POV drone Reel (izinli), Pro Guide tanıtımı           | 6 Pro Guide, 20 rezervasyon talebi                  |
| 8     | Dalış                                     | IG, YT                     | Kaş dalış noktaları videosu, buddy eşleşme Reel'i, 3 dalış merkezi profili | 5 dalış merkezi, 200 kurulum                        |
| 9     | Güvenlik #2: "Yalnız çıkıyorsan"          | IG, TikTok, Reddit         | 3 adım serisi, r/solotravel & r/hiking cevapları, ilk yardım karuseli      | 50K görüntülenme, paylaşım oranı > %1               |
| 10    | Referans döngüsü açılır                   | Uygulama içi, TG, IG story | Davet kodu → Pro günü; rozet kartları; kulüp kodu yarışı                   | Davet başına kurulum > 0,3                          |
| 11    | Lansman: Product Hunt + Show HN + IH      | PH, HN, Reddit, basın      | Video, maker hikâyesi, açık veri anlatısı, 10 basın e-postası              | PH ilk 10, 500 kurulum, 5 bağlantı                  |
| 12    | Kış'a geçiş + analiz                      | YT, IG, TG                 | "Kışa hazırlık" uzun video, çığ/hipotermi güvenlik serisi, 90 gün raporu   | Toplam 5.000 kurulum, 1.500 WAU, 40 ortak           |
| 13    | Tampon / en iyi 10 içeriği tekrar yayınla | Hepsi                      | `analyze` çıktısına göre                                                   | —                                                   |

## 5. Ölçüm

**UTM şeması:** `utm_source=<kanal>` (instagram, ig_story, tiktok, shorts, youtube, facebook, fb_group, vk, telegram, reddit, ph, blog) · `utm_medium=organic|collab|referral|press` · `utm_campaign=w<hafta>` ya da `<seri-adı>` · `utm_content=<gönderi-id>`. Tüm bağlantılar `zirtan.app/r/<kısa>` yönlendirmesinden geçer (ücretsiz: Cloudflare Redirect Rules).

**Kaynaklar:** App Store Connect (kaynak/ülke bazında kurulum, arama dönüşümü), Play Console (mağaza listesi dönüşümü, anahtar kelime), Meta Business Suite Insights (erişim, kaydetme, paylaşım, profil ziyareti; CSV dışa aktarım), TikTok Analytics, YouTube Studio, VK Статистика (`stats.get`), Telegram kanal istatistiği, Reddit gönderi istatistikleri, uygulama içi olaylar (kurulum → kayıt → ilk eşleşme/rota → 7. gün geri dönüş).

**Haftalık pano (Google Sheets, ücretsiz):** kanal × biçim × erişim/etkileşim oranı/kaydetme/tıklama/kurulum; `analyze --input insights.csv` bu tabloyu okur, özet + gelecek hafta önerisi üretir. Karar kuralları: etkileşim oranı > %5 → biçimi 2×; < %2 iki hafta üst üste → kes; kurulum/tıklama < %10 → landing/ASO metnini değiştir.

**Kuzey yıldızı:** haftalık aktif kullanıcı (WAU) ve "ilk 7 günde bir eşleşme ya da rota tamamlayan kullanıcı oranı" (aktivasyon). Kurulum tek başına hedef değil.

## 6. Ücretsiz / düşük maliyetli araçlar

| İş                    | Araç                                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Planlama ve yayınlama | Meta Business Suite (IG + FB, ücretsiz zamanlama), Buffer Free (3 kanal, 10 gönderi), `agents/marketing post` (IG/FB/VK/TG API, cron ile) |
| Tasarım               | Canva Free (story/karusel/afiş şablonları), Figma (ekran görüntüsü çerçeveleri)                                                           |
| Video                 | CapCut (altyazı, filigransız dışa aktarım), DaVinci Resolve (uzun format), telefon + 3 eksenli gimbal                                     |
| İçerik üretimi        | `agents/marketing plan / generate / reply / analyze` (Claude API; kullanım başı ödeme, aylık birkaç dolar)                                |
| Bağlantı ve ölçüm     | Cloudflare Redirect Rules (UTM kısa bağlantılar), Google Sheets, Looker Studio (ücretsiz pano)                                            |
| Görsel barındırma     | Cloudflare R2 (10 GB ücretsiz) / GitHub Pages — Instagram API için herkese açık medya URL'si                                              |
| Topluluk              | Telegram, Discord (kulüpler için), Google Forms (etkinlik kayıt yedeği)                                                                   |
| SEO                   | Google Search Console, Bing Webmaster, Ahrefs Webmaster Tools (ücretsiz), Ubersuggest (günlük 3 sorgu)                                    |
| Basın                 | Hunter.io (ücretsiz 25 e-posta/ay), Google Alerts ("Likya Yolu", "Kaçkar trekking")                                                       |

## 7. Ücretli reklam ne zaman mantıklı olur (kısa)

Organik döngü kanıtlanmadan reklam para yakar. Şu üç koşul aynı anda sağlandığında **küçük test bütçesi** (günde ₺300–500, 2 hafta) mantıklıdır:

1. Bir organik içerik kendiliğinden **kaydetme/erişim > %3** ve **kurulum/tıklama > %15** vermiştir → o içeriği aynen boost et (Meta "Boost", TikTok Promote).
2. 7. gün elde tutma **> %25** (kurulum satın almanın anlamı için).
3. Hedef pazar net: TR'de sezon başı (Eylül, Nisan) ya da RU pazarında Antalya/Alanya 30 km yarıçap.

Reklamı ölçmek için aynı UTM şeması + kurulum başına maliyet (CPI) < ₺25 hedefi; üstünde kes. ASO ve SEO reklamdan her zaman önce gelir.

## 8. Haftalık ritim (tek kişi, ~12 saat)

| Gün        | İş                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------- |
| Pazartesi  | `analyze` (önceki hafta CSV) → `generate --week N` → içerik onayı, çekim listesi                |
| Salı       | Çekim/kurgu (2 Reel + 3 kısa video), Canva karuseller                                           |
| Çarşamba   | Yayın (`post` + Meta Business Suite zamanlama), Facebook grup yorumları (30 dk), Reddit (15 dk) |
| Perşembe   | Kulüp/rehber DM'leri (10), UGC izinleri, Collab koordinasyonu                                   |
| Cuma       | VK/RU içerik, Telegram hafta sonu anketi, `reply` ile yorum/DM taslakları                       |
| Hafta sonu | Etkinlik (kulüp gezisi / Zirtan şehir grubu) → UGC ham malzeme; günlük story                     |

Ajan komutlarının ayrıntısı: [`agents/marketing/README.md`](../agents/marketing/README.md).
