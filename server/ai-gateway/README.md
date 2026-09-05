# Zirve AI Gateway

Uygulamanın Claude API anahtarını **bündüllememesi** için araya giren küçük bir Node 22 + TypeScript servisi.
Mobil/web istemci yalnızca bu servise (`x-zirve-key` ile) konuşur; servis `@anthropic-ai/sdk` ile modeli çağırır,
araçları (kütüphane araması, acil merkezler, rota/hava stub'ları) çalıştırır ve yanıtı SSE olarak akıtır.

```
Uygulama ──POST /v1/chat (x-zirve-key)──▶ ai-gateway ──@anthropic-ai/sdk──▶ Claude API
   ▲                                          │
   └────────── SSE: delta / tool / done ◀─────┘
```

## Kurulum

```bash
cd server/ai-gateway
npm install
cp .env.example .env   # ya da değişkenleri doğrudan ver
ANTHROPIC_API_KEY=sk-ant-... ZIRVE_GATEWAY_KEYS=dev-key npm run dev
```

Node ≥ 22 gerekir. `npm run build` `tsc` ile `dist/` üretir; `npm start` onu çalıştırır, `npm run dev` derleyip `--watch` ile başlatır.
`npm run check` yalnızca tip denetimi, `npm run syntax` derleyip `node --check` ile sözdizimi denetimi yapar.

> Sandbox ağ erişimini engellerse `npm install` başarısız olabilir; bu depoda kurulum denenmiş ve `npm run check` (tsc) temiz geçmiştir.

### Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | SDK tarafından ortamdan okunur; **zorunlu** |
| `PORT` | `8787` | Dinlenecek port |
| `ZIRVE_GATEWAY_KEYS` | (boş) | Virgülle ayrılmış istemci anahtarları (`x-zirve-key`). Boşsa geliştirme modu: kimlik doğrulama yok, IP başına hız sınırı |
| `RATE_LIMIT_PER_MIN` | `30` | Anahtar (ya da IP) başına dakikalık istek sınırı |
| `CORS_ORIGIN` | `*` | `Access-Control-Allow-Origin` |
| `ZIRVE_AI_MODEL` | `claude-opus-5` | Model kimliği |
| `ZIRVE_AI_MAX_TOKENS` | `16000` | Yanıt üst sınırı |

## Endpoint'ler

### `GET /healthz`

```json
{ "ok": true, "model": "claude-opus-5", "auth": "key" }
```

### `POST /v1/chat` → `text/event-stream`

İstek:

```json
{
  "messages": [{ "role": "user", "content": "Kaçkar için 3 günlük plan yap" }],
  "context": { "locale": "tr", "coords": { "latitude": 41.0, "longitude": 29.0 }, "adventureTypes": ["hiking"], "plan": "free" }
}
```

Olaylar:

| event | data | Açıklama |
| --- | --- | --- |
| `delta` | `{ "text": "..." }` | Görünür metin parçası (meta bloğu süzülür) |
| `tool` | `{ "name": "search_places", "input": {...} }` | Araç çağrısı başladı |
| `notice` | `{ "code": "refusal" \| "truncated" }` | Bilgilendirme |
| `done` | `{ "content", "intent", "actions", "tools", "usage", "model" }` | Tamamlandı; `actions` uygulama içi rotalar (`/library/<id>`, `/first-aid/<slug>`, `/hazards/<id>`, `/maps/planner`, `/satellite`, `/climbing`, …) |
| `error` | `{ "code", "message" }` | Hata (`upstream_rate_limited`, `gateway_misconfigured`, `upstream_error`, …) |

Model, yanıtın sonuna `---ZIRVE-META---` işaretiyle tek satır JSON (`intent`, `actions`) ekler; gateway bu bloğu akıştan
ayıklar (`MetaSplitter`) ve `done` olayında yapılandırılmış olarak verir. İstemciye işaret hiçbir zaman sızmaz.

```bash
curl -N http://localhost:8787/v1/chat \
  -H 'content-type: application/json' -H 'x-zirve-key: dev-key' \
  -d '{"messages":[{"role":"user","content":"Yakınımda kamp alanı öner"}],"context":{"locale":"tr","coords":{"latitude":41,"longitude":29}}}'
```

### `POST /v1/plan-trip` → JSON

`output_config.format = { type: "json_schema", schema }` (structured output) ile `TripPlan` şemasında JSON döner:

```json
{ "title": "...", "adventureType": "hiking", "days": [{ "day": 1, "title": "...", "distanceKm": 12, "ascentM": 700, "notes": "..." }], "packing": ["..."], "safety": ["..."] }
```

## Model çağrısı

- `client.messages.stream(...)` + `finalMessage()` ile **manuel araç döngüsü** (`stop_reason === "tool_use"` → araçlar çalışır → tüm `tool_result` blokları **tek bir user mesajında** geri gönderilir; `pause_turn` yeniden gönderilir; en fazla 6 tur).
- `thinking: { type: "adaptive" }`, `max_tokens: 16000`.
- Sistem promptu iki blok: sabit kısım `cache_control: { type: "ephemeral" }` ile önbelleklenir; kullanıcı bağlamı (locale, konum, ilgi alanları) ayrı, önbelleksiz blokta gelir. Araç listesi sabit sıradadır (önbellek öneki bozulmaz).
- Hatalar SDK'nın tipli sınıflarıyla eşlenir (`Anthropic.RateLimitError` → 429, `AuthenticationError` → 500 `gateway_misconfigured`, `APIConnectionTimeoutError` → 504, `APIError` → üst durum kodu).
- İstemci bağlantıyı kapatırsa `AbortController` ile akış iptal edilir.

## Araçlar (`src/tools.ts`)

| Araç | Kaynak | Durum |
| --- | --- | --- |
| `search_places` | `data/places.sample.json` (kütüphane örneği) | Gerçek |
| `nearest_emergency` | `data/emergency.sample.json` | Gerçek |
| `plan_route` | — | Stub (kuş uçuşu × katsayı) |
| `weather` | — | Stub (mevsimsel tipik değerler) |

Üretimde `search_places` / `nearest_emergency` uygulama API'sine bağlanmalıdır.

## Uygulama tarafı

`src/data/ai/remoteAi.ts` içindeki `RemoteAiClient`, `EXPO_PUBLIC_AI_GATEWAY_URL` (ve isteğe bağlı `EXPO_PUBLIC_AI_GATEWAY_KEY`)
ayarlıysa mock repository'nin `send` / `planTrip` fonksiyonları tarafından kullanılır; ağ hatasında yerel (çevrimdışı) cevaba düşer.

```bash
EXPO_PUBLIC_AI_GATEWAY_URL=http://localhost:8787 EXPO_PUBLIC_AI_GATEWAY_KEY=dev-key npx expo start
```

## Güvenlik notları

- API anahtarı yalnızca bu servisin ortamında bulunur; istemciye asla verilmez.
- `x-zirve-key` anahtarları uygulama sürümüne gömülü olsa da yalnızca bu servise erişim sağlar; sızarsa döndürülür (`ZIRVE_GATEWAY_KEYS`).
- İstek gövdesi 256 KB, sohbet geçmişi 40 mesaj / 8000 karakter ile sınırlıdır.
- Modelin ürettiği `actions.href` değerleri izin verilen rota önekleriyle süzülür.
