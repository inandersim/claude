# agents/devops — altyapı betikleri

Node 22, bağımlılıksız (`type: module` — dosyalar `.mjs`). Claude olmadan da çalışır; ajanlar (`.claude/agents/*`) ve workflow'lar (`.github/workflows/*`) bu betiklerin üstüne kurulur. Genel şema: `docs/AGENTS.md`.

| Betik               | Komut                                                | Ne yapar                                                                                                                                           | Çıkış kodu                                        |
| ------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `health.mjs`        | `npm run health` · `-- --dry-run` · `--only=a,b`     | lint, typecheck, test, pipeline, i18n (zorunlu) + expo-doctor, expo install --check, npm audit (danışma). `docs/health/<tarih>.md` + `latest.json` | 1 = zorunlu adım başarısız                        |
| `i18n-check.mjs`    | `npm run i18n:check` · `-- --json` · `--strict`      | Her modül için `en` + 7 dil dosyası var mı, anahtar/yer tutucu kümeleri `tr` ile eşleşiyor mu, `%{` var mı, `localeSet` bağı kurulu mu             | 1 = uyuşmazlık / `%{`; `--strict` ile eksik dosya |
| `release-notes.mjs` | `npm run release-notes` · `-- --from v1.2.0 --out …` | git log → Türkçe bölümlü sürüm notu taslağı (feat/fix/perf/refactor/docs/test/chore)                                                               | 0                                                 |
| `bundle-size.mjs`   | `node agents/devops/bundle-size.mjs [--no-export]`   | `expo export --platform web` sonrası `dist/` boyutu (ham/gzip, uzantı, en büyük 10) ve `docs/health/bundle-size.json` geçmişine göre fark          | 1 = JS gzip > `--threshold` (%5) artış            |

## Örnekler

```bash
node agents/devops/health.mjs --dry-run                 # komut listesi
node agents/devops/health.mjs --only=lint,typecheck     # hızlı tur
node agents/devops/health.mjs --skip=doctor,audit       # ağ yokken
node agents/devops/i18n-check.mjs --modules=ai,maps
node agents/devops/release-notes.mjs --from 35081d5 --version 1.3.0
node agents/devops/bundle-size.mjs --no-export --no-write   # mevcut dist/ için yalnızca özet
```

`tools/ux-audit/drive.js` (Playwright turu) ayrı bir betiktir; kullanım `.claude/agents/ux-auditor.md` içinde.

## GitHub secrets

| Secret              | Zorunlu | Kullanan                                                | Not                                                                                                                                                             |
| ------------------- | :-----: | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` |  evet   | `claude.yml`, `claude-ci-fix.yml`, `nightly-health.yml` | console.anthropic.com → API Keys. Kullanım limitini (aylık bütçe) konsoldan ayarlayın.                                                                          |
| `CLAUDE_GH_TOKEN`   |  hayır  | aynı üç workflow                                        | İnce taneli PAT ya da GitHub App token (`contents`, `pull-requests`, `issues`: write). Yoksa `GITHUB_TOKEN` kullanılır; o zaman bot push'ları CI'yı tetiklemez. |

`dependency-update.yml` yalnızca `GITHUB_TOKEN` kullanır.

Workflow'lardaki `anthropics/claude-code-action@v1` girdileri (`anthropic_api_key`, `github_token`, `prompt`, `claude_args`, `trigger_phrase`, `use_sticky_comment`, `additional_permissions`) 2026-09-06 tarihinde resmi belgeye (`docs/usage.md`) göre doğrulanmıştır; action güncellenirse girdi adlarını yeniden kontrol edin.

## Maliyet notu

- **GitHub Actions:** public depoda ücretsiz; private depoda 2.000 dk/ay. Kaba bütçe: CI ~8 dk/PR, gece taraması ~20 dk/gün (~600 dk/ay), haftalık bağımlılık raporu ~3 dk. Private depoda aylık kotayı aşmamak için gece taramasını `cron: '0 3 * * 1,4'` (haftada iki) yapmak yeterlidir.
- **Claude API:** yalnızca (a) biri `@claude` yazdığında, (b) CI kırmızı olduğunda, (c) gece taraması sorun bulduğunda çağrılır. `--max-turns` üst sınırdır. Küçük bir lint/tip düzeltmesi genellikle birkaç yüz bin token altındadır; büyük bir kök neden analizi birkaç milyon tokene çıkabilir. Konsoldan aylık harcama limiti koyun ve ilk ay `docs/health` PR sayısı × ortalama maliyeti izleyin.
- Yerel `claude` CLI kullanımı abonelik/API planınıza tabidir; `model: sonnet` işaretli ajanlar (translator, test-writer, growth-analyst) daha ucuzdur.
