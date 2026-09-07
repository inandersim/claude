# Mimari karar kayıtları (ADR)

Her dosya **geri dönüşü pahalı** bir kararı ve nedenini saklar. Amaç, altı ay
sonra "bu neden böyle?" diye soran birine (kendimiz dâhil) cevap verebilmek.

Biçim: **Bağlam · Karar · Alternatifler · Gerekçe · Sonuçlar**.
Kayıtlar değiştirilmez; karar değiştiğinde eskisi `Durum: değiştirildi → NNNN`
olarak işaretlenir ve yeni bir ADR yazılır.

| No                                        | Konu                                    | Durum    |
| ----------------------------------------- | --------------------------------------- | -------- |
| [0001](./0001-harita-saglayici.md)        | Harita motoru ve karo biçimi            | kabul    |
| [0002](./0002-kimlik-dogrulama.md)        | Telefon + SMS kodu ile kimlik doğrulama | kabul    |
| [0003](./0003-veri-saglayici-sozlesmesi.md)| Repository sözleşmesi: mock + remote    | kabul    |
| [0004](./0004-rota-veri-modeli.md)        | Rota veri modeli ve planlama motoru     | kabul    |
| [0005](./0005-yapay-zeka-mimarisi.md)     | Yapay zekâ mimarisi ve ağ geçidi        | kabul    |
| [0006](./0006-otonomi-ve-kapilar.md)      | Geliştirme otonomisi ve onay kapıları   | kabul    |

Yeni ADR: numarayı en yüksekten bir fazla al, `architect` ajanına yazdır.
