# ADR-0005 — Yapay zekâ mimarisi ve ağ geçidi

**Durum:** kabul · **Tarih:** 2026-08 · **İlgili:** `server/ai-gateway/README.md`, `docs/AI_CTO.md` §17

## Bağlam

Uygulamada iki ayrı yapay zekâ ihtiyacı var: kullanıcıya macera planlama
asistanı, ekibe geliştirme desteği. İkisinin de model çağırması gerekiyor, ancak
API anahtarının istemciye gömülmesi kabul edilemez — mobil uygulama paketi
tersine mühendislikle açılabilir.

## Karar

İki katman **kesin olarak ayrılır** ve hiçbir kimlik bilgisini paylaşmaz:

- **Kullanıcı AI:** uygulama → `server/ai-gateway` (Node 22 + TS) → model. İstemci
  yalnızca ağ geçidine, kendi anahtarıyla (`x-zirtan-key`) konuşur; ağ geçidi
  oran sınırı, araç çalıştırma ve maliyet tavanı uygular, yanıtı SSE ile akıtır.
- **Geliştirici AI:** Claude Code + GitHub Actions. Uygulama sunucusunda
  çalışmaz, uygulama verisine erişmez.

## Alternatifler

- **Anahtarı istemciye gömmek:** en hızlı yol; anahtar sızar, fatura patlar.
- **Doğrudan sağlayıcıya istemciden gitmek (proxy'siz):** oran sınırı ve
  maliyet kontrolü imkânsız.
- **Tek katman (kullanıcı ve geliştirici AI'sı aynı süreç):** yetki sınırı
  kaybolur; kullanıcı istemi geliştirme yetkisine ulaşabilir (istem enjeksiyonu).

## Gerekçe

Ayrım güvenlik sınırıdır, mimari zarafet değil: kullanıcıdan gelen metin
güvenilmez veridir ve hiçbir koşulda kod yazma, dağıtım ya da yönetim paneli
yetkisine dokunmamalıdır.

## Sonuçlar

- Ağ geçidi ayakta olmalı; düşerse asistan çalışmaz (uygulama bunu bir hata
  durumu olarak göstermeli, sessizce boş kalmamalı).
- Maliyet ağ geçidinde ölçülür ve tavanlanır.
- Yapay zekâ çıktısı, güvenlik açısından kritik alanlarda (hava, çığ, yol
  durumu) kaynak ve zaman damgası olmadan gösterilmez.
