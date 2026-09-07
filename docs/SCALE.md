# Ölçek ve maliyet — ölçülmüş sayılarla

> Bu belge tahmin değil **ölçüm**. Satır boyutları gerçek şema ve tohum
> verisiyle Postgres üzerinde ölçüldü; para hesabı Supabase'in yayınlanmış
> fiyatlarıyla yapıldı.

## Kural: 100 bin kullanıcıyı kaldıran altyapı, 100 kullanıcı maliyetiyle

Ölçek hazırlığı sunucu satın almak değil; **kullanıcı başına maliyeti sabit ve
küçük tutmak**. Aşağıdaki tek değişiklik, 100 bin kullanıcıdaki aylık faturayı
$1.994'ten $82'ye indirdi.

## Bulunan: 313 sınırsız liste sorgusu

Uzak veri katmanındaki 443 sorgu zincirinin **313'ü** hiçbir sınır
taşımıyordu. 100 kullanıcıda kimse fark etmez.

Ölçüm (gerçek şema, `posts` + gömülü `profiles`):

```
gönderi satırı (JSON, bayt): 1980
```

PostgREST'in Supabase'deki varsayılan tavanı 1.000 satır. Yani **her akış
açılışı ~2 MB** indiriyordu — ve 1.000'inci gönderiden sonrası sessizce
görünmez oluyordu (hata yok, sadece eksik içerik).

### Fatura

Varsayım: kullanıcı günde 4 kez akış açar, ay 30 gün. Supabase Pro $25/ay,
250 GB egress dahil, aşımı $0.09/GB.

| Kullanıcı | Önce (1.000 satır) | Sonra (40 satır) |
| --- | --- | --- |
| 1.000 | 221 GB · **$25** | 9 GB · **$25** |
| 10.000 | 2.213 GB · **$202** | 89 GB · **$25** |
| 100.000 | 22.128 GB · **$1.994** | 885 GB · **$82** |

Cebinizdeki $1.000, birinci sütunda 100 bin kullanıcıda **iki hafta**; ikinci
sütunda **bir yıl** yaşar.

## Yapılan düzeltme

Sınır 313 çağrının her birine ayrı ayrı değil, **tek kapıya** kondu:

```ts
// src/data/remote/postgrest.ts
export const VARSAYILAN_TAVAN = 200;

rows(query, 'akış okunamadı', { limit: 40 })   // açık sayfa boyu
rows(query, 'rozet listesi okunamadı', { limit: 500 })
rows(query, '…', { limit: null })              // bilinçli sınırsız (gerekçeli)
```

Kural: **repository katmanında `.limit()` / `.range()` zincirlenmez.** Sınır
her zaman `rows()` / `maybeRow()` seçeneğinden geçer.

Neden bu kural: sınır zincirde verilirse `rows()` içindeki varsayılan tavan onu
**genişletebilir** (zincirdeki 20, tavandaki 200 ile ezilir). Tek kapı bu sessiz
hatayı imkânsız kılıyor ve tüm sorguların tavanı tek yerden denetlenebiliyor.
`src/data/__tests__/remoteLimits.test.ts` kuralı her repository dosyasında
sınıyor; yeni bir zincir eklenirse test kırılır.

## İkinci ve daha büyük kalem: fotoğraflar

JSON düzeltildikten sonra en büyük kalem görseller. Varsayım: gönderi görseli
~400 KB (istemcide sıkıştırılıyor), akışta ~24 görsel, günde 4 açılış, yerelde
%50 önbellek.

| Kullanıcı | Aylık görsel çıkışı | Supabase aşımı |
| --- | --- | --- |
| 1.000 | 549 GB | ~$27 |
| 10.000 | 5.493 GB | ~$472 |
| 100.000 | 54.932 GB | **~$4.921** |

Yani görseller JSON trafiğinin **60 katı**.

### Çözüm: okuma CDN'den, depolama yerinde

Dosyaları R2'ye taşımak S3 imzalama istemcisi, ayrı yükleme yolu ve göç işi
demek. Oysa maliyetin tamamı **okumada**. Depolama olduğu yerde kalıyor,
okuma çıkışı ücretsiz bir CDN'in (Cloudflare) arkasına alınıyor: ilk okuma
Supabase'e gider, gerisi CDN önbelleğinden. Aynı sonuç, üçte bir iş.

İki değişiklik:

1. **Önbellek ömrü 1 saat → 1 yıl + `immutable`.** Dosya adları her yüklemede
   benzersiz üretiliyor, yani içerik değişmez. Bir saatlik ömür CDN'in işe
   yaramasını engelliyordu: her saat başı kaynağa geri dönülüyordu.
