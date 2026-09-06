import type {
  Certificate,
  Course,
  CourseReview,
  CourseSession,
  Enrollment,
  GeoPoint,
  Lesson,
} from '@/domain';
import { certificateCode } from '@/domain';

/**
 * Eğitimler demo verisi. Kurslar gerçek dünya müfredatlarına (TDF, AIARE, WFA/WFR,
 * PADI, THK, SHGM, Leave No Trace…) dayanır; isimler ve kurumlar jeneriktir.
 * Tarihler "şimdi"ye göreli üretilir.
 *
 * `u_me`: WFA'yı tamamlamış (sertifikalı), Çığ 1'de %40, Kaya 1 oturumuna kayıtlı.
 */

const unsplash = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();
const monthsAgo = (m: number) => daysAgo(m * 30);
const at = (daysAhead: number, hour: number) => {
  const date = new Date(now + daysAhead * 86_400_000);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const VIDEO_URL =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const VIDEO_URL_2 =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';

/* ------------------------------------------------------------------ */
/* Ders yapıcıları                                                     */
/* ------------------------------------------------------------------ */

type LessonDraft = Omit<Lesson, 'id' | 'courseId' | 'moduleTitle' | 'order' | 'preview'>;
type Quiz = NonNullable<Lesson['quiz']>;

const video = (title: string, durationMin: number, alt = false): LessonDraft => ({
  title,
  type: 'video',
  durationMin,
  videoUrl: alt ? VIDEO_URL_2 : VIDEO_URL,
  body: '',
  quiz: null,
});
const reading = (title: string, durationMin: number, body: string): LessonDraft => ({
  title,
  type: 'reading',
  durationMin,
  videoUrl: null,
  body,
  quiz: null,
});
const quiz = (title: string, questions: Quiz, durationMin = 10): LessonDraft => ({
  title,
  type: 'quiz',
  durationMin,
  videoUrl: null,
  body: '',
  quiz: questions,
});
const practical = (title: string, durationMin: number, body: string): LessonDraft => ({
  title,
  type: 'practical',
  durationMin,
  videoUrl: null,
  body,
  quiz: null,
});

/** Modülleri düz ders listesine çevirir; ilk iki ders önizleme. */
function buildLessons(
  courseId: string,
  modules: { title: string; items: LessonDraft[] }[],
  previewCount = 2,
): Lesson[] {
  const out: Lesson[] = [];
  let order = 0;
  for (const m of modules) {
    for (const item of m.items) {
      order += 1;
      out.push({
        ...item,
        id: `${courseId}_l${order}`,
        courseId,
        moduleTitle: m.title,
        order,
        preview: order <= previewCount,
      });
    }
  }
  return out;
}

function session(
  courseId: string,
  n: number,
  daysAhead: number,
  days: number,
  locationName: string,
  coords: GeoPoint | null,
  seats: number,
  seatsLeft: number,
  priceTry: number,
): CourseSession {
  return {
    id: `${courseId}_s${n}`,
    courseId,
    startsAt: at(daysAhead, 9),
    endsAt: at(daysAhead + days - 1, 17),
    locationName,
    coords,
    seats,
    seatsLeft,
    priceTry,
  };
}

/* ------------------------------------------------------------------ */
/* Okuma metinleri                                                     */
/* ------------------------------------------------------------------ */

const R = {
  layering:
    'Dağda giyinmenin temel kuralı katmanlamadır: iç katman teri deriden uzaklaştırır, orta katman ısıyı tutar, dış katman rüzgâr ve yağıştan korur. Pamuk iç katman terle ıslanınca kurumaz ve hipotermi riskini artırır; bu yüzden dağcılar "pamuk öldürür" der. Merino yün ya da sentetik iç katman tercih edilir.\n\nOrta katman olarak polar, sentetik dolgulu (Primaloft benzeri) ya da kaz tüyü ceket kullanılır. Kaz tüyü ağırlığına göre en sıcak seçenektir ama ıslanınca izolasyonunu kaybeder; nemli iklimlerde sentetik dolgu daha güvenlidir. Dış katman su geçirmez ve nefes alabilir bir kabuk olmalı; koltuk altı fermuarları terlemeyi yönetmenin en pratik yoludur.\n\nAltın kural: Yürürken hafif üşüyecek kadar giyin. Molada hemen bir katman ekle, yürümeye başlayınca çıkar. Terleyip sonra durmak, dağda en sık görülen soğuk yaralanması senaryosudur. Eldiven ve bere için her zaman bir yedek taşı; el ve baş ısı kaybının en hızlı olduğu bölgelerdir.\n\nEkipman listesinin en altına şunu yaz: acil bir gecelemede seni hayatta tutacak katmanların çantada mı? Cevap hayırsa çanta eksiktir.',
  lightning:
    'Yıldırım, yaz dağcılığının en çok küçümsenen tehlikesidir. Sırt, zirve ve açık yamaçlar en riskli yerlerdir; sarp kayalıklardaki mağara ağızları ve tek başına duran ağaçlar da sanıldığının aksine korumaz.\n\n30/30 kuralı: Şimşeği gördükten sonra gök gürültüsünü duyana kadar 30 saniyeden az geçiyorsa fırtına 10 km\'den yakındadır ve derhal güvenli konuma inilmelidir. Son gök gürültüsünden sonra 30 dakika geçmeden yüksek araziye dönülmez. Ses saniyede yaklaşık 340 m gider; saniye sayısını 3\'e bölmek km cinsinden mesafeyi verir.\n\nPlanlama en iyi savunmadır: Yaz aylarında dağlarda konveksiyon fırtınaları tipik olarak öğleden sonra gelişir. Bu yüzden "alp başlangıcı" (alpine start) yapılır: gece yarısı ya da şafaktan önce yola çıkıp öğleye kadar zirveden inmiş olmak.\n\nYakalanırsan: Metal ekipmanı (kazma, karabinalar) birkaç metre uzağa bırak, gruptan 15–20 m açılarak sırt çantasının ya da matın üzerine ayaklar bitişik çömel. Yere yatma; yer akımı vücut boyunca geçer. Yıldırım çarpan kişide kalp masajı öncelik taşır; kurban elektrik taşımaz, hemen müdahale edilir.',
  knots:
    'Dağcılıkta her düğümün bir görevi vardır ve doğru düğümü seçmek kadar düğümü kontrol etmek de önemlidir. Temel beş düğüm:\n\n1. Sekizli (figure-8 follow-through): İpi emniyet kemerine bağlamanın standardıdır. Kolay kontrol edilir, yük altında bile açılabilir. Kuyruk uzunluğu en az 10 cm olmalı.\n2. Kazık bağı (clove hitch): Kendini bir ankraja hızla bağlamak ve ip uzunluğunu ayarlamak için. Yük yönü değişince kayabilir; her zaman kilitli karabinaya atılır.\n3. Prusik: İnce bir yardımcı ip halkasının (5–6 mm) ana ipe sarılmasıyla oluşur; yük binince kilitlenir, gevşeyince kayar. İp tırmanma, kendini kurtarma ve yedek emniyet için.\n4. Münter (İtalyan) düğümü: Belay cihazın düştüğünde tek bir HMS karabinayla emniyet almanı sağlar.\n5. Çift balıkçı (double fisherman): İki ipi ya da prusik halkasını birleştirmek için; yükten sonra çözülmesi zordur, kalıcı halkalarda kullanılır.\n\nHer düğümü "giydir" (dress): şeritlerin paralel ve düzgün olmasını sağla, sonra yük vererek sık. Partner kontrolü her tırmanışın ayrılmaz parçasıdır: düğüm, kemer tokası ve belay cihazı — üçü de karşılıklı kontrol edilir.',
  triangle:
    'Çığ üçgeni üç bacaktan oluşur: arazi, kar örtüsü ve hava. Ortasında ise insan vardır; çığ kazalarının %90\'ından fazlasında çığı kurban ya da grubundan biri tetikler.\n\nArazi: Çığlar en sık 30–45° eğimde tetiklenir; 38° en tehlikeli açıdır. Eğim ölçer taşımak ve kullanmak temel beceridir. Dışbükey (konveks) yamaçlar, rüzgâr altı (lee) yüzler ve arazi tuzakları (dere yatakları, uçurum üstleri, yoğun ağaçlık altındaki derin çukurlar) sonuçları ağırlaştırır.\n\nKar örtüsü: Sorun, zayıf bir tabakanın üstündeki tutarlı tabaka (slab) ile çıkar. Rüzgâr slabı, fırtına slabı, kalıcı zayıf tabaka (derin şeker karı / kırağı) ve ıslak çığlar temel problem tiplerini oluşturur. Kar profili ve kompresyon testi bu tabakaları görmeye yarar ama tek başına güvenli demez.\n\nHava: 24 saatte 30 cm\'den fazla yeni kar, kuvvetli rüzgâr taşıması, hızlı ısınma ve yağmur, tehlikeyi hızla artıran dört unsurdur.\n\nKarar verme: Günlük çığ bülteni (tehlike ölçeği 1–5) planlamanın başlangıç noktasıdır. "Düşük" tehlike sıfır tehlike değildir; ölümcül kazaların önemli kısmı "kayda değer" (3) seviyede olur.',
  companionRescue:
    'Çığa gömülen birinin hayatta kalma olasılığı ilk 15 dakikada %90\'ın üzerindeyken 35. dakikada %30\'a düşer. Dış kurtarma ekibi bu sürede gelemez; tek gerçek şans, gruptaki arkadaşların yaptığı kurtarmadır.\n\nDonanım üçlüsü: Transceiver (çığ vericisi), sonda ve kürek. Üçünden biri eksikse çığ arazisine girilmez. Verici her sabah grup kontrolü ile test edilir: Herkes "gönder" modunda, lider "ara" moduna alıp tek tek yaklaşırken sinyali doğrular.\n\nArama aşamaları: 1) Kaybolma noktasını ve çığ akış yönünü belirle, güvenlik değerlendirmesi yap (ikinci çığ riski). 2) Sinyal arama: 30–40 m şeritlerle çığ alanını tarayarak ilk sinyali yakala. 3) Kaba arama: Cihazın ok/mesafe göstergesini takip et, 3 m altında yavaşla. 4) Hassas arama: Cihazı kar yüzeyine paralel tutarak çapraz tarama ile en düşük mesafeyi bul. 5) Sonda: En düşük noktadan başlayarak 25 cm aralıklı spiral. 6) Kürek: Sondayı yerinde bırak, yamaç aşağı 1,5× gömü derinliği uzaklıktan V şeklinde konveyör kazısı yap.\n\nKazı en çok zaman alan aşamadır; 1 m derinlikte tek kişi 10 dakikadan fazla kazar. Bu yüzden iki-üç kişilik kürek rotasyonu eğitimin önemli parçasıdır.',
  lakeLouise:
    'Akut Dağ Hastalığı (AMS) genellikle 2.500 m üzerinde, hızlı yükselen kişilerde 6–12 saat içinde ortaya çıkar. Lake Louise Puanlama Sistemi yükseklikte yeni gelişen baş ağrısı zorunlu belirti olmak üzere şu dört maddeyi puanlar (0–3): baş ağrısı, mide-bağırsak belirtileri (iştahsızlık, bulantı, kusma), halsizlik/yorgunluk ve baş dönmesi. Toplam 3–5 hafif, 6–9 orta, 10–12 şiddetli AMS olarak sınıflanır.\n\nAltın kurallar: 1) Yükseklikte gelişen her belirti aksi kanıtlanana kadar dağ hastalığıdır. 2) AMS belirtisi varken daha yükseğe çıkılmaz. 3) Belirtiler kötüleşiyorsa ya da HACE/HAPE bulguları varsa derhal inilir.\n\nHACE (beyin ödemi): Ataksi — topuk-burun çizgi testinde dengeyi kaybetme — ve bilinç değişikliği. HAPE (akciğer ödemi): Dinlenirken nefes darlığı, kuru öksürüğün köpüklü pembe balgama dönmesi, hızlı nabız. Her ikisi de saatler içinde öldürebilir; tedavi inmektir, mümkünse 500–1.000 m.\n\nÖnleme: 3.000 m üstünde uyku irtifasını günde 300–500 m\'den fazla artırma, her 1.000 m\'de bir dinlenme günü ("yükseğe tırman, alçakta uyu"). Asetazolamid hızlı yükselmelerde profilaksi olarak kullanılır; ilaç kararı hekimle alınır.',
  declination:
    'Pusula manyetik kuzeyi, harita ise grid (coğrafi) kuzeyi gösterir. Aradaki fark manyetik sapmadır (deklinasyon) ve Türkiye\'de 2025 itibarıyla yaklaşık +5° ile +7° doğu arasındadır; batıdan doğuya doğru artar ve her yıl yaklaşık 0,1° değişir.\n\nHaritadan araziye kerteriz: Pusulanın kenarını bulunduğun nokta ile hedefin üzerine koy; kadranı harita gridine paralel çevir; okuduğun grid açısından deklinasyonu çıkar (doğu sapmada "harita → pusula: çıkar"). Ayarlanabilir kadranlı pusulalarda deklinasyon bir kez ayarlanır ve bu hesap ortadan kalkar.\n\nArazi kerterizi ile konum bulma (kesişme / resection): Haritada tanıdığın iki belirgin nesneye (zirve, kule, göl köşesi) kerteriz al, 180° ekleyerek geri kerterize çevir, haritada her iki çizgiyi çiz; kesişim noktası yerindir. Üç kerterizle "hata üçgeni" küçültülür.\n\nAdımlama ve zaman: 100 metrede attığın çift adım sayısını bil (çoğu yetişkinde 60–70). Naismith kuralı: saatte 5 km yatay + her 600 m tırmanış için 1 saat. Sis ve karda GPS\'e güvenirken pil, soğuk ve kanyon etkisini hatırla; harita-pusula her zaman yedek değil, birincil beceri olmalı.',
  gps: 'Modern navigasyon üç aracın birlikte kullanımıdır: kağıt harita + pusula, telefon/saat GPS uygulaması ve uydu haberleşme cihazı. Her birinin zayıf noktası vardır; ikisini birden kaybetmeyecek şekilde plan yap.\n\nKoordinat sistemleri: Enlem/boylam (WGS84) uluslararası standarttır; Türkiye\'de arama-kurtarma ekipleri genellikle ondalık derece (örn. 40.9903, 29.0293) ya da derece-dakika kullanır. UTM ise metre tabanlıdır ve haritada mesafe ölçmeyi kolaylaştırır. Acil durumda konumu bildirmeden önce hangi formatı okuduğunu söyle.\n\nÇevrimdışı haritalar: Rota bölgesini kapsayan raster/vektör harita katmanlarını ve yükseklik verisini evden çıkmadan indir. Telefonu uçak moduna al, ekran parlaklığını düşür, güç bankası taşı; soğukta pil kapasitesi %50 düşebilir, telefonu iç cebinde taşı.\n\nİz kaydı (track) ve rota (route) farklıdır: iz geçmişini, rota planını gösterir. Dönüş yolunu bulamama en sık kaybolma nedenidir; "geri izle" (backtrack) fonksiyonunu kullanmayı sisli havada değil, evde öğren. Bir yol noktası (waypoint) her sapağa değil, karar noktalarına konur.',
  buoyancy:
    "Su altında serbestçe süzülmenin sırrı nötr yüzerliktir: Ne batarsın ne yükselirsin. Üç değişkenle kontrol edilir — ağırlık sistemi, BCD hava miktarı ve akciğerlerin.\n\nDoğru ağırlık: Yüzeyde boş BCD ve normal nefesle göz hizasında durmalısın; nefes verince yavaşça batmaya başlamalısın. Fazla ağırlık en yaygın hatadır: dalgıç BCD'ye sürekli hava basar, hava tüketimi artar, dip çamuru kalkar. Dalışın sonunda 50 bar ile 5 m'de güvenlik duruşu yapabilecek kadar ağırlık şarttır; tüp boşaldıkça yaklaşık 2 kg hafifler.\n\nNefes: Derin, yavaş ve sürekli. Asla nefes tutma — yükselirken akciğerlerdeki genişleyen hava barotravma yapabilir (Boyle yasası: 10 m'den yüzeye çıkarken hacim iki katına çıkar). Küçük derinlik ayarlamalarını nefesle, büyükleri BCD ile yap.\n\nTrim: Yatay vücut pozisyonu sürtünmeyi ve hava tüketimini azaltır, palet vuruşunu verimli kılar, dibe zarar vermeni önler. Ağırlıkların dağılımını (tüp yüksekliği, trim cepleri) her yeni ekipman konfigürasyonunda tekrar ayarla.",
  noDeco:
    'Basınç altında solunan nitrojen dokularda çözünür; yüzeye çok hızlı ya da çok fazla nitrojenle çıkmak dekompresyon hastalığına (DCS) yol açar. Eğlence dalışı "dekompresyonsuz limit" (NDL) içinde yapılır: Bu süre ve derinlik içinde dalıp doğrudan yüzeye çıkabilirsin.\n\nTipik NDL değerleri (hava, ilk dalış): 12 m → 147 dk, 18 m → 56 dk, 24 m → 29 dk, 30 m → 20 dk, 40 m → 9 dk. Değerler dalış bilgisayarının algoritmasına göre değişir; ikinci dalışlar için kalıntı nitrojen hesaba katılır.\n\nÇıkış hızı: Dakikada 18 m\'den (bazı bilgisayarlarda 9–10 m) yavaş. 5 m\'de 3 dakika güvenlik duruşu her dalışın standart parçasıdır. Uçuş öncesi bekleme: tek dalıştan sonra 12 saat, çoklu dalıştan sonra 18 saat.\n\nDCS belirtileri: eklem ağrısı, ciltte döküntü, uyuşma, olağandışı yorgunluk, baş dönmesi. Dalış sonrası 24 saat içinde görülürse %100 oksijen ver, dalış acil hattını ara, basınç odasına yönlendir. Alkol, dehidrasyon, soğuk ve yorgunluk riski artırır. Bilgisayarın planlanan derinlik/süreyi korumaz; sen korursun.',
  lnt: 'Leave No Trace (İz Bırakma) yedi ilkesi, doğada gruplarla hareket ederken etkini en aza indirmek için evrensel bir çerçevedir.\n\n1. Önceden planla ve hazırlan: Bölge kurallarını, hava ve tehlikeleri öğren; küçük gruplar halinde git; yiyeceği ambalajından çıkarıp tekrar paketle.\n2. Dayanıklı yüzeylerde yürü ve kamp yap: Patika, kaya, çakıl, kuru ot ya da kar. Kampı sudan en az 60 m (yaklaşık 70 adım) uzağa kur; iyi kamp yerleri bulunur, yapılmaz.\n3. Atığı doğru şekilde uzaklaştır: Getirdiğin her şeyi geri götür. İnsan dışkısı için 15–20 cm derinlikte "kedi çukuru", sudan ve kamptan 60 m uzakta; tuvalet kağıdı çantaya.\n4. Bulduğunu bırak: Taş, bitki, tarihi kalıntı yerinde kalır; kaya üstüne taş kule yapma.\n5. Ateşin etkisini en aza indir: Ocak kullan; ateş şartsa mevcut ocakta, bilek kalınlığından ince, yerden toplanmış odunla; sonuna kadar yak ve soğut.\n6. Yaban hayatına saygı göster: Uzaktan izle, besleme, yiyeceği güvenle sakla.\n7. Diğer ziyaretçilere saygılı ol: Yokuş yukarı çıkanlara yol ver, sesini kıs, patikada hoparlör açma.\n\nEğitmen kursunda bu ilkeleri "otorite" değil "etki" diliyle anlatmayı öğrenirsin: kural değil, sonuç göster.',
  ruleOfThirds:
    'Outdoor fotoğrafçılığında en büyük fark ekipmanla değil ışıkla ve kompozisyonla yapılır. Üçte bir kuralı ilk adımdır: Kadrajı yatay ve dikey üçe böl; ufuk çizgisini ortaya değil, gökyüzü ilginçse alt üçe, ön plan ilginçse üst üçe koy. Ana özneyi çizgilerin kesişimine yerleştir.\n\nÖn plan – orta plan – arka plan: Bir dağ manzarasına derinlik katan şey öndeki kaya, çiçek ya da yürüyen kişidir. Geniş açıda (16–24 mm) ön plana yaklaş ve diyaframı f/8–f/11 arasında tut; hiperfokal mesafeye odaklanmak hem ön hem arka planı net verir.\n\nAltın saat ve mavi saat: Gündoğumundan sonraki ve günbatımından önceki bir saat yumuşak, sıcak, yan ışık verir; gölgeler dokuyu ortaya çıkarır. Öğle güneşi düz ve serttir. Bulutlu hava ormanda ve şelalede en iyi ışıktır.\n\nÖlçek için insan: Devasa bir buzul fotoğrafında minik bir figür, izleyiciye büyüklüğü hissettirir. Kişiyi parlak, kontrast bir renkle giydir ve kadrajın üçte bir noktasına koy.\n\nTeknik notlar: RAW çek, histogramı sağa yasla ama patlatma, polarize filtre gökyüzü ve su yansımalarını kontrol eder, güneşe 90° açıda en etkilidir.',
  pacing:
    'Patika koşusunda en yaygın hata yolda koşar gibi başlamak ve ilk tırmanışta patlamaktır. Temel ilke: eforu tempoya değil, nabza ve nefese göre yönet. Tırmanışta yürümek zayıflık değil stratejidir; %15 üstü eğimde çoğu elit koşucu bile "güç yürüyüşüne" geçer.\n\nİniş tekniği: Bakışını 3–5 m ileriye tut, adımları kısa ve hızlı at, kolları dengeleyici olarak aç, topuk yerine orta ayakla in. Frenlemek diz ve quadriceps\'i yorar; eğim izin veriyorsa yerçekimini kullan. Teknik inişlerde tempo, yavaş gitmekten değil düşmemekten çıkar.\n\nBeslenme ve sıvı: 90 dakikayı aşan koşularda saatte 40–60 g karbonhidrat ve 400–600 ml sıvı hedefle. Sıcakta sodyum eklemeyi unutma; hiponatremi susuzluk kadar tehlikelidir. Her şeyi antrenmanda dene, yarışta yeni bir şey yeme.\n\nZorunlu ekipman: Dağ yarışlarında rüzgârlık, ısıl battaniye, düdük, kafa lambası, telefon ve en az 500 ml su genelde zorunludur. Kısa antrenmanlarda bile hava değişimine karşı bir kabuk taşı; dağda 20 dakika hipotermi için yeter.',
  shelter:
    "Kış kampında barınak seçimi, çadır kadar kar barınaklarını da kapsar. Kar hava ile dolu bir yalıtkandır: dışarısı -20 °C iken iyi yapılmış bir kar mağarasının içi 0 °C civarında kalır ve rüzgârı tamamen keser.\n\nKar mağarası: En az 1,5–2 m derin, sıkışmış bir kar yamacı gerekir. Giriş tünelini alçakta, yatak platformunu girişten yüksekte yap; soğuk hava aşağıda toplanır. Tavanı kubbe biçiminde ve en az 30 cm kalınlıkta bırak, bir tavan havalandırma deliği aç ve gece boyunca açık tut (kaçak gaz, karbondioksit). Kazı 1–3 saat sürer ve terletir; kabuğunu giy, iç katmanı kuru tut.\n\nQuinzhee: Yeterli derin kar yoksa büyük bir kar yığını oluştur, 1–2 saat sinterleşmesini bekle, sonra içini oyarak duvarları 30 cm kalınlıkta bırak. Duvar kalınlığını kontrol için dışarıdan 30 cm'lik çubuklar sapla.\n\nÇadır kurulumu: Karı bastırıp düzleştir, kar kazığı ya da gömülü çanta/kayak ile ankraj yap, rüzgâr yönünü düşün, çadır çevresine 50 cm kar duvarı ör. Çadır içinde asla ocak yakma; yakacaksan apsiste, havalandırma açık ve ocak elde.\n\nUyku sistemi: Yalıtım altındadır — R değeri 4+ mat, ilave köpük mat, konfor sıcaklığı hedefe göre uyku tulumu, tulumu çadırda kurutmak için sabah ters çevir.",
  ams_equipment:
    "Himalaya ve Pamir gibi 6.000 m üzeri seferlerde ekipman, yükseklik ve süreye göre sistemleştirilir. Ayak: Çift botlu ya da entegre tozluklu 6000'lik/8000'lik dağcılık botu, otomatik krampon, iki çift kalın çorap ve bot içi kurutulacak astar.\n\nEl: Astar eldiven, iş eldiveni, şişme tüy eldiven (mitten) — üç katman ve yedek. Baş: Balaklava, kar gözlüğü kategori 4 ve yedek gözlük; kar körlüğü 6–12 saatte gelişir ve saatlerce kör bırakır.\n\nGövde: Tüy tulum ya da 800+ fill tüy parka, ara katmanlar, kabuk. Uyku: -30 °C konfor tulum, iki mat. Teknik: Kemer, jümar, iniş sekizi/ATC, 3 kilitli karabina, 2 prusik, kazma, kask, 30 m 8 mm kişisel ip.\n\nGüç ve iletişim: Uydu mesajlaşma cihazı ya da uydu telefonu, güneş paneli, güç bankaları (soğukta iç cepte), kafa lambası + yedek piller. Sağlık: Kişisel ecza çantasında asetazolamid, deksametazon, nifedipin, geniş spektrum antibiyotik, ağrı kesici, yara bakımı — hepsi hekim danışmanlığıyla ve kullanımı öğrenilmiş olarak.\n\nAklimatizasyon planı ekipmanın bir parçasıdır: Ana kampa ulaşmadan 3.500 m'de en az iki gece, ileri kamplara yükleme–iniş döngüleriyle \"yükseğe tırman, alçakta uyu\".",
  droneRules:
    "Türkiye'de sivil insansız hava aracı (İHA) operasyonları SHGM'nin İHA Talimatı (SHT-İHA) ile düzenlenir. 500 g – 4 kg arası araçlar İHA0, 4–25 kg İHA1 sınıfındadır; 500 g üstü her araç ve pilotu İHA Kayıt Sistemi'ne kaydolur. İHA1 ve üstü için SHGM onaylı eğitim kurumundan uçuş sertifikası gerekir.\n\nTemel uçuş kuralları: Görüş hattı içinde (VLOS) uç; azami 120 m (400 ft) AGL; kalabalık, insan toplulukları, otoyollar ve kritik altyapı üzerinde uçuş yasak; havalimanı ve heliport çevresindeki 9 km'lik yasak sahalar ile askeri bölgelere uçuş izinsiz yapılamaz. Milli parklar ve sit alanları için ayrı izin alınır.\n\nUçuş izni: İHA1 ve üstü her uçuş öncesi İHA Kayıt Sistemi üzerinden uçuş izni talep edilir; İHA0 için de kısıtlı sahalarda izin gerekir. Bulunduğun sahanın statüsünü resmi harita katmanından kontrol et.\n\nSigorta ve sorumluluk: Üçüncü şahıs mali mesuliyet sigortası İHA1 için zorunludur. Pilot, uçuş öncesi hava durumu (rüzgâr limiti çoğu araçta 10–12 m/s), pil sıcaklığı ve dönüş rezervi (%30) kontrolünden sorumludur. Dağda uçuş: Yükseklik arttıkça hava inceldiği için motor yükü artar, pil ömrü düşer, rüzgâr rotorları beklenmedik yönden gelir.",
  paddleSafety:
    'Kürek sporlarında en tehlikeli senaryo soğuk suya beklenmedik düşmedir. Su sıcaklığı 15 °C altında olduğunda "soğuk şoku" ilk 1–3 dakikada nefes kontrolünü bozar; yüzme yeteneği 10–30 dakikada kaybolur. Bu yüzden kural: Su sıcaklığına göre giyin, hava sıcaklığına göre değil. 10 °C altı için kuru elbise, 10–15 °C için kalın wetsuit.\n\nCan yeleği (PFD) her zaman giyilir — kanoda "yanımda" değil "üzerimde". Beyaz su kanosunda kask şart; deniz kayağında boğazlanmış yelek ve düdük.\n\nKendini kurtarma: Kayaktan çıkınca teknenin yukarı akış tarafında kal (tekne seni kayaya sıkıştırmasın), ayakları öne uzatıp sırtüstü yüz, ayakları dibe basma (ayak sıkışması ölümcüldür). Deniz kayağında paddle-float ile yeniden binme ve T-kurtarma temel becerilerdir; rulo öğrenilene kadar yakın kıyıda kal.\n\nGrup güvenliği: Üç tekne minimum; öndeki ve arkadaki tekne belirlenir, işaretler (kürek dik = toplan, yatay = dur) önceden anlaşılır. Nehirde her şelale/rapid önce kıyıdan gözlenir; kanoya binmeden kaçış rotası planlanır. Deniz kayağında gelgit, akıntı ve açık deniz rüzgârı — kıyıya paralel kal, planlanan dönüş saatini kıyıda birine bildir.',
  thermal:
    'Termik, güneşin ısıttığı yüzeyden kalkan sıcak hava sütunudur. Kalkış noktaları: güneye bakan taş yamaçlar, sürülmüş tarla, kaya çıkıntıları ve köy alanları; ormanlar ve göller termik üretmez ama rüzgâr altındaki tepeler birleşik termikler doğurabilir.\n\nTermiği bulmak: Sıcak hava ile kümülüs bulutu arasındaki bağ — bulut oluşumunun taze, keskin kenarlı olduğu bulutun altı en iyi tırmanış alanıdır; dağılan bulut ölü termiktir. Kuşlar, rüzgâr altındaki tozlar ve variometrenin tıklaması ipucu verir.\n\nMerkezleme: Tırmanışa girince variometrenin en yüksek okunduğu tarafa doğru dönüşü genişlet, düşen tarafta daralt. 360° dönüşte tutarlı bir tırmanış sağlanana kadar dönüş açısını ayarla. Diğer pilotlar termikteyse ilk giren dönüş yönünü belirler; herkes aynı yönde döner.\n\nXC (cross-country) kararları: Her termikten çıkışta "sıradaki termik nerede?" sorusunu cevaplayacak bir planla ayrıl. Bulut tabanına yaklaşırken en az 300 m altta kal; bulutun emişine kapılmak ölümcüldür. Süzülüş oranını ve rüzgârı hesaba katarak iniş alanını her zaman ulaşılabilir mesafede tut. Hava limanlarına ve yasak sahalara uzak dur.',
  wfaPatient:
    'Doğada ilk yardımın belkemiği sistematik hasta değerlendirmesidir. Panik yerine sırayla ilerle:\n\n1. Olay yeri güvenliği: Kaya düşmesi, akıntı, çığ, elektrik? Kendini ve grubu koru; ikinci bir kazazede yaratma. Eldiven tak.\n2. Birincil değerlendirme (ABCDE): Airway (hava yolu açık mı?), Breathing (soluk alıyor mu, hızı?), Circulation (nabız, ciddi kanama — turnike/doğrudan baskı), Disability (bilinç düzeyi: AVPU — uyanık, sese, ağrıya yanıt, yanıtsız; omurga koruması), Environment/Exposure (hipotermi, ısı, giysileri aç ama koru).\n3. İkincil değerlendirme: Baştan ayağa muayene, vital bulgular (nabız, solunum, cilt rengi/sıcaklığı, bilinç) ve SAMPLE öyküsü: Semptomlar, Alerjiler, Medikasyonlar, geçmiş hastalıklar (Past), son yenilen (Last meal), olay (Events).\n4. Sorun listesi ve plan: Her sorun için "ne yaparım, neyi izlerim, ne değişirse planı değiştiririm?"\n5. Tahliye kararı: Kendi başına yürüyebilir mi, taşıma gerekir mi, dış yardım çağrılır mı? Zaman, mesafe, hava ve grup yeteneğini tart.\n\nVital bulguları 15 dakikada bir tekrarla ve yaz: Eğilim, tek bir ölçümden daha çok şey söyler. Hastayla konuşmayı sürdür; bilinç değişimi ilk fark edeceğin uyarıdır.',
  hypothermia:
    'Hipotermi vücut çekirdek sıcaklığının 35 °C altına düşmesidir; yazın ıslak ve rüzgârlı bir sırtta bile gelişir. Hafif: Titreme, beceriksizlik, "mumbles-fumbles-stumbles-grumbles" (mırıldanma, sakarlık, sendeleme, huysuzlanma). Orta: Titreme durur, bilinç bulanıklaşır, karar verme bozulur. Şiddetli: Yanıtsız, nabız ve solunum çok yavaş — ölü sanılır.\n\nMüdahale: Islak giysileri çıkar, hastayı yerden yalıt (mat), "hipotermi sarması" yap: Alt kat mat, sonra uyku tulumu, içine hasta, göğüs kafesine sıcak su şişeleri ya da kimyasal ısıtıcı (deriye doğrudan değil), en dışa su geçirmez örtü ve kafa kapalı. Bilinci açıksa sıcak, şekerli içecek ve yiyecek ver; titremek kalori gerektirir.\n\nŞiddetli hipotermide hastayı nazikçe taşı — kaba hareket kalpte ölümcül ritim bozukluğu tetikler. "Soğuk ve ölü görünen kişi, sıcak ve ölü olana kadar ölü değildir": CPR kararı bu prensiple verilir, tahliye önceliklidir.\n\nDonma (frostbite): Beyaz, sert, hissiz doku. Tekrar donma riski varsa çözme. Çözmek gerekiyorsa 37–39 °C su banyosunda 30 dakika; çok ağrılıdır, ovma yapılmaz, kabarcıklar patlatılmaz. Alkol ve sigara yasak; her ikisi de dolaşımı bozar.',
  ropeTeam:
    'Buzulda ip takımı düşmeyi durdurmak için değil, yarık düşmesini sınırlamak içindir. 3 kişilik takım idealdir: iki kişi bir düşeni tutabilir. İp aralığı 10–15 m; ipte belirli aralıklarla düğüm (ip düğümleri) yarık kenarında sürtünme yaratıp düşeni durdurmaya yardım eder.\n\nKendini durdurma: İp gerildiğinde herkes kazma ile kendini durdurur (self-arrest): kazmanın kısmını göğüs altında, dirsekler kapalı, ayak uçları kara (kramponsuz) — kramponluysa ayakları kaldır. Bu refleks, kaymayı yüzüstü-baş yukarı, sırtüstü-baş yukarı, yüzüstü-baş aşağı, sırtüstü-baş aşağı dört pozisyondan çalışılana kadar öğrenilmiş sayılmaz.\n\nYarık kurtarma: Düşme durdurulunca düşmeyen kişiler ankraj kurar (kar kazığı, gömülü kazma "T" ankrajı ya da buz vidası), yükü ankraja aktarır, düşenin durumunu kontrol eder. Düşen kendini prusiklerle çıkabiliyorsa en hızlısı budur. Çıkamıyorsa 3:1 (Z) makara sistemi kurulur: Ankrajdan çıkan ipe prusikle tutunmuş bir makara, mekanik avantajı üçe katlar.\n\nAlıştırma: Her sefer öncesi güvenli bir bayırda tüm sistemi gerçek yükle prova et. Sistem kurmayı ilk kez yarık başında öğrenmek kabul edilebilir bir plan değildir.',
  tdfEthics:
    'Türkiye Dağcılık Federasyonu temel dağcılık müfredatı, teknik becerinin yanında dağ kültürünü öğretir. Bir dağcının sorumlulukları: 1) Kendi kararlarının sahibi olmak — "lider söyledi" bir mazeret değildir, itiraz hakkı ve görevi vardır. 2) Grup kalır: Hızlı olan, yavaş olana uyar; kimse tek başına bırakılmaz. 3) Geri dönüş saati kutsaldır: Zirve isteğe bağlı, iniş zorunludur; belirlenen saatte nerede olursan ol dön. 4) Tırmanış bildirimi: Rota, ekip listesi, planlanan dönüş ve acil kişi; en az bir kişiye (kulüp, aile, köy muhtarı) bırakılır. 5) Doğaya saygı: İz bırakma, kaynak suyunu kirletme, çobanlarla ve köylülerle nazik iletişim; dağ onlarındır, sen misafirsin.\n\nTırmanış planı beş parçadan oluşur: Hedef ve rota (harita, profil, kilit noktalar), zaman planı (kalkış, kilit noktalara varış, dönüş saati), ekip (deneyim, sağlık, roller), ekipman listesi (kişisel + ortak) ve acil durum planı (kaçış rotaları, en yakın yerleşim, 112 ve AKUT/JAK numaraları, buluşma noktaları).\n\nDağda karar verme sürekli bir döngüdür: Gözle (hava, arazi, ekip), değerlendir, karar ver, uygula, tekrar gözle. Kötü karar çoğu zaman bilgi eksikliğinden değil, zirve isteğinin bilgiyi bastırmasından doğar.',
} as const;

/* ------------------------------------------------------------------ */
/* Kurslar                                                             */
/* ------------------------------------------------------------------ */

export const seedCourses: Course[] = [
  {
    id: 'crs_tdf_basic',
    slug: 'temel-dagcilik-egitimi',
    title: 'Temel Dağcılık Eğitimi',
    category: 'mountaineering',
    level: 'beginner',
    format: 'hybrid',
    summary: 'TDF müfredatına dayalı 40 saatlik başlangıç: planlama, ekipman, yürüyüş, kamp, ip.',
    description:
      'Türkiye Dağcılık Federasyonu temel eğitim müfredatını örnek alan bu kurs, dağa ilk adımı atacaklar için tasarlandı. Online modüllerde dağ kültürü, katmanlama, beslenme, hava ve navigasyon işlenir; iki günlük arazi uygulamasında yürüyüş teknikleri, kamp kurulumu, temel düğümler ve ip ile hareket pratik edilir. Kursu bitirenler kulüp tırmanışlarına güvenle katılacak temeli kazanır.',
    imageUrl: unsplash('1464822759023-fed622ff2c3b'),
    instructorId: 'i_emre',
    provider: 'Zirve Akademi · TDF müfredatı',
    certificateName: 'Temel Dağcılık Katılım Belgesi',
    validityMonths: null,
    priceTry: 4500,
    durationHours: 40,
    lessonCount: 9,
    rating: 4.8,
    reviewCount: 96,
    enrolledCount: 1240,
    languages: ['Türkçe'],
    prerequisites: ['18 yaş üstü', 'Temel fiziksel kondisyon'],
    outcomes: [
      'Dağ yürüyüşü planı ve tırmanış bildirimi hazırlamak',
      'Katmanlama ve ekipman seçimi',
      'Harita ve pusulayla temel navigasyon',
      'Sekizli, kazık bağı ve prusik düğümleri',
      'Çadır kurma ve kamp düzeni',
      'Hava ve yıldırım riskini değerlendirmek',
      'Grup içinde karar verme ve dönüş saati disiplini',
    ],
    adventureTypes: ['hiking', 'climbing'],
    createdAt: monthsAgo(18),
  },
  {
    id: 'crs_rock1',
    slug: 'kaya-tirmanisi-1-spor',
    title: 'Kaya Tırmanışı 1 – Spor Tırmanış',
    category: 'climbing',
    level: 'beginner',
    format: 'in_person',
    summary: 'Geyikbayırı’nda 3 gün: emniyet alma, top-rope, ilk lead tırmanış ve düşme pratiği.',
    description:
      'Kaya tırmanışına sıfırdan başlayanlar için üç günlük yoğun program. İlk gün kemer, düğüm ve belay tekniği; ikinci gün top-rope ve hareket teknikleri (ayak yerleştirme, ağırlık merkezi, dinlenme pozisyonları); üçüncü gün kontrollü düşme pratiği ve ilk lead tırmanış. Küçük gruplar (en fazla 6 kişi), tüm teknik ekipman dahildir.',
    imageUrl: unsplash('1522163182402-834f871fd851'),
    instructorId: 'i_can',
    provider: 'Geyikbayırı Tırmanış Okulu',
    certificateName: 'Spor Tırmanış Seviye 1',
    validityMonths: null,
    priceTry: 6500,
    durationHours: 24,
    lessonCount: 0,
    rating: 4.9,
    reviewCount: 142,
    enrolledCount: 610,
    languages: ['Türkçe', 'English'],
    prerequisites: [],
    outcomes: [
      'Kemer, sekizli düğüm ve partner kontrolü',
      'Cihazla güvenli emniyet alma (belay)',
      'Top-rope ve lead tırmanışta ip yönetimi',
      'Temel hareket teknikleri ve ayak çalışması',
      'Ankraj temizleme ve iniş (lower-off)',
      'Kontrollü düşme ve güven',
    ],
    adventureTypes: ['climbing'],
    createdAt: monthsAgo(24),
  },
  {
    id: 'crs_rock2',
    slug: 'kaya-tirmanisi-2-geleneksel',
    title: 'Kaya Tırmanışı 2 – Geleneksel & Çok Uzunluk',
    category: 'climbing',
    level: 'intermediate',
    format: 'in_person',
    summary: 'Takoz/friend yerleştirme, istasyon kurma, çok uzunluklu rota yönetimi ve iniş.',
    description:
      'Spor tırmanış temellerini alanlar için geleneksel (trad) ve çok uzunluklu tırmanış kursu. Koruma ekipmanı (nut, cam, hexentric) yerleştirme ve değerlendirme, eşitlenmiş istasyon kurma, ikinci tırmanıcıyı üstten emniyete alma, ip yönetimi, iniş (abseil) ve kaçış senaryoları. Aladağlar ve Ballıkayalar’da dört gün.',
    imageUrl: unsplash('1516592673884-4a2d5c1ac4e5'),
    instructorId: 'i_can',
    provider: 'Geyikbayırı Tırmanış Okulu',
    certificateName: 'Geleneksel Tırmanış Seviye 2',
    validityMonths: null,
    priceTry: 9800,
    durationHours: 32,
    lessonCount: 0,
    rating: 4.9,
    reviewCount: 58,
    enrolledCount: 210,
    languages: ['Türkçe', 'English'],
    prerequisites: ['Kaya Tırmanışı 1 ya da eşdeğer deneyim', 'Lead 5c seviyesi'],
    outcomes: [
      'Pasif ve aktif koruma ekipmanı yerleştirme',
      'SERENE/ERNEST ilkelerine göre istasyon kurma',
      'Çok uzunluklu rotada ip ve zaman yönetimi',
      'Güvenli abseil ve düğüm geçişi',
      'Kendini kurtarma temelleri (yük aktarma, prusikle çıkış)',
    ],
    adventureTypes: ['climbing'],
    createdAt: monthsAgo(20),
  },
  {
    id: 'crs_rope',
    slug: 'ip-teknikleri-ve-kurtarma',
    title: 'İp Teknikleri & Kurtarma',
    category: 'climbing',
    level: 'intermediate',
    format: 'hybrid',
    summary:
      'Makara sistemleri, yük aktarma, yarık kurtarma ve kendini kurtarma — online teori + 2 gün arazi.',
    description:
      'Tırmanıcılar ve dağcılar için ip kurtarma teknikleri. Online modüllerde düğümler, ankraj teorisi ve mekanik avantaj işlenir; iki günlük arazi uygulamasında 3:1 ve 5:1 sistemler, yük aktarma, prusikle ip tırmanma, buzul yarık kurtarma ve yaralı partneri indirme senaryoları çalışılır.',
    imageUrl: unsplash('1551632811-561732d1e306'),
    instructorId: 'i_can',
    provider: 'Zirve Akademi',
    certificateName: 'İp Kurtarma Teknikleri',
    validityMonths: 36,
    priceTry: 7200,
    durationHours: 28,
    lessonCount: 7,
    rating: 4.7,
    reviewCount: 41,
    enrolledCount: 380,
    languages: ['Türkçe'],
    prerequisites: ['Temel tırmanış ya da dağcılık deneyimi'],
    outcomes: [
      'Temel ve ileri düğümler, ankraj eşitleme',
      '3:1 ve 5:1 makara sistemleri kurmak',
      'Yük aktarma ve belay kaçışı',
      'Prusikle ip tırmanma ve düğüm geçişi',
      'Yarık kurtarma protokolü',
      'Yaralıyla eşlik ederek iniş',
    ],
    adventureTypes: ['climbing', 'hiking'],
    createdAt: monthsAgo(14),
  },
  {
    id: 'crs_avy1',
    slug: 'cig-guvenligi-1',
    title: 'Çığ Güvenliği 1',
    category: 'avalanche',
    level: 'beginner',
    format: 'hybrid',
    summary: 'AIARE 1 eşdeğeri, 24 saat: çığ üçgeni, bülten okuma, arazi seçimi, arkadaş kurtarma.',
    description:
      'Kayak turu, splitboard, kar ayakkabısı ve kış dağcılığı yapan herkes için temel çığ eğitimi. AIARE 1 / AST 1 çerçevesine dayanan program; 8 saat online teori ve iki günlük arazi uygulamasından oluşur. Çığ oluşumu, kar örtüsü, çığ bülteni ve tehlike ölçeği, arazi tuzakları, grup kararı ve transceiver–sonda–kürek ile arkadaş kurtarma pratik edilir.',
    imageUrl: unsplash('1551698618-1dfe5d97d256'),
    instructorId: 'i_emre',
    provider: 'Zirve Akademi · AIARE 1 eşdeğeri',
    certificateName: 'Çığ Güvenliği Seviye 1',
    validityMonths: 24,
    priceTry: 8500,
    durationHours: 24,
    lessonCount: 8,
    rating: 4.9,
    reviewCount: 87,
    enrolledCount: 520,
    languages: ['Türkçe', 'English'],
    prerequisites: ['Kayak/splitboard/kar ayakkabısıyla arazide hareket edebilmek'],
    outcomes: [
      'Çığ üçgenini (arazi, kar, hava) okumak',
      'Çığ bültenini ve tehlike ölçeğini yorumlamak',
      'Eğim ölçmek ve çığ arazisini tanımak',
      'Basit kar profili ve stabilite testleri',
      'Transceiver, sonda ve kürekle tek gömü kurtarma',
      'Tur planı ve grup karar protokolü',
    ],
    adventureTypes: ['skiing', 'hiking'],
    createdAt: monthsAgo(16),
  },
  {
    id: 'crs_avy2',
    slug: 'cig-guvenligi-2',
    title: 'Çığ Güvenliği 2',
    category: 'avalanche',
    level: 'advanced',
    format: 'in_person',
    summary:
      'Kar profili, ileri stabilite testleri, karmaşık arazi ve çoklu gömü kurtarma — 4 gün.',
    description:
      'Çığ 1 sonrası ileri seviye: Kar örtüsü gözlemlerini standart formatla kaydetme, uzatılmış kolon ve propagasyon testleri, tehlike problemlerini bölge ölçeğinde değerlendirme, karmaşık arazide rota seçimi ve liderlik. Çoklu gömü senaryoları, sinyal bastırma ve triyaj. Kaçkarlar’da dört gün.',
    imageUrl: unsplash('1517840901100-8179e982acb7'),
    instructorId: 'i_emre',
    provider: 'Zirve Akademi · AIARE 2 eşdeğeri',
    certificateName: 'Çığ Güvenliği Seviye 2',
    validityMonths: 24,
    priceTry: 12500,
    durationHours: 32,
    lessonCount: 0,
    rating: 4.8,
    reviewCount: 23,
    enrolledCount: 96,
    languages: ['Türkçe'],
    prerequisites: ['Çığ Güvenliği 1 (son 3 yıl içinde)', 'En az bir sezon tur deneyimi'],
    outcomes: [
      'Standart kar profili ve gözlem kaydı',
      'ECT ve PST testleri',
      'Çığ problemlerini mekân ve zamanda haritalamak',
      'Karmaşık arazide grup liderliği',
      'Çoklu gömü ve triyaj',
    ],
    adventureTypes: ['skiing'],
    createdAt: monthsAgo(12),
  },
  {
    id: 'crs_wfa',
    slug: 'dogada-ilk-yardim-wfa',
    title: 'Doğada İlk Yardım (WFA)',
    category: 'first_aid',
    level: 'beginner',
    format: 'hybrid',
    summary:
      'Wilderness First Aid 16 saat: hasta değerlendirme, hipotermi, kırıklar, tahliye kararı.',
    description:
      'Şehirden uzakta, yardımın saatler sürebileceği yerlerde ilk yardım. Uluslararası 16 saatlik WFA formatı: hasta değerlendirme sistemi, omurga yaralanmaları, kırık ve çıkıklar, yara bakımı, hipotermi ve ısı hastalıkları, alerjik reaksiyonlar, tahliye kararı ve uzun süreli hasta bakımı. Senaryo ağırlıklı iki günlük arazi uygulaması.',
    imageUrl: unsplash('1584515933487-779824d29309'),
    instructorId: null,
    provider: 'Anadolu Wilderness Medicine',
    certificateName: 'Wilderness First Aid',
    validityMonths: 24,
    priceTry: 5200,
    durationHours: 16,
    lessonCount: 8,
    rating: 4.9,
    reviewCount: 214,
    enrolledCount: 1980,
    languages: ['Türkçe', 'English'],
    prerequisites: [],
    outcomes: [
      'Olay yeri güvenliği ve birincil değerlendirme (ABCDE)',
      'SAMPLE öyküsü ve vital bulgu takibi',
      'Kanama kontrolü, yara bakımı ve turnike',
      'Kırık/çıkık atelleme ve omurga koruması',
      'Hipotermi sarması ve ısı hastalıkları',
      'Anafilaksi ve astım krizinde müdahale',
      'Tahliye kararı ve kurtarma iletişimi',
    ],
    adventureTypes: ['hiking', 'climbing', 'skiing', 'cycling'],
    createdAt: monthsAgo(30),
  },
  {
    id: 'crs_wfr',
    slug: 'wilderness-first-responder',
    title: 'Wilderness First Responder (WFR)',
    category: 'first_aid',
    level: 'professional',
    format: 'in_person',
    summary: '72 saatlik profesyonel standart: rehberler, eğitmenler ve sefer liderleri için.',
    description:
      'Outdoor sektörünün profesyonel ilk yardım standardı. 9 günlük yoğun program; WFA konularının derinleştirilmiş hali, uzun süreli bakım, ileri atelleme, çıkık redüksiyonu, yara temizliği, dişçilik acilleri, yüksek irtifa ve dalış hastalıkları, sırt tahtası olmadan omurga yönetimi, gece senaryoları ve tahliye organizasyonu. CPR/AED dahil.',
    imageUrl: unsplash('1587556930720-3b0d4e5a7f32'),
    instructorId: null,
    provider: 'Anadolu Wilderness Medicine',
    certificateName: 'Wilderness First Responder',
    validityMonths: 36,
    priceTry: 24000,
    durationHours: 72,
    lessonCount: 0,
    rating: 5.0,
    reviewCount: 64,
    enrolledCount: 310,
    languages: ['Türkçe', 'English'],
    prerequisites: ['18 yaş üstü', 'WFA önerilir'],
    outcomes: [
      'Çoklu kazazedede triyaj ve organizasyon',
      'İleri atelleme ve çıkık redüksiyonu',
      'Uzun süreli hasta bakımı (24 saat+)',
      'Omurga değerlendirmesi ve temizleme protokolü',
      'Çevresel aciller: irtifa, dalış, yıldırım',
      'Tahliye planı ve helikopter güvenliği',
      'CPR/AED',
    ],
    adventureTypes: ['hiking', 'climbing', 'skiing', 'rafting'],
    createdAt: monthsAgo(28),
  },
  {
    id: 'crs_nav',
    slug: 'harita-pusula-gps-navigasyon',
    title: 'Harita, Pusula & GPS Navigasyon',
    category: 'navigation',
    level: 'beginner',
    format: 'online',
    summary: 'Sapma, kerteriz, kesişme, adımlama ve çevrimdışı GPS — kendi başına kaybolmadan dön.',
    description:
      'Topografik harita okuma, pusula kullanımı ve dijital navigasyonu birleştiren online kurs. Eş yükselti eğrileri, ölçek, koordinat sistemleri, manyetik sapma, harita–arazi kerterizi, konum bulma, sis ve karda navigasyon stratejileri, GPS uygulamalarında çevrimdışı harita ve rota planlama. Her modülde evde yapılabilecek alıştırmalar.',
    imageUrl: unsplash('1504198458649-3128b932f49e'),
    instructorId: 'i_elif',
    provider: 'Zirve Akademi',
    certificateName: 'Arazi Navigasyonu',
    validityMonths: null,
    priceTry: 890,
    durationHours: 8,
    lessonCount: 10,
    rating: 4.7,
    reviewCount: 173,
    enrolledCount: 2650,
    languages: ['Türkçe', 'English'],
    prerequisites: [],
    outcomes: [
      'Topografik harita ve eş yükselti eğrilerini okumak',
      'Manyetik sapmayı hesaplamak ve uygulamak',
      'Harita–arazi ve arazi–harita kerterizi',
      'Kesişme yöntemiyle konum bulmak',
      'Adımlama ve Naismith ile zaman tahmini',
      'Çevrimdışı GPS haritaları ve rota planı',
      'Sis ve karda güvenli navigasyon stratejileri',
    ],
    adventureTypes: ['hiking', 'skiing', 'cycling'],
    createdAt: monthsAgo(22),
  },
  {
    id: 'crs_padi_ow',
    slug: 'padi-open-water-diver',
    title: 'PADI Open Water Diver',
    category: 'diving',
    level: 'beginner',
    format: 'hybrid',
    summary:
      'E-learning + Kaş’ta havuz ve 4 açık su dalışı; 18 m’ye kadar dünya çapında geçerli lisans.',
    description:
      'Dünyanın en yaygın dalış sertifikası. Online eğitimde dalış fiziği, ekipman, yüzerlik, dekompresyon teorisi ve güvenlik işlenir; Kaş’ta üç günlük uygulamada kapalı su becerileri (maske temizleme, regülatör bulma, acil yükseliş) ve dört açık su dalışı yapılır. Sertifika 18 metreye kadar bir buddy ile bağımsız dalış hakkı verir.',
    imageUrl: unsplash('1544551763-46a013bb70d5'),
    instructorId: 'i_zeynep',
    provider: 'PADI · Kaş Dive Center',
    certificateName: 'PADI Open Water Diver',
    validityMonths: null,
    priceTry: 14500,
    durationHours: 30,
    lessonCount: 8,
    rating: 5.0,
    reviewCount: 188,
    enrolledCount: 740,
    languages: ['Türkçe', 'English', 'Deutsch'],
    prerequisites: ['10 yaş üstü', '200 m yüzme ve 10 dk su üstünde kalma', 'Sağlık beyanı'],
    outcomes: [
      'Dalış ekipmanını kurmak ve kontrol etmek',
      'Nötr yüzerlik ve trim',
      'Maske temizleme, regülatör bulma, buddy nefes',
      'Dekompresyonsuz limitler ve dalış planı',
      'Yüzeyde ve suda acil prosedürler',
      '18 m’ye kadar bağımsız buddy dalışı',
    ],
    adventureTypes: ['diving'],
    createdAt: monthsAgo(26),
  },
  {
    id: 'crs_padi_aow',
    slug: 'padi-advanced-open-water',
    title: 'PADI Advanced Open Water',
    category: 'diving',
    level: 'intermediate',
    format: 'in_person',
    summary: 'Derin dalış, sualtı navigasyonu ve üç seçmeli macera dalışı — 30 m limit.',
    description:
      'Open Water sonrası ilk adım. Beş macera dalışı: Derin (30 m) ve sualtı navigasyonu zorunlu; batık, gece, yüzerlik ustalığı, akıntı, balık tanımlama gibi seçmelilerden üçü. Kaş’ta Uluburun batığı replikası ve Kanyon gibi noktalarda iki gün.',
    imageUrl: unsplash('1682687982501-1e58ab814a02'),
    instructorId: 'i_zeynep',
    provider: 'PADI · Kaş Dive Center',
    certificateName: 'PADI Advanced Open Water Diver',
    validityMonths: null,
    priceTry: 11000,
    durationHours: 16,
    lessonCount: 0,
    rating: 4.9,
    reviewCount: 102,
    enrolledCount: 420,
    languages: ['Türkçe', 'English'],
    prerequisites: ['PADI Open Water ya da eşdeğeri'],
    outcomes: [
      '30 m derin dalış ve nitrojen narkozu farkındalığı',
      'Pusula ve doğal navigasyon',
      'Batık dalışı planı',
      'Gece dalışı iletişimi',
      'İleri yüzerlik kontrolü',
    ],
    adventureTypes: ['diving'],
    createdAt: monthsAgo(24),
  },
  {
    id: 'crs_freedive',
    slug: 'serbest-dalis-level-1',
    title: 'Serbest Dalış Level 1',
    category: 'diving',
    level: 'beginner',
    format: 'in_person',
    summary: 'Nefes tutma fizyolojisi, rahatlama, eşitleme ve 10–16 m’ye güvenli iniş; 2,5 gün.',
    description:
      'Tek nefesle derinliğe güvenle inmenin temelleri. Teori: dalma refleksi, hipoksi ve blackout, eşitleme (Frenzel), güvenlik ve buddy sistemi. Havuzda statik ve dinamik apne; açık suda şamandıra hattında serbest iniş ve 10–16 m derinlik hedefi. Asla yalnız dalma prensibi kursun omurgasıdır.',
    imageUrl: unsplash('1530053969600-caed2596d242'),
    instructorId: 'i_zeynep',
    provider: 'Kaş Freediving',
    certificateName: 'Freediver Level 1',
    validityMonths: null,
    priceTry: 7800,
    durationHours: 20,
    lessonCount: 0,
    rating: 4.8,
    reviewCount: 67,
    enrolledCount: 290,
    languages: ['Türkçe', 'English'],
    prerequisites: ['16 yaş üstü', 'Rahat yüzme'],
    outcomes: [
      'Diyafram nefesi ve rahatlama',
      '2 dk+ statik apne',
      'Frenzel eşitleme',
      'Duck dive ve verimli palet vuruşu',
      'Blackout ve LMC tanıma, buddy kurtarma',
    ],
    adventureTypes: ['diving'],
    createdAt: monthsAgo(15),
  },
  {
    id: 'crs_pg_p1',
    slug: 'yamac-parasutu-p1-p2',
    title: 'Yamaç Paraşütü P1–P2 Başlangıç',
    category: 'paragliding',
    level: 'beginner',
    format: 'in_person',
    summary: 'Babadağ’da yer eğitimi, kanat kontrolü ve ilk solo uçuşlar; THK P2 pilot seviyesi.',
    description:
      'Sıfırdan solo pilotluğa. İlk haftada yer eğitimi (kanat şişirme, ileri/geri kalkış, kontrol), küçük tepe uçuşları ve telsizle yönlendirilen ilk yüksek uçuşlar. Aerodinamik, meteoroloji, hava sahası ve acil prosedürler teoride. 25–30 uçuş ve teorik sınav sonrasında P2 seviyesi.',
    imageUrl: unsplash('1502933691298-84fc14542831'),
    instructorId: 'i_baris',
    provider: 'THK · Fethiye Uçuş Okulu',
    certificateName: 'Yamaç Paraşütü P2 Pilot',
    validityMonths: null,
    priceTry: 25000,
    durationHours: 60,
    lessonCount: 0,
    rating: 4.9,
    reviewCount: 121,
    enrolledCount: 380,
    languages: ['Türkçe', 'English'],
    prerequisites: ['16 yaş üstü (veli izni)', 'Sağlık raporu'],
    outcomes: [
      'Kanat şişirme, kontrol ve kalkış teknikleri',
      'Düz uçuş, dönüşler ve iniş yaklaşımı',
      'Meteoroloji ve hava sahası temelleri',
      'Acil prosedürler ve yedek paraşüt',
      'Bağımsız P2 uçuş kararı',
    ],
    adventureTypes: ['paragliding'],
    createdAt: monthsAgo(32),
  },
  {
    id: 'crs_pg_xc',
    slug: 'yamac-parasutu-termik-xc',
    title: 'Yamaç Paraşütü Termik & XC',
    category: 'paragliding',
    level: 'advanced',
    format: 'hybrid',
    summary:
      'Termik merkezleme, bulut okuma, XC karar verme ve iniş alanı seçimi; teori + 4 uçuş günü.',
    description:
      'P2 pilotlar için mesafe uçuşunun kapısı. Online: termodinamik, termik kaynakları, bulut fiziği, hava sahası ve XC planlama. Fethiye ve Ölüdeniz’de dört uçuş günü: termik bulma ve merkezleme, geçiş kararları, güvenli iniş alanı seçimi, telsizle koçluk. Uçuş kayıtları analiz edilir.',
    imageUrl: unsplash('1500530855697-b586d89ba3ee'),
    instructorId: 'i_baris',
    provider: 'Fethiye Uçuş Okulu',
    certificateName: 'XC Pilot Atölyesi',
    validityMonths: null,
    priceTry: 13500,
    durationHours: 36,
    lessonCount: 6,
    rating: 4.8,
    reviewCount: 34,
    enrolledCount: 140,
    languages: ['Türkçe', 'English'],
    prerequisites: ['P2 pilot lisansı', 'En az 40 uçuş'],
    outcomes: [
      'Termik kaynaklarını yerden ve bulutlardan okumak',
      'Termik merkezleme ve verimli tırmanış',
      'Süzülüş ve rüzgâra göre geçiş kararı',
      'Hava sahası ve yasak bölgeler',
      'Alternatif iniş alanı planı',
      'Uçuş sonrası iz analizi',
    ],
    adventureTypes: ['paragliding'],
    createdAt: monthsAgo(10),
  },
  {
    id: 'crs_paddle',
    slug: 'kano-kayak-kurek-guvenligi',
    title: 'Kano & Kayak Kürek Güvenliği',
    category: 'paddling',
    level: 'beginner',
    format: 'hybrid',
    summary: 'Soğuk su, PFD, kendini kurtarma, T-kurtarma ve grup sinyalleri; teori + 1 gün suda.',
    description:
      'Deniz kayağı ve kanoya başlayanlar için güvenlik temelleri. Online modüllerde soğuk su fizyolojisi, giyinme, hava/gelgit okuma ve grup protokolleri; suda bir günlük uygulamada ıslak çıkış, paddle-float ile yeniden binme, T-kurtarma, kürek sinyalleri ve yedekte çekme.',
    imageUrl: unsplash('1472745942893-4b9f730c7668'),
    instructorId: null,
    provider: 'Marmara Sea Kayak',
    certificateName: 'Kürek Güvenliği Temel',
    validityMonths: 36,
    priceTry: 3200,
    durationHours: 12,
    lessonCount: 6,
    rating: 4.6,
    reviewCount: 45,
    enrolledCount: 330,
    languages: ['Türkçe'],
    prerequisites: ['Yüzme bilmek'],
    outcomes: [
      'Su sıcaklığına göre giyinmek',
      'Islak çıkış ve kendini kurtarma',
      'T-kurtarma ve paddle-float',
      'Kürek işaretleri ve grup düzeni',
      'Hava, gelgit ve akıntı okumak',
    ],
    adventureTypes: ['canoe', 'rafting'],
    createdAt: monthsAgo(11),
  },
  {
    id: 'crs_raft_guide',
    slug: 'rafting-rehber-egitimi',
    title: 'Rafting Rehber Eğitimi (Class III)',
    category: 'paddling',
    level: 'professional',
    format: 'in_person',
    summary: 'Köprülü Kanyon’da 6 gün: bot kontrolü, nehir okuma, kurtarma ve müşteri güvenliği.',
    description:
      'Ticari rafting rehberliği için başlangıç sertifikası. Nehir hidrolojisi ve okuma, bot kumandası (kürekli ve sandalyeli), müşteri brifingi, yüzen kurtarma, halat atma, devrilen bot düzeltme, sıkışma kurtarma ve acil durum yönetimi. Köprülü Kanyon Class II–III parkurunda altı gün, en az 20 iniş.',
    imageUrl: unsplash('1530866495561-507c9faab2ed'),
    instructorId: null,
    provider: 'Köprülü Rafting Akademi',
    certificateName: 'Rafting Guide Class III',
    validityMonths: 36,
    priceTry: 18500,
    durationHours: 48,
    lessonCount: 0,
    rating: 4.7,
    reviewCount: 29,
    enrolledCount: 120,
    languages: ['Türkçe', 'English'],
    prerequisites: ['18 yaş üstü', 'Güçlü yüzme', 'İlk yardım sertifikası önerilir'],
    outcomes: [
      'Nehir özelliklerini okumak (eddy, hole, strainer)',
      'Bot kumandası ve hat seçimi',
      'Müşteri güvenlik brifingi',
      'Halat atma ve yüzen kurtarma',
      'Devrilen botu düzeltmek',
      'Kaza yönetimi ve tahliye',
    ],
    adventureTypes: ['rafting'],
    createdAt: monthsAgo(13),
  },
  {
    id: 'crs_winter_camp',
    slug: 'kis-kampciligi-kar-barinaklari',
    title: 'Kış Kampçılığı & Kar Barınakları',
    category: 'winter',
    level: 'intermediate',
    format: 'online',
    summary: 'Kar mağarası, quinzhee, çadır ankrajı, uyku sistemi ve kışın su/yemek yönetimi.',
    description:
      'Eksi sıcaklıklarda konforlu ve güvenli gecelemek için online kurs. Uyku sistemleri ve R değeri, çadır kurulumu ve kar ankrajları, kar mağarası ve quinzhee yapımı, apsiste ocak güvenliği, kar eritme ve su yönetimi, kışın beslenme, ıslak ekipmanı kurutma ve sabah rutini. Alıştırmalar ilk kar yağışında uygulanacak şekilde tasarlandı.',
    imageUrl: unsplash('1478827387698-a62c4e8ae0ac'),
    instructorId: 'i_emre',
    provider: 'Zirve Akademi',
    certificateName: null,
    validityMonths: null,
    priceTry: 690,
    durationHours: 6,
    lessonCount: 7,
    rating: 4.6,
    reviewCount: 58,
    enrolledCount: 910,
    languages: ['Türkçe'],
    prerequisites: ['Yaz kampı deneyimi'],
    outcomes: [
      'Kış uyku sistemi kurmak',
      'Kar zemininde çadır ankrajı',
      'Kar mağarası ve quinzhee yapmak',
      'Ocak ve karbon monoksit güvenliği',
      'Su eritme ve kış beslenmesi',
    ],
    adventureTypes: ['hiking', 'skiing'],
    createdAt: monthsAgo(9),
  },
  {
    id: 'crs_ice',
    slug: 'buz-tirmanisi-baslangic',
    title: 'Buz Tırmanışı Başlangıç',
    category: 'climbing',
    level: 'intermediate',
    format: 'in_person',
    summary: 'Erzurum’da 3 gün: kazma ve krampon tekniği, buz vidası, V-thread ve WI3 top-rope.',
    description:
      'Dik buzda hareketin temelleri. Kazma sallama ve krampon ön diş tekniği, üçgen pozisyon, dinlenme, buz vidası yerleştirme ve değerlendirme, Abalakov (V-thread) iniş ankrajı, buz kalitesini okumak, buz düşmesi güvenliği. Erzurum Tortum şelaleleri ve buz parkında WI2–WI3 top-rope tırmanış.',
    imageUrl: unsplash('1518632617641-c1c7de1bde2c'),
    instructorId: 'i_emre',
    provider: 'Zirve Akademi',
    certificateName: 'Buz Tırmanışı Seviye 1',
    validityMonths: null,
    priceTry: 8900,
    durationHours: 24,
    lessonCount: 0,
    rating: 4.8,
    reviewCount: 37,
    enrolledCount: 150,
    languages: ['Türkçe'],
    prerequisites: ['Kaya Tırmanışı 1 ya da eşdeğeri'],
    outcomes: [
      'Kazma ve krampon tekniği',
      'Buz vidası yerleştirme',
      'V-thread iniş ankrajı',
      'Buz kalitesini okumak',
      'Soğukta el yönetimi (screaming barfies)',
    ],
    adventureTypes: ['climbing', 'skiing'],
    createdAt: monthsAgo(8),
  },
  {
    id: 'crs_altitude',
    slug: 'yuksek-irtifa-hazirligi',
    title: 'Yüksek İrtifa Hazırlığı',
    category: 'mountaineering',
    level: 'advanced',
    format: 'online',
    summary:
      'Himalaya/Pamir seferleri için aklimatizasyon planı, AMS/HACE/HAPE, ekipman ve lojistik.',
    description:
      'İlk 6.000–7.000 m seferine hazırlananlar için. Yükseklik fizyolojisi, aklimatizasyon stratejileri, Lake Louise skoru, ilaçlar, beslenme ve hidrasyon, soğuk yaralanmaları, ekipman sistemi, kamp lojistiği, oksijen kullanımı, sefer psikolojisi ve zirve günü planı. Ağrı Dağı’ndan Island Peak ve Lenin Zirvesi’ne uzanan örnek planlar.',
    imageUrl: unsplash('1486911278844-a81c5267e227'),
    instructorId: 'i_emre',
    provider: 'Zirve Akademi · UIAA tıp komisyonu önerileri',
    certificateName: 'Yüksek İrtifa Hazırlık',
    validityMonths: null,
    priceTry: 1500,
    durationHours: 10,
    lessonCount: 8,
    rating: 4.9,
    reviewCount: 72,
    enrolledCount: 830,
    languages: ['Türkçe', 'English'],
    prerequisites: ['Temel dağcılık', '3.000 m+ zirve deneyimi'],
    outcomes: [
      'Aklimatizasyon takvimi hazırlamak',
      "AMS, HACE ve HAPE'i tanımak ve yönetmek",
      'Lake Louise skoru ile günlük takip',
      'Yüksek irtifa ekipman sistemi',
      'Sefer beslenmesi ve hidrasyon',
      'Zirve günü planı ve dönüş saati',
      'Oksijen ve ilaç kararları',
    ],
    adventureTypes: ['hiking', 'climbing', 'skiing'],
    createdAt: monthsAgo(7),
  },
  {
    id: 'crs_drone',
    slug: 'drone-pilotlugu-shgm-hazirlik',
    title: 'Drone Pilotluğu SHGM Sertifika Hazırlık',
    category: 'drone',
    level: 'beginner',
    format: 'online',
    summary: 'SHT-İHA mevzuatı, hava sahası, meteoroloji, uçuş planlama ve sınav soruları.',
    description:
      'İHA1 pilot sertifikası teorik sınavına hazırlık ve outdoor çekimlerde güvenli uçuş. Mevzuat ve sınıflar, kayıt ve izin süreçleri, hava sahası yapısı ve yasak bölgeler, meteoroloji, aerodinamik ve pil yönetimi, dağda ve kıyıda uçuş özellikleri, kaza raporlama. 120 soruluk deneme sınavı.',
    imageUrl: unsplash('1473968512647-3e447244af8f'),
    instructorId: null,
    provider: 'Zirve Akademi · SHGM müfredatı',
    certificateName: 'İHA Teorik Hazırlık',
    validityMonths: null,
    priceTry: 1200,
    durationHours: 12,
    lessonCount: 8,
    rating: 4.5,
    reviewCount: 88,
    enrolledCount: 1120,
    languages: ['Türkçe'],
    prerequisites: [],
    outcomes: [
      'SHT-İHA sınıfları ve sorumluluklar',
      'İHA Kayıt Sistemi ve uçuş izni',
      'Hava sahası ve yasak sahaları okumak',
      'Rüzgâr, sıcaklık ve pil planlaması',
      'Dağ ve kıyı uçuşu riskleri',
      'Sınav stratejisi',
    ],
    adventureTypes: ['hiking', 'paragliding', 'cycling'],
    createdAt: monthsAgo(6),
  },
  {
    id: 'crs_lnt',
    slug: 'leave-no-trace-egitmen',
    title: 'Leave No Trace Eğitmen Kursu',
    category: 'ethics',
    level: 'intermediate',
    format: 'hybrid',
    summary: 'Yedi ilkeyi öğretmeyi öğren: pedagojik yaklaşım, atölye tasarımı ve 2 gün arazi.',
    description:
      'Kulüp liderleri, rehberler ve öğretmenler için. Online modüllerde yedi ilkenin bilimsel arka planı ve "otorite değil etki" pedagojisi; iki günlük arazi uygulamasında her katılımcı bir ilkeyi grup önünde öğretir, geri bildirim alır. Tamamlayanlar Trainer olarak kendi farkındalık atölyelerini düzenleyebilir.',
    imageUrl: unsplash('1441974231531-c6227db76b6e'),
    instructorId: 'i_elif',
    provider: 'Leave No Trace Türkiye',
    certificateName: 'Leave No Trace Trainer',
    validityMonths: null,
    priceTry: 3900,
    durationHours: 16,
    lessonCount: 6,
    rating: 4.8,
    reviewCount: 52,
    enrolledCount: 460,
    languages: ['Türkçe', 'English'],
    prerequisites: ['Düzenli outdoor deneyimi'],
    outcomes: [
      'Yedi ilkenin arkasındaki ekolojik kanıtlar',
      'Kamp ve patika etkisini ölçmek',
      'Atık, ateş ve su yönetimi',
      'Yaban hayatı ile etkileşim kuralları',
      'Etkili farkındalık atölyesi tasarlamak',
    ],
    adventureTypes: ['hiking', 'cycling', 'canoe'],
    createdAt: monthsAgo(19),
  },
  {
    id: 'crs_photo',
    slug: 'outdoor-fotografcilik',
    title: 'Outdoor Fotoğrafçılık',
    category: 'photography',
    level: 'beginner',
    format: 'online',
    summary: 'Işık, kompozisyon, hareket halinde çekim, ekipman koruma ve hafif düzenleme akışı.',
    description:
      'Dağda, ormanda ve suda daha iyi fotoğraf çekmek için. Işığı okumak, kompozisyon ilkeleri, ölçek için insan kullanmak, yürürken hızlı çekim ayarları, yıldız ve gece çekimi, soğuk ve yağmurda ekipman koruma, telefonla çekim, hafif ve hızlı düzenleme akışı. Her modülde bir çekim görevi.',
    imageUrl: unsplash('1452421822248-d4c2b47f0c81'),
    instructorId: null,
    provider: 'Zirve Akademi',
    certificateName: null,
    validityMonths: null,
    priceTry: 0,
    durationHours: 5,
    lessonCount: 7,
    rating: 4.6,
    reviewCount: 240,
    enrolledCount: 4300,
    languages: ['Türkçe', 'English'],
    prerequisites: [],
    outcomes: [
      'Altın saat ve yan ışığı kullanmak',
      'Üçte bir kuralı ve derinlik katmanları',
      'Hareket halinde hızlı çekim ayarları',
      'Yıldız ve Samanyolu çekimi temelleri',
      'Ekipmanı soğuk ve nemden korumak',
      'Hızlı düzenleme akışı',
    ],
    adventureTypes: ['hiking', 'climbing', 'skiing', 'cycling', 'paragliding'],
    createdAt: monthsAgo(17),
  },
  {
    id: 'crs_mtb',
    slug: 'dag-bisikleti-teknik-surus',
    title: 'Dağ Bisikleti Teknik Sürüş',
    category: 'winter',
    level: 'intermediate',
    format: 'in_person',
    summary: 'Belgrad Ormanı’nda 2 gün: vücut pozisyonu, viraj, iniş, drop ve tırmanışta çekiş.',
    description:
      'Patikada hız ve güven için teknik sürüş kliniği. Saldırı pozisyonu, frenleme ve ağırlık aktarımı, berm ve düz virajlar, dik iniş, küçük drop ve kök geçişleri, teknik tırmanışta çekiş yönetimi, temel bakım ve arazide tamir. Video analizli iki gün, en fazla 8 kişi.',
    imageUrl: unsplash('1576858574144-9ae1ebcf5ae5'),
    instructorId: 'i_selin',
    provider: 'İstanbul MTB Okulu',
    certificateName: null,
    validityMonths: null,
    priceTry: 3400,
    durationHours: 14,
    lessonCount: 0,
    rating: 4.7,
    reviewCount: 49,
    enrolledCount: 260,
    languages: ['Türkçe', 'English'],
    prerequisites: ['Kendi dağ bisikleti ve kaskı', 'Temel sürüş deneyimi'],
    outcomes: [
      'Saldırı pozisyonu ve frenleme',
      'Viraj tekniği (berm/düz)',
      'Dik iniş ve drop',
      'Teknik tırmanışta çekiş',
      'Arazide temel tamir',
    ],
    adventureTypes: ['cycling'],
    createdAt: monthsAgo(5),
  },
  {
    id: 'crs_trail',
    slug: 'trail-running-temelleri',
    title: 'Trail Running Temelleri',
    category: 'winter',
    level: 'beginner',
    format: 'online',
    summary: 'Efor yönetimi, iniş tekniği, beslenme, zorunlu ekipman ve ilk dağ yarışına hazırlık.',
    description:
      'Asfalttan patikaya geçenler için. Efor bazlı tempo, güç yürüyüşü, iniş tekniği, ayak seçimi, beslenme ve hidrasyon, sıcak ve soğukta koşu, zorunlu ekipman, rota ve güvenlik planı, 12 haftalık ilk yarış programı.',
    imageUrl: unsplash('1476480862126-209bfaa8edc8'),
    instructorId: 'i_elif',
    provider: 'Zirve Akademi',
    certificateName: null,
    validityMonths: null,
    priceTry: 490,
    durationHours: 4,
    lessonCount: 6,
    rating: 4.7,
    reviewCount: 131,
    enrolledCount: 2100,
    languages: ['Türkçe', 'English'],
    prerequisites: [],
    outcomes: [
      'Nabız/nefes bazlı efor yönetimi',
      'Güç yürüyüşü ve iniş tekniği',
      'Uzun koşuda beslenme ve sıvı',
      'Zorunlu ekipman ve güvenlik planı',
      '12 haftalık başlangıç programı',
    ],
    adventureTypes: ['hiking'],
    createdAt: monthsAgo(4),
  },
  {
    id: 'crs_uw_photo',
    slug: 'sualti-fotografciligi',
    title: 'Sualtı Fotoğrafçılığı',
    category: 'photography',
    level: 'intermediate',
    format: 'online',
    summary: 'Işık kaybı ve renk, flaş/strobe konumu, makro ve geniş açı, yüzerlik ve etik.',
    description:
      'Sertifikalı dalgıçlar için sualtı çekim kursu. Suyun ışığı nasıl yuttuğu, beyaz ayarı ve filtreler, strobe konumlandırma ve backscatter, makro ve geniş açı yaklaşımı, kompakt ve aksiyon kameraları, fotoğrafçı olarak yüzerlik ve resif etiği, düzenleme.',
    imageUrl: unsplash('1582967788606-a171c1080cb0'),
    instructorId: 'i_zeynep',
    provider: 'Kaş Dive Center',
    certificateName: 'Sualtı Fotoğrafçısı',
    validityMonths: null,
    priceTry: 1100,
    durationHours: 6,
    lessonCount: 6,
    rating: 4.8,
    reviewCount: 39,
    enrolledCount: 520,
    languages: ['Türkçe', 'English'],
    prerequisites: ['Open Water ya da eşdeğeri', 'İyi yüzerlik kontrolü'],
    outcomes: [
      'Derinlikte renk kaybını yönetmek',
      'Strobe konumu ve backscatter önleme',
      'Makro ve geniş açı kompozisyon',
      'Aksiyon kamerayla sualtı video',
      'Resif etiği ve model dalgıçla çalışmak',
    ],
    adventureTypes: ['diving'],
    createdAt: monthsAgo(3),
  },
  {
    id: 'crs_cave',
    slug: 'magaracilik-temel',
    title: 'Mağaracılık Temel',
    category: 'mountaineering',
    level: 'beginner',
    format: 'in_person',
    summary: 'Dikey mağara teknikleri (SRT), aydınlatma, harita ve mağara etiği; Mersin’de 3 gün.',
    description:
      'Yeraltı dünyasına giriş. Tek ip tekniği (SRT): jümar ve inici ile iniş-çıkış, ip geçişleri, kask ve aydınlatma sistemleri, mağara ortamı ve tehlikeler (su, hipotermi, CO2), mağara haritası okuma, yarasa ve ekosistem etiği. Mersin Cennet-Cehennem bölgesinde iki mağara.',
    imageUrl: unsplash('1499002238440-d264edd596ec'),
    instructorId: null,
    provider: 'Anadolu Speleoloji Derneği',
    certificateName: 'Mağaracılık Temel',
    validityMonths: null,
    priceTry: 5600,
    durationHours: 24,
    lessonCount: 0,
    rating: 4.7,
    reviewCount: 26,
    enrolledCount: 110,
    languages: ['Türkçe'],
    prerequisites: ['Klostrofobi olmaması', 'Temel kondisyon'],
    outcomes: [
      'SRT ile iniş ve çıkış',
      'İp geçişleri ve yeniden ankraj',
      'Aydınlatma ve yedek sistem',
      'Mağara tehlikelerini tanımak',
      'Mağara haritası ve etik',
    ],
    adventureTypes: ['climbing', 'hiking'],
    createdAt: monthsAgo(2),
  },
];

/* ------------------------------------------------------------------ */
/* Dersler                                                             */
/* ------------------------------------------------------------------ */

export const seedLessons: Lesson[] = [
  ...buildLessons('crs_tdf_basic', [
    {
      title: 'Modül 1 · Dağ kültürü ve planlama',
      items: [
        video('Hoş geldin: Dağcılık nedir, ne değildir?', 12),
        reading('Dağcının sorumlulukları ve tırmanış planı', 15, R.tdfEthics),
        quiz('Modül 1 kontrol', [
          {
            question: 'Tırmanış bildirimi en az kime bırakılır?',
            options: ['Kimseye gerek yok', 'En az bir güvenilir kişiye', 'Sadece sosyal medyaya'],
            answerIndex: 1,
          },
          {
            question: '"Dönüş saati" için doğru ifade hangisidir?',
            options: [
              'Zirveye yakınsa ertelenir',
              'Nerede olursan ol dönülür',
              'Sadece kışın geçerli',
            ],
            answerIndex: 1,
          },
          {
            question: 'Grup hızı kime göre ayarlanır?',
            options: ['En hızlı üyeye', 'Lidere', 'En yavaş üyeye'],
            answerIndex: 2,
          },
        ]),
      ],
    },
    {
      title: 'Modül 2 · Ekipman ve hava',
      items: [
        reading('Katmanlama: pamuk öldürür', 12, R.layering),
        video('Sırt çantası toplama ve ağırlık dağılımı', 14, true),
        reading('Yıldırım ve 30/30 kuralı', 10, R.lightning),
      ],
    },
    {
      title: 'Modül 3 · İp ve düğümler',
      items: [
        reading('Beş temel düğüm', 15, R.knots),
        video('Sekizli ve kazık bağı uygulaması', 11),
        practical(
          'Arazi uygulaması: yürüyüş, kamp ve ip (2 gün)',
          960,
          'Kamp kurulumu, yük taşıma, teleferik/ip ile hareket, düğüm ve emniyet pratikleri. Oturum tarihlerini kurs sayfasından seç.',
        ),
      ],
    },
  ]),

  ...buildLessons('crs_rope', [
    {
      title: 'Modül 1 · Temeller',
      items: [
        video('Kurtarma düşünce yapısı: basit, hızlı, güvenli', 10),
        reading('Düğümler ve ankraj eşitleme', 14, R.knots),
        video('Mekanik avantaj: 2:1, 3:1, 5:1', 16, true),
      ],
    },
    {
      title: 'Modül 2 · Buzul ve yarık',
      items: [
        reading('İp takımı ve yarık kurtarma', 15, R.ropeTeam),
        quiz('Yarık kurtarma kontrol', [
          {
            question: 'Yarık düşmesinde ilk yapılacak şey nedir?',
            options: [
              'Makara kurmak',
              'Kendini durdurmak (self-arrest)',
              'Telsizle yardım çağırmak',
            ],
            answerIndex: 1,
          },
          {
            question: '3:1 (Z) sistemde ana ip üzerinde makara hangi elemanla tutulur?',
            options: ['Prusik', 'Sekizli', 'Kazık bağı'],
            answerIndex: 0,
          },
          {
            question: 'İdeal buzul ip takımı kaç kişidir?',
            options: ['1', '2', '3'],
            answerIndex: 2,
          },
        ]),
      ],
    },
    {
      title: 'Modül 3 · Arazi',
      items: [
        practical(
          'Arazi günü 1: Sistemler ve yük aktarma',
          480,
          'Ankraj kurma, belay kaçışı, 3:1 ve 5:1 kurulumu, prusikle çıkış.',
        ),
        practical(
          'Arazi günü 2: Senaryolar',
          480,
          'Yarık kurtarma, yaralı partneri indirme, gece senaryosu.',
        ),
      ],
    },
  ]),

  ...buildLessons('crs_avy1', [
    {
      title: 'Modül 1 · Çığ nasıl oluşur?',
      items: [
        video('Çığ tipleri: gevşek kar, slab, ıslak', 14),
        reading('Çığ üçgeni: arazi, kar örtüsü, hava', 16, R.triangle),
        quiz('Çığ üçgeni kontrol', [
          {
            question: 'Çığların en sık tetiklendiği eğim aralığı?',
            options: ['15–25°', '30–45°', '50–60°'],
            answerIndex: 1,
          },
          {
            question: 'Ölümcül çığ kazalarının çoğunda çığı kim tetikler?',
            options: ['Kurban ya da grubu', 'Doğal tetikleme', 'Kar aracı'],
            answerIndex: 0,
          },
          {
            question: '"Kayda değer" (3) tehlike seviyesi için doğru ifade?',
            options: [
              'Güvenlidir',
              'Ölümcül kazaların önemli kısmı bu seviyede olur',
              'Yalnızca 5 tehlikelidir',
            ],
            answerIndex: 1,
          },
          {
            question: '24 saatte kaç cm yeni kar tehlikeyi hızla artırır?',
            options: ['5 cm', '30 cm', '100 cm'],
            answerIndex: 1,
          },
        ]),
      ],
    },
    {
      title: 'Modül 2 · Bülten ve planlama',
      items: [
        video('Çığ bültenini okumak ve tehlike ölçeği', 18, true),
        video('Arazi tuzakları ve eğim ölçme', 12),
      ],
    },
    {
      title: 'Modül 3 · Kurtarma',
      items: [
        reading('Arkadaş kurtarma: 15 dakika kuralı', 15, R.companionRescue),
        practical(
          'Arazi günü 1: Kar profili ve arazi',
          480,
          'Kar çukuru, kompresyon testi, eğim ölçme, rota seçimi.',
        ),
        practical(
          'Arazi günü 2: Kurtarma tatbikatı',
          480,
          'Tek gömü, zamanlı kurtarma, kürek rotasyonu.',
        ),
      ],
    },
  ]),

  ...buildLessons('crs_wfa', [
    {
      title: 'Modül 1 · Hasta değerlendirme',
      items: [
        video('Doğada ilk yardım neden farklı?', 9),
        reading('Sistematik hasta değerlendirmesi', 14, R.wfaPatient),
        quiz('ABCDE ve SAMPLE', [
          {
            question: 'AVPU skalasında "P" neyi ifade eder?',
            options: ['Pulse (nabız)', 'Pain (ağrıya yanıt)', 'Position (pozisyon)'],
            answerIndex: 1,
          },
          {
            question: 'Vital bulgular ne sıklıkla tekrar ölçülür?',
            options: ['Bir kez', 'Her 15 dakikada', 'Yalnızca kötüleşince'],
            answerIndex: 1,
          },
          {
            question: 'SAMPLE\'daki "L" harfi?',
            options: ['Location', 'Last meal (son yenilen)', 'Level'],
            answerIndex: 1,
          },
        ]),
      ],
    },
    {
      title: 'Modül 2 · Çevresel aciller',
      items: [
        reading('Hipotermi ve donma', 13, R.hypothermia),
        video('Isı bitkinliği ve ısı çarpması', 10, true),
        reading('Yıldırım güvenliği', 8, R.lightning),
      ],
    },
    {
      title: 'Modül 3 · Uygulama',
      items: [
        practical(
          'Arazi günü 1: Değerlendirme ve yaralar',
          480,
          'Senaryolar, atelleme, yara bakımı.',
        ),
        practical('Arazi günü 2: Tahliye', 480, 'Omurga yönetimi, taşıma, kurtarma iletişimi.'),
      ],
    },
  ]),

  ...buildLessons('crs_nav', [
    {
      title: 'Modül 1 · Harita',
      items: [
        video('Topografik haritayı tanı: ölçek, lejant, eş yükselti', 15),
        video('Eğim, sırt, vadi: eş yükselti eğrilerinden arazi okumak', 13, true),
        quiz('Harita okuma', [
          {
            question: '1:25.000 ölçekli haritada 4 cm kaç metredir?',
            options: ['250 m', '1.000 m', '4.000 m'],
            answerIndex: 1,
          },
          {
            question: 'Eş yükselti eğrileri sıklaşıyorsa arazi?',
            options: ['Düzleşiyor', 'Dikleşiyor', 'Sulak'],
            answerIndex: 1,
          },
          {
            question: '"V" şeklindeki eğriler yükseğe doğru sivriliyorsa bu bir?',
            options: ['Sırt', 'Vadi/dere', 'Zirve'],
            answerIndex: 1,
          },
        ]),
      ],
    },
    {
      title: 'Modül 2 · Pusula',
      items: [
        reading('Manyetik sapma ve kerteriz', 16, R.declination),
        video('Kesişme ile konum bulma uygulaması', 12),
        quiz('Pusula', [
          {
            question: "Türkiye'de manyetik sapma yaklaşık hangi yöndedir?",
            options: ['Batı', 'Doğu', 'Sıfır'],
            answerIndex: 1,
          },
          {
            question: 'Naismith kuralına göre 10 km yatay + 600 m tırmanış kaç saat?',
            options: ['2', '3', '4'],
            answerIndex: 1,
          },
          {
            question: 'Geri kerteriz için kerterize kaç derece eklenir?',
            options: ['90', '180', '360'],
            answerIndex: 1,
          },
        ]),
      ],
    },
    {
      title: 'Modül 3 · Dijital',
      items: [
        reading('GPS, koordinatlar ve çevrimdışı haritalar', 14, R.gps),
        video('Rota planlama ve iz kaydı uygulaması', 16, true),
        video('Sis ve karda navigasyon stratejileri', 11),
        quiz('Final', [
          {
            question: 'Track ve route arasındaki fark?',
            options: ['Aynı şey', 'Track geçmiş, route plan', 'Route geçmiş, track plan'],
            answerIndex: 1,
          },
          {
            question: 'Soğukta telefon pili için en iyi uygulama?',
            options: ['Dış cepte taşımak', 'İç cepte taşımak', 'Kapatmamak'],
            answerIndex: 1,
          },
          {
            question: 'Yol noktası (waypoint) nereye konur?',
            options: ['Her sapağa', 'Karar noktalarına', 'Yalnızca zirveye'],
            answerIndex: 1,
          },
        ]),
      ],
    },
  ]),

  ...buildLessons('crs_padi_ow', [
    {
      title: 'Bölüm 1 · Dalış dünyası',
      items: [
        video('Ekipman: maske, regülatör, BCD, tüp', 18),
        reading('Yüzerlik: nötr olmanın sırrı', 14, R.buoyancy),
        video('Basınç ve hacim: Boyle yasası su altında', 12, true),
      ],
    },
    {
      title: 'Bölüm 2 · Planlama ve güvenlik',
      items: [
        reading('Dekompresyonsuz limitler ve güvenlik duruşu', 16, R.noDeco),
        quiz('Bilgi kontrolü', [
          {
            question: 'Yükselirken en önemli kural?',
            options: ['Hızlı çık', 'Asla nefes tutma', 'Gözlerini kapat'],
            answerIndex: 1,
          },
          {
            question: '18 m için tipik dekompresyonsuz limit?',
            options: ['20 dk', '56 dk', '147 dk'],
            answerIndex: 1,
          },
          {
            question: 'Güvenlik duruşu nerede ve ne kadar yapılır?',
            options: ['5 m / 3 dk', '10 m / 1 dk', '15 m / 5 dk'],
            answerIndex: 0,
          },
          {
            question: 'Tek dalıştan sonra uçuş için minimum bekleme?',
            options: ['2 saat', '12 saat', '48 saat'],
            answerIndex: 1,
          },
        ]),
        video('Buddy sistemi ve el işaretleri', 10),
      ],
    },
    {
      title: 'Bölüm 3 · Suda',
      items: [
        practical(
          'Kapalı su becerileri (havuz)',
          300,
          'Maske temizleme, regülatör bulma, CESA, yüzerlik.',
        ),
        practical(
          'Açık su dalışları 1–4',
          720,
          'Kaş’ta dört açık su dalışı ve beceri değerlendirmesi.',
        ),
      ],
    },
  ]),

  ...buildLessons('crs_pg_xc', [
    {
      title: 'Modül 1 · Termik',
      items: [
        video('Termik nedir, nerede doğar?', 14),
        reading('Termik bulma, merkezleme ve XC kararları', 15, R.thermal),
        quiz('Termik kontrol', [
          {
            question: 'Bulut tabanına yaklaşırken en az kaç metre altta kalınmalı?',
            options: ['50 m', '300 m', '1.000 m'],
            answerIndex: 1,
          },
          {
            question: 'Termikte dönüş yönünü kim belirler?',
            options: ['En yüksekteki pilot', 'İlk giren pilot', 'En tecrübeli pilot'],
            answerIndex: 1,
          },
          {
            question: 'Hangi yüzey termik üretmez?',
            options: ['Sürülmüş tarla', 'Göl', 'Kaya yamacı'],
            answerIndex: 1,
          },
        ]),
      ],
    },
    {
      title: 'Modül 2 · Uçuş günleri',
      items: [
        video('Hava sahası ve yasak bölgeler', 10, true),
        practical(
          'Uçuş günleri 1–2: Termik merkezleme',
          600,
          'Telsiz koçluğu ile termik çalışması.',
        ),
        practical(
          'Uçuş günleri 3–4: XC görevleri',
          600,
          'Kısa geçişler ve iniş alanı seçimi, iz analizi.',
        ),
      ],
    },
  ]),

  ...buildLessons('crs_paddle', [
    {
      title: 'Modül 1 · Soğuk su ve giyinme',
      items: [
        video('Soğuk şoku: ilk 3 dakika', 9),
        reading('Kürek güvenliğinin temelleri', 14, R.paddleSafety),
        quiz('Güvenlik kontrol', [
          {
            question: 'Kıyafet neye göre seçilir?',
            options: ['Hava sıcaklığına', 'Su sıcaklığına', 'Mevsime'],
            answerIndex: 1,
          },
          {
            question: 'Nehirde tekneden çıkınca ayaklar?',
            options: ['Dibe basılır', 'Öne uzatılıp sırtüstü yüzülür', 'Aşağı sarkıtılır'],
            answerIndex: 1,
          },
          {
            question: 'Kürek dik tutulursa işaret?',
            options: ['Dur', 'Toplan', 'Yardım'],
            answerIndex: 1,
          },
        ]),
      ],
    },
    {
      title: 'Modül 2 · Suda',
      items: [
        video('Hava, gelgit ve akıntı okumak', 12, true),
        practical(
          'Su günü: kurtarma teknikleri',
          420,
          'Islak çıkış, paddle-float, T-kurtarma, yedekte çekme.',
        ),
        practical('Grup turu', 180, 'Kıyıya paralel kısa tur, işaretler ve düzen.'),
      ],
    },
  ]),

  ...buildLessons('crs_winter_camp', [
    {
      title: 'Modül 1 · Uyku sistemi',
      items: [
        video('R değeri, tulum konforu ve sabah rutini', 13),
        video('Kar zemininde çadır kurmak ve ankrajlar', 12, true),
      ],
    },
    {
      title: 'Modül 2 · Kar barınakları',
      items: [
        reading('Kar mağarası ve quinzhee', 15, R.shelter),
        video('Kar mağarası kazma: adım adım', 16),
        quiz('Barınak kontrol', [
          {
            question: 'Kar mağarasında yatak platformu girişe göre nerede olmalı?',
            options: ['Daha alçakta', 'Daha yüksekte', 'Aynı seviyede'],
            answerIndex: 1,
          },
          {
            question: 'Tavan kalınlığı en az?',
            options: ['10 cm', '30 cm', '1 m'],
            answerIndex: 1,
          },
          {
            question: 'Çadır içinde ocak?',
            options: ['Serbest', 'Asla', 'Sadece kışın'],
            answerIndex: 1,
          },
        ]),
      ],
    },
    {
      title: 'Modül 3 · Su, yemek, giysi',
      items: [
        reading('Katmanlama ve kuru kalmak', 10, R.layering),
        video('Kar eritme ve kış beslenmesi', 9, true),
      ],
    },
  ]),

  ...buildLessons('crs_altitude', [
    {
      title: 'Modül 1 · Fizyoloji',
      items: [
        video('Yükseklikte vücut: oksijen, nabız, uyku', 14),
        reading('AMS, HACE, HAPE ve Lake Louise skoru', 16, R.lakeLouise),
        quiz('Yükseklik hastalıkları', [
          {
            question: 'AMS için zorunlu belirti?',
            options: ['Öksürük', 'Baş ağrısı', 'Ateş'],
            answerIndex: 1,
          },
          {
            question: 'Ataksi (denge kaybı) hangi durumun işaretidir?',
            options: ['HAPE', 'HACE', 'Donma'],
            answerIndex: 1,
          },
          {
            question: '3.000 m üstünde günlük uyku irtifası artışı en fazla?',
            options: ['300–500 m', '1.000 m', '1.500 m'],
            answerIndex: 0,
          },
          {
            question: "HAPE'de en etkili tedavi?",
            options: ['Daha fazla su', 'İnmek', 'Beklemek'],
            answerIndex: 1,
          },
        ]),
      ],
    },
    {
      title: 'Modül 2 · Aklimatizasyon ve ekipman',
      items: [
        video('Aklimatizasyon takvimi: Ağrı, Island Peak, Lenin', 18, true),
        reading('Yüksek irtifa ekipman sistemi', 14, R.ams_equipment),
        reading('Soğuk yaralanmaları', 10, R.hypothermia),
      ],
    },
    {
      title: 'Modül 3 · Zirve günü',
      items: [
        video('Zirve günü planı ve dönüş saati', 12),
        quiz('Final', [
          {
            question: 'Zirve gününde en kritik karar noktası?',
            options: ['Kalkış saati', 'Dönüş saati', 'Fotoğraf molası'],
            answerIndex: 1,
          },
          {
            question: 'Kar körlüğü kaç saatte gelişebilir?',
            options: ['1 saat', '6–12 saat', '3 gün'],
            answerIndex: 1,
          },
          {
            question: 'Güç bankaları soğukta nerede taşınır?',
            options: ['Çantanın dışında', 'İç cepte', 'Çadır dışında'],
            answerIndex: 1,
          },
        ]),
      ],
    },
  ]),

  ...buildLessons('crs_drone', [
    {
      title: 'Modül 1 · Mevzuat',
      items: [
        video('SHT-İHA: sınıflar ve kayıt', 12),
        reading('Uçuş kuralları, izinler ve sorumluluk', 15, R.droneRules),
        quiz('Mevzuat kontrol', [
          {
            question: 'İHA0 sınıfının ağırlık aralığı?',
            options: ['500 g – 4 kg', '4 – 25 kg', '25 kg üstü'],
            answerIndex: 0,
          },
          {
            question: 'Azami uçuş yüksekliği (AGL)?',
            options: ['50 m', '120 m', '500 m'],
            answerIndex: 1,
          },
          {
            question: 'Havalimanı çevresi yasak saha yarıçapı?',
            options: ['1 km', '9 km', '50 km'],
            answerIndex: 1,
          },
          {
            question: 'Dönüş için önerilen pil rezervi?',
            options: ['%5', '%30', '%80'],
            answerIndex: 1,
          },
        ]),
      ],
    },
    {
      title: 'Modül 2 · Meteoroloji ve uçuş',
      items: [
        video('Rüzgâr, sıcaklık ve pil', 11, true),
        video('Dağda ve kıyıda uçuş özellikleri', 13),
        video('Uçuş öncesi kontrol listesi', 8, true),
      ],
    },
    {
      title: 'Modül 3 · Sınav',
      items: [
        video('Sınav stratejisi ve sık hatalar', 9),
        quiz(
          'Deneme sınavı',
          [
            {
              question: 'VLOS ne demektir?',
              options: ['Görüş hattı içinde uçuş', 'Otomatik uçuş', 'Gece uçuşu'],
              answerIndex: 0,
            },
            {
              question: 'İHA1 için hangi sigorta zorunludur?',
              options: ['Kasko', 'Üçüncü şahıs mali mesuliyet', 'Sağlık'],
              answerIndex: 1,
            },
            {
              question: 'Milli parkta uçuş için?',
              options: ['İzin gerekmez', 'Ayrı izin gerekir', 'Sadece hafta içi serbest'],
              answerIndex: 1,
            },
          ],
          15,
        ),
      ],
    },
  ]),

  ...buildLessons('crs_lnt', [
    {
      title: 'Modül 1 · Yedi ilke',
      items: [
        video('Neden iz bırakmıyoruz? Etkinin bilimi', 11),
        reading('Yedi ilke', 14, R.lnt),
        quiz('İlke kontrol', [
          {
            question: 'Kamp sudan en az kaç metre uzağa kurulur?',
            options: ['10 m', '60 m', '500 m'],
            answerIndex: 1,
          },
          {
            question: 'Kedi çukuru derinliği?',
            options: ['5 cm', '15–20 cm', '50 cm'],
            answerIndex: 1,
          },
          {
            question: 'Patikada kim yol verir?',
            options: ['Yokuş yukarı çıkan', 'Yokuş aşağı inen', 'Genç olan'],
            answerIndex: 1,
          },
        ]),
      ],
    },
    {
      title: 'Modül 2 · Öğretmek',
      items: [
        video('"Otorite değil etki": pedagojik yaklaşım', 13, true),
        practical(
          'Arazi günü 1: Etkiyi ölçmek',
          480,
          'Patika erozyonu, kamp etkisi, atık analizi.',
        ),
        practical(
          'Arazi günü 2: Öğretme pratiği',
          480,
          'Her katılımcı bir ilkeyi öğretir; geri bildirim.',
        ),
      ],
    },
  ]),

  ...buildLessons('crs_photo', [
    {
      title: 'Modül 1 · Işık ve kompozisyon',
      items: [
        video('Işığı okumak: altın saat, mavi saat, bulut', 12),
        reading('Kompozisyon: üçte bir ve derinlik', 12, R.ruleOfThirds),
        video('Ölçek için insan ve renk', 9, true),
      ],
    },
    {
      title: 'Modül 2 · Sahada',
      items: [
        video('Yürürken çekim: hızlı ayarlar', 10),
        video('Yıldız ve Samanyolu temelleri', 14, true),
        video('Ekipmanı soğuk ve nemden korumak', 7),
        quiz('Kontrol', [
          {
            question: 'Polarize filtre güneşe göre hangi açıda en etkilidir?',
            options: ['0°', '90°', '180°'],
            answerIndex: 1,
          },
          {
            question: 'Şelale için en iyi ışık?',
            options: ['Öğle güneşi', 'Bulutlu hava', 'Gece'],
            answerIndex: 1,
          },
          {
            question: 'Histogram nasıl yönetilir?',
            options: ['Sola yasla', 'Sağa yasla ama patlatma', 'Ortada tut'],
            answerIndex: 1,
          },
        ]),
      ],
    },
  ]),

  ...buildLessons('crs_trail', [
    {
      title: 'Modül 1 · Teknik',
      items: [
        video('Asfalttan patikaya: ne değişiyor?', 8),
        reading('Efor, iniş ve beslenme', 12, R.pacing),
        video('İniş tekniği: bakış, adım, kollar', 11, true),
      ],
    },
    {
      title: 'Modül 2 · Hazırlık',
      items: [
        video('Zorunlu ekipman ve güvenlik planı', 9),
        video('12 haftalık ilk yarış programı', 10, true),
        quiz('Kontrol', [
          {
            question: '%15 üstü eğimde çoğu koşucu ne yapar?',
            options: ['Sprint', 'Güç yürüyüşü', 'Durur'],
            answerIndex: 1,
          },
          {
            question: '90 dk üstü koşuda saatlik karbonhidrat hedefi?',
            options: ['10 g', '40–60 g', '150 g'],
            answerIndex: 1,
          },
          {
            question: 'İnişte bakış nereye?',
            options: ['Ayaklara', '3–5 m ileriye', 'Ufka'],
            answerIndex: 1,
          },
        ]),
      ],
    },
  ]),

  ...buildLessons('crs_uw_photo', [
    {
      title: 'Modül 1 · Işık ve renk',
      items: [
        video('Su ışığı nasıl yutar: derinlik ve renk', 11),
        video('Strobe konumu ve backscatter', 13, true),
        reading('Kompozisyon ilkeleri su altında', 10, R.ruleOfThirds),
      ],
    },
    {
      title: 'Modül 2 · Uygulama',
      items: [
        video('Makro ve geniş açı yaklaşımı', 12),
        reading('Fotoğrafçı olarak yüzerlik', 10, R.buoyancy),
        quiz('Kontrol', [
          {
            question: "Backscatter'ı azaltmak için strobe nereye konur?",
            options: ['Lensin hemen yanına', 'Lensten uzağa, yana', 'Kameranın arkasına'],
            answerIndex: 1,
          },
          {
            question: 'Derinlikte ilk kaybolan renk?',
            options: ['Mavi', 'Kırmızı', 'Yeşil'],
            answerIndex: 1,
          },
          {
            question: 'Resife dokunmak?',
            options: ['Fotoğraf için kabul edilir', 'Asla', 'Sadece eldivenle'],
            answerIndex: 1,
          },
        ]),
      ],
    },
  ]),
];

/* ------------------------------------------------------------------ */
/* Oturumlar                                                           */
/* ------------------------------------------------------------------ */

const GEYIK: GeoPoint = { latitude: 36.94, longitude: 30.52 };
const ALADAG: GeoPoint = { latitude: 37.82, longitude: 35.15 };
const KACKAR: GeoPoint = { latitude: 40.83, longitude: 41.16 };
const KAS: GeoPoint = { latitude: 36.2019, longitude: 29.6414 };
const BABADAG: GeoPoint = { latitude: 36.55, longitude: 29.19 };
const ULUDAG: GeoPoint = { latitude: 40.07, longitude: 29.22 };
const KOPRULU: GeoPoint = { latitude: 37.19, longitude: 31.18 };
const ERZURUM: GeoPoint = { latitude: 40.29, longitude: 41.6 };
const BELGRAD: GeoPoint = { latitude: 41.18, longitude: 28.98 };
const MERSIN: GeoPoint = { latitude: 36.45, longitude: 34.1 };
const ISTANBUL: GeoPoint = { latitude: 41.04, longitude: 29.0 };
const BOLU: GeoPoint = { latitude: 40.6, longitude: 31.32 };
const ANKARA: GeoPoint = { latitude: 39.92, longitude: 32.85 };

export const seedCourseSessions: CourseSession[] = [
  session('crs_tdf_basic', 1, 12, 2, 'Bolu Aladağ, Kartalkaya', BOLU, 16, 5, 0),
  session('crs_tdf_basic', 2, 40, 2, 'Uludağ, Sarıalan', ULUDAG, 16, 12, 0),
  session('crs_tdf_basic', 3, 68, 2, 'Aladağlar, Sokullupınar', ALADAG, 12, 12, 0),

  session('crs_rock1', 1, 9, 3, 'Geyikbayırı, Antalya', GEYIK, 6, 1, 6500),
  session('crs_rock1', 2, 30, 3, 'Geyikbayırı, Antalya', GEYIK, 6, 4, 6500),
  session(
    'crs_rock1',
    3,
    58,
    3,
    'Ballıkayalar, Kocaeli',
    { latitude: 40.85, longitude: 29.6 },
    6,
    6,
    6200,
  ),

  session('crs_rock2', 1, 21, 4, 'Aladağlar, Niğde', ALADAG, 4, 2, 9800),
  session(
    'crs_rock2',
    2,
    75,
    4,
    'Ballıkayalar, Kocaeli',
    { latitude: 40.85, longitude: 29.6 },
    4,
    4,
    9800,
  ),

  session('crs_rope', 1, 18, 2, 'Geyikbayırı, Antalya', GEYIK, 8, 3, 0),
  session('crs_rope', 2, 52, 2, 'Erciyes, Kayseri', { latitude: 38.53, longitude: 35.45 }, 8, 8, 0),

  session('crs_avy1', 1, 95, 2, 'Kaçkarlar, Ayder', KACKAR, 10, 4, 0),
  session(
    'crs_avy1',
    2,
    120,
    2,
    'Erciyes, Kayseri',
    { latitude: 38.53, longitude: 35.45 },
    10,
    10,
    0,
  ),
  session('crs_avy1', 3, 150, 2, 'Uludağ, Bursa', ULUDAG, 10, 10, 0),

  session('crs_avy2', 1, 130, 4, 'Kaçkarlar, Ayder', KACKAR, 6, 6, 12500),
  session('crs_avy2', 2, 165, 4, 'Palandöken, Erzurum', ERZURUM, 6, 0, 12500),

  session('crs_wfa', 1, 6, 2, 'Belgrad Ormanı, İstanbul', BELGRAD, 14, 0, 0),
  session('crs_wfa', 2, 27, 2, 'Eymir Gölü, Ankara', ANKARA, 14, 6, 0),
  session('crs_wfa', 3, 48, 2, 'Belgrad Ormanı, İstanbul', BELGRAD, 14, 14, 0),
  session('crs_wfa', 4, 76, 2, 'Kaş, Antalya', KAS, 12, 12, 0),

  session(
    'crs_wfr',
    1,
    35,
    9,
    'Bolu Yedigöller',
    { latitude: 40.94, longitude: 31.75 },
    12,
    3,
    24000,
  ),
  session(
    'crs_wfr',
    2,
    110,
    9,
    'Antalya, Saklıkent',
    { latitude: 36.83, longitude: 30.33 },
    12,
    12,
    24000,
  ),

  session('crs_padi_ow', 1, 8, 3, 'Kaş Dive Center', KAS, 6, 2, 0),
  session('crs_padi_ow', 2, 22, 3, 'Kaş Dive Center', KAS, 6, 6, 0),
  session('crs_padi_ow', 3, 43, 3, 'Kaş Dive Center', KAS, 6, 6, 0),

  session('crs_padi_aow', 1, 15, 2, 'Kaş Dive Center', KAS, 6, 3, 11000),
  session('crs_padi_aow', 2, 50, 2, 'Kaş Dive Center', KAS, 6, 6, 11000),

  session('crs_freedive', 1, 11, 3, 'Kaş, Limanağzı', KAS, 5, 2, 7800),
  session('crs_freedive', 2, 39, 3, 'Kaş, Limanağzı', KAS, 5, 5, 7800),

  session('crs_pg_p1', 1, 14, 10, 'Babadağ, Fethiye', BABADAG, 6, 2, 25000),
  session('crs_pg_p1', 2, 45, 10, 'Babadağ, Fethiye', BABADAG, 6, 6, 25000),
  session('crs_pg_p1', 3, 80, 10, 'Babadağ, Fethiye', BABADAG, 6, 6, 25000),

  session('crs_pg_xc', 1, 25, 4, 'Ölüdeniz, Fethiye', BABADAG, 6, 4, 0),
  session('crs_pg_xc', 2, 62, 4, 'Ölüdeniz, Fethiye', BABADAG, 6, 6, 0),

  session('crs_paddle', 1, 10, 1, 'Caddebostan, İstanbul', ISTANBUL, 10, 5, 0),
  session('crs_paddle', 2, 31, 1, 'Sapanca Gölü', { latitude: 40.72, longitude: 30.25 }, 10, 10, 0),

  session('crs_raft_guide', 1, 33, 6, 'Köprülü Kanyon, Antalya', KOPRULU, 10, 6, 18500),
  session('crs_raft_guide', 2, 90, 6, 'Köprülü Kanyon, Antalya', KOPRULU, 10, 10, 18500),

  session('crs_ice', 1, 100, 3, 'Tortum Şelaleleri, Erzurum', ERZURUM, 6, 6, 8900),
  session('crs_ice', 2, 128, 3, 'Palandöken Buz Parkı', ERZURUM, 6, 5, 8900),

  session('crs_lnt', 1, 19, 2, 'Belgrad Ormanı, İstanbul', BELGRAD, 12, 7, 0),
  session(
    'crs_lnt',
    2,
    55,
    2,
    'Kazdağları, Balıkesir',
    { latitude: 39.7, longitude: 26.85 },
    12,
    12,
    0,
  ),

  session('crs_mtb', 1, 7, 2, 'Belgrad Ormanı, İstanbul', BELGRAD, 8, 3, 3400),
  session('crs_mtb', 2, 28, 2, 'Belgrad Ormanı, İstanbul', BELGRAD, 8, 8, 3400),

  session('crs_cave', 1, 24, 3, 'Cennet-Cehennem, Mersin', MERSIN, 8, 4, 5600),
  session('crs_cave', 2, 66, 3, 'Cennet-Cehennem, Mersin', MERSIN, 8, 8, 5600),
];

/* ------------------------------------------------------------------ */
/* Kayıtlar ve sertifikalar                                            */
/* ------------------------------------------------------------------ */

const WFA_ISSUED = monthsAgo(5);
const WFA_EXPIRES = new Date(new Date(WFA_ISSUED).getTime() + 24 * 30 * 86_400_000).toISOString();

export const seedEnrollments: Enrollment[] = [
  {
    id: 'enr_me_wfa',
    courseId: 'crs_wfa',
    userId: 'u_me',
    sessionId: 'crs_wfa_s1',
    status: 'completed',
    completedLessonIds: [
      'crs_wfa_l1',
      'crs_wfa_l2',
      'crs_wfa_l3',
      'crs_wfa_l4',
      'crs_wfa_l5',
      'crs_wfa_l6',
      'crs_wfa_l7',
      'crs_wfa_l8',
    ],
    progress: 1,
    quizScores: { crs_wfa_l3: 100 },
    enrolledAt: monthsAgo(6),
    completedAt: WFA_ISSUED,
  },
  {
    id: 'enr_me_avy1',
    courseId: 'crs_avy1',
    userId: 'u_me',
    sessionId: null,
    status: 'active',
    completedLessonIds: ['crs_avy1_l1', 'crs_avy1_l2'],
    progress: 0.4,
    quizScores: {},
    enrolledAt: daysAgo(9),
    completedAt: null,
  },
  {
    id: 'enr_me_rock1',
    courseId: 'crs_rock1',
    userId: 'u_me',
    sessionId: 'crs_rock1_s1',
    status: 'active',
    completedLessonIds: [],
    progress: 0,
    quizScores: {},
    enrolledAt: daysAgo(3),
    completedAt: null,
  },
  {
    id: 'enr_elif_nav',
    courseId: 'crs_nav',
    userId: 'u_elif',
    sessionId: null,
    status: 'completed',
    completedLessonIds: [],
    progress: 1,
    quizScores: {},
    enrolledAt: monthsAgo(4),
    completedAt: monthsAgo(3),
  },
  {
    id: 'enr_mert_photo',
    courseId: 'crs_photo',
    userId: 'u_mert',
    sessionId: null,
    status: 'active',
    completedLessonIds: ['crs_photo_l1'],
    progress: 0.14,
    quizScores: {},
    enrolledAt: daysAgo(12),
    completedAt: null,
  },
];

export const seedCertificates: Certificate[] = [
  {
    id: 'cert_me_wfa',
    userId: 'u_me',
    courseId: 'crs_wfa',
    code: certificateCode('u_me', 'crs_wfa', WFA_ISSUED),
    issuedAt: WFA_ISSUED,
    expiresAt: WFA_EXPIRES,
    holderName: 'Deniz Kaya',
  },
];

/* ------------------------------------------------------------------ */
/* Yorumlar                                                            */
/* ------------------------------------------------------------------ */

export const seedCourseReviews: CourseReview[] = [
  {
    id: 'crv_1',
    courseId: 'crs_wfa',
    authorId: 'u_elif',
    rating: 5,
    text: 'Senaryolar o kadar gerçekçiydi ki ikinci gün Belgrad Ormanı’nda gerçekten yaralı taşıdığımı hissettim. Hipotermi sarması artık refleks.',
    createdAt: daysAgo(14),
  },
  {
    id: 'crv_2',
    courseId: 'crs_wfa',
    authorId: 'u_mert',
    rating: 5,
    text: 'Online modüller kısa ve öz, arazi günleri yoğun. ABCDE artık kafamda oturdu. Rehber olan herkes almalı.',
    createdAt: daysAgo(40),
  },
  {
    id: 'crv_3',
    courseId: 'crs_avy1',
    authorId: 'u_kerem',
    rating: 5,
    text: 'Emre hoca çığ bültenini okumayı öyle anlattı ki artık kayak turuna bültensiz çıkmıyorum. Kurtarma tatbikatında kürek rotasyonu şaşırtıcı derecede yorucu.',
    createdAt: daysAgo(60),
  },
  {
    id: 'crv_4',
    courseId: 'crs_avy1',
    authorId: 'u_ayse',
    rating: 4,
    text: 'İçerik mükemmel, tek eksik online videoların bir kısmı biraz uzun. Arazi günleri için 10 üzerinden 10.',
    createdAt: daysAgo(85),
  },
  {
    id: 'crv_5',
    courseId: 'crs_rock1',
    authorId: 'u_lale',
    rating: 5,
    text: 'Sıfırdan üçüncü günün sonunda lead tırmandım! Can hoca düşme pratiğini o kadar sakin yaptırıyor ki korku kayboluyor.',
    createdAt: daysAgo(22),
  },
  {
    id: 'crv_6',
    courseId: 'crs_padi_ow',
    authorId: 'u_nil',
    rating: 5,
    text: 'Zeynep’le Kaş’ta Open Water aldım; yüzerlik dersinden sonra su altında uçuyor gibi hissettim. E-learning kısmı da telefonda rahat.',
    createdAt: daysAgo(33),
  },
  {
    id: 'crv_7',
    courseId: 'crs_nav',
    authorId: 'u_elif',
    rating: 4,
    text: 'Sapma hesabını ilk kez gerçekten anladım. Kesişme yöntemi alıştırmasını evde haritayla yapmak çok işe yaradı.',
    createdAt: daysAgo(95),
  },
  {
    id: 'crv_8',
    courseId: 'crs_photo',
    authorId: 'u_selin',
    rating: 5,
    text: 'Ücretsiz olmasına inanamadım. Altın saat ve ön plan dersi bisiklet turlarımdaki fotoğrafları bambaşka yaptı.',
    createdAt: daysAgo(18),
  },
  {
    id: 'crv_9',
    courseId: 'crs_altitude',
    authorId: 'u_kerem',
    rating: 5,
    text: 'Ağrı öncesi aldım, Lake Louise skorunu her akşam çadırda not ettik. Aklimatizasyon takvimi birebir işe yaradı.',
    createdAt: daysAgo(50),
  },
  {
    id: 'crv_10',
    courseId: 'crs_pg_p1',
    authorId: 'u_ayse',
    rating: 5,
    text: 'Babadağ’dan ilk solo uçuşum… Barış hoca telsizden o kadar sakin yönlendirdi ki inişte gülümsüyordum.',
    createdAt: daysAgo(70),
  },
];
