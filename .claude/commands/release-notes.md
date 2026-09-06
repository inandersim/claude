---
description: git log'dan Türkçe sürüm notu taslağı üret (conventional prefix → bölüm)
allowed-tools: Bash, Read, Write
argument-hint: '[--from <etiket|commit>] [--version 1.4.0] [--out docs/releases/v1.4.0.md]'
---

Sürüm notu taslağı üret: `node agents/devops/release-notes.mjs $ARGUMENTS`

- `--from` verilmemişse betik son git etiketinden (yoksa tüm geçmişten) başlar.
- Çıktıyı oku; teknik commit satırlarını kullanıcıya dönük Türkçe cümlelere çevir (özellik → fayda), tekrarları birleştir, "Bilinen sorunlar" bölümü için `docs/health/latest.json` varsa oradaki başarısız adımları ekle.
- `--out` verildiyse dosyaya yaz ve `npx prettier --write` ile biçimlendir; verilmemişse bana markdown olarak göster. Commit yapma.