2. **Adres yazımı çizim anında** (`src/domain/media.ts`). Veritabanında
   hâlihazırda duran adresler de yönlenir ve `EXPO_PUBLIC_MEDIA_CDN_URL`
   kaldırılırsa uygulama göç gerektirmeden eski davranışına döner.

Kurulum: Cloudflare'de `cdn.<alan>.app` için Supabase Storage genel yolunu
önbellekleyen bir kural + `EXPO_PUBLIC_MEDIA_CDN_URL`. Maliyet **$0**.

## Ne hâlâ açık

- **313 sorgunun çoğu artık 200 satırlık emniyet ağında.** Ağ faturayı 10 kat
  düşürdü ama her ekranın kendi sayfa boyunu vermesi daha iyi olur. Sıradaki
  iş: en çok çağrılan 20 sorguya açık sayfa boyu.
- **Sonsuz kaydırma yok.** Akış 40 gönderiyle sınırlı; kullanıcı daha eskisini
  göremiyor. Sayfalama arayüzü (`range`) altyapıda hazır, ekranlarda yok.
- **Görsel boyutlandırma yok.** Aynı 400 KB'lık dosya hem küçük listede hem tam
  ekranda kullanılıyor. Cloudflare Image Resizing (ücretli) ya da yüklemede
  küçük boy üretmek çıkışı bir kat daha düşürür.
- **Depolama sınırı.** Supabase ücretsiz katmanı 1 GB dosya; ~2.500 fotoğraf.
  Bu, egress'ten **önce** dolacak sınır.

## $1.000 nasıl harcanmalı

Sıralama, "önce en ucuz kanıt" ilkesine göre. Her satır bir öncekinin
sonucuna bakılarak yapılır.

| Sıra | Kalem | Tutar | Neden şimdi |
| --- | --- | ---: | --- |
| 1 | Google Play geliştirici hesabı | **$25** (tek sefer) | Tek zorunlu harcama. Uygulamayı gerçek telefona sokan tek yol |
| 2 | Alan adı (zirtan.app) | ~$20/yıl | Mağaza kaydı ve bağlantılar için |
| 3 | Supabase — ücretsiz katman | $0 | İlk 1.000 kullanıcı için yeterli |
| 4 | Cloudflare R2 (harita paketleri) | $0 | 10 GB depolama, **çıkış ücretsiz** |
| 5 | FCM bildirim | $0 | Ücretsiz; eksik olan istemci kodu |
| 6 | Apple geliştirici | $99/yıl | **Android kanıtlandıktan sonra.** Türkiye'de Android payı yüksek |
| 7 | Supabase Pro | $25/ay | Ücretsiz katman dolunca (~1.000 aktif kullanıcı) |
| 8 | Yedek / aşım tamponu | ~$400 | Beklenmeyen egress, SMS, AI |

**Harcanmayacaklar:** reklam (organik döngü kanıtlanmadan para yakar), sunucu
(Supabase yeterli), ücretli araç (hepsinin ücretsiz katmanı yeterli).

### İki maliyet bombası ve kesici sigortaları

| Risk | Neden patlar | Sigorta |
| --- | --- | --- |
| **SMS OTP** | Bot kaydı; her denemede para. 100 bin kayıtta kolayca $750+ | v1'de **kapalı**; e-posta girişi. Açılırsa IP+cihaz başına günlük tavan ve CAPTCHA |
| **AI ağ geçidi** | Token maliyeti kullanıcı sayısıyla doğrusal artar | v1'de **kapalı**. Açılırsa kullanıcı başına günlük kota ve aylık sabit tavan |

Bu ikisi kapalıyken **ve medya CDN'i açıkken** 100 bin kullanıcının aylık
maliyeti ~$82 + $25 = **~$107**. CDN olmadan aynı rakam **~$5.000**.

## Büyüme sayısı üzerine dürüst not

"İlk ay 10.000, yıl sonunda yüz binlerce kullanıcı" hedefi bu altyapıyla
**taşınabilir**; ama bu sayıyı üretecek olan altyapı değil dağıtımdır. Kendi
büyüme belgeniz (`docs/GROWTH.md`) 90 günde 5.000 kurulum hedefliyor — istenen
rakam onun altı katı hızda. Bugün elde sosyal hesap, mağaza kaydı ve kurulum
atıfı yok; bunlar olmadan hiçbir rakam ölçülemez bile.

Mühendislik tarafının sözü şu: **gelirse çöker mi? Hayır. Gelmezse para yakar
mı? Hayır.** Gerisi dağıtım işidir.
