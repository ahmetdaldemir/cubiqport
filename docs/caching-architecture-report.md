# CubiqPort — Production Caching Architecture Raporu

Bu rapor, “Redis + Cloudflare production-grade caching” prompt’unun **CubiqPort projesine** uyarlanabilirliğini değerlendirir. Uygulamaya geçmeden önce neyin yapılabileceği, neyin atlanması veya farklı yapılması gerektiği netleştirilmiştir.

---

## 1. Prompt Özeti

- **Mimari:** Client → Cloudflare (Edge + CDN) → Nginx → Node.js API → Redis → Database  
- **Hedefler:** Redis ile API response cache, GET cache middleware, TTL (örn. 300s), cache miss’te controller → Redis’e yaz → dön, Redis hata verirse API kırılmasın.  
- **Cloudflare:** Public endpoint’lerde `Cache-Control: public, max-age=120`; user-specific cache’lenmesin.  
- **Redis kullanım alanları:** API response cache, rate limiting, session storage, job queue.  
- **Teknik:** ES modules, async/await, popüler Redis client, reusable middleware, POST/PUT/DELETE’te invalidation, örnek route’lar.

---

## 2. CubiqPort ile Karşılaştırma

| Prompt varsayımı | CubiqPort gerçeği |
|------------------|-------------------|
| Express | **Fastify** (Express yok) |
| Redis backend cache | **Redis projeden kaldırıldı** (Cloudflare + tek sunucu; Redis aynı makinede mantıklı bulunmadı) |
| Node.js API → Redis → DB | Şu an: **API → PostgreSQL** (Redis yok) |
| Job queue (Redis) | Analiz işleri **API içinde inline** çalışıyor |
| Rate limiting | **@fastify/rate-limit** zaten var (in-memory, 200/dk) |
| Session storage | **JWT** kullanılıyor; sunucu tarafı session yok |
| Cache middleware | Yok; bazı route’larda `Cache-Control: no-cache` var (maintenance, tech) |

**Sonuç:** Prompt’taki “Redis + Cloudflare” mimarisi, CubiqPort’un **bilinçli olarak Redis’siz** ve **Cloudflare edge + isteğe bağlı API içi cache** tercihiyle kısmen çakışıyor. Aynı **hedefleri** (cache, fail-safe, Cloudflare header’lar, rate limit, invalidation) projeye uygun araçlarla karşılayabiliriz.

---

## 3. Prompt Maddelerine Göre Uyarlanabilirlik

### 3.1 Mimari: Client → Cloudflare → Nginx → Node.js → Redis → DB

| Durum | Açıklama |
|-------|----------|
| **Kısmen uygula** | Akış zaten: Client → Cloudflare → Nginx → **Fastify API** → **PostgreSQL**. Redis’i tekrar eklemek proje kararına aykırı; bunun yerine **Cloudflare (edge) + API tarafında isteğe bağlı cache** (bellek veya ileride opsiyonel Redis) kullanılabilir. |

### 3.2 Redis as backend cache for API responses

| Durum | Açıklama |
|-------|----------|
| **Alternatif** | Redis **zorunlu** değil. Seçenekler: **(A)** Sadece **in-memory cache** (TTL’li, GET için middleware) — fail-safe: cache yoksa/hatada doğrudan controller. **(B)** İleride Redis’i **opsiyonel** yapıp `REDIS_URL` varsa Redis, yoksa in-memory kullanılabilir (proje daha önce buna benzer bir yapıdaydı). |

### 3.3 Cache middleware for GET requests

| Durum | Açıklama |
|-------|----------|
| **Uygulanabilir** | **Fastify hook/middleware** ile: GET isteklerinde cache key (örn. `method + url + query`) ile cache’e bak; varsa dön, yoksa `reply.send()`’i wrap edip yanıtı cache’e yaz. Katman kuralına uyum: middleware sadece cache okur/yazar; iş mantığı controller/service’te kalır. |

### 3.4 TTL (default 300s), cache hit/miss, fail-safe

| Durum | Açıklama |
|-------|----------|
| **Uygulanabilir** | TTL config’den (örn. 300); hit → cache’den dön; miss → handler çalışsın, yanıt cache’e yazılsın. Redis/cache hata verirse **try/catch ile atla**, response’u normal yolla dön (fail-safe). |

### 3.5 Cloudflare: Cache-Control: public, max-age=120; user-specific cache’leme

| Durum | Açıklama |
|-------|----------|
| **Uygulanabilir** | **Sadece public endpoint’lerde** (örn. `GET /health`): `reply.header('Cache-Control', 'public, max-age=120')`. JWT gerektiren route’larda `Cache-Control: no-store` veya `private, no-cache` (zaten bazı route’larda no-cache var). Dokümantasyon: `docs/cloudflare-caching-roadmap.md` ile uyumlu. |

### 3.6 Redis use cases: API cache, rate limiting, session, job queue

| Use case | CubiqPort’ta durum | Öneri |
|----------|--------------------|--------|
| **API response caching** | Yok | GET cache middleware + in-memory (veya opsiyonel Redis) — **uygulanabilir**. |
| **Rate limiting** | Var (@fastify/rate-limit, in-memory) | Mevcut hali yeterli. Redis tabanlı rate limit **opsiyonel** (çok instance’da paylaşım gerekirse eklenebilir). |
| **Session storage** | JWT kullanılıyor | Session store **gerekmez**; prompt’taki “session storage” atlanır. |
| **Job queue** | Inline analiz | Kuyruk **gerekmez**; prompt’taki “job queue” atlanır. |

### 3.7 Cache invalidation on POST/PUT/DELETE

| Durum | Açıklama |
|-------|----------|
| **Uygulanabilir** | Aynı resource’a ait cache key’leri pattern ile (örn. `GET /api/v1/servers/:id` → key prefix `servers:${id}`). POST/PUT/DELETE’te ilgili prefix’i invalidate eden **yardımcı** (in-memory’de key silme; Redis’te DEL veya pattern delete). Middleware veya route hook’tan çağrılabilir. |

### 3.8 Modern Node, Redis client, reusable middleware, example routes

| Durum | Açıklama |
|-------|----------|
| **Uygulanabilir (Fastify’a uyarlı)** | ES modules + async/await zaten kullanılıyor. Redis **opsiyonel** ise: client sadece `REDIS_URL` varken bağlansın; yoksa in-memory store kullanılsın. **Reusable:** Fastify plugin veya `preHandler`/`onSend` hook ile cache middleware. **Örnek route’lar:** Express yerine **Fastify route örnekleri** (örn. `GET /api/v1/servers` cache’li, `POST /api/v1/servers` sonrası invalidation). |

---

## 4. Bu Projede Yapılabilecekler (Öncelikli)

Aşağıdakiler **tamamen CubiqPort’a uyumlu**, mevcut mimari ve “Redis’siz / opsiyonel cache” kararıyla uyumlu.

1. **Cache altyapısı (fail-safe)**  
   - **In-memory cache modülü:** TTL’li get/set, key prefix (örn. `api:get:...`).  
   - **Opsiyonel:** `REDIS_URL` tanımlıysa Redis client (ioredis veya node-redis) kullan; yoksa veya hata durumunda in-memory’e düş. API hiçbir koşulda cache’e bağımlı olmasın (try/catch, cache fail = normal handler).

2. **GET cache middleware (Fastify)**  
   - Sadece GET için: cache key = method + normalized URL + query.  
   - Hit → cached body + uygun header ile cevap ver.  
   - Miss → handler çalışsın; `onSend` (veya benzeri) ile yanıtı cache’e yaz (TTL default 300).  
   - Route bazında opt-in (sadece cache’lenmesi güvenli route’larda kullanılır).

3. **Cache invalidation stratejisi**  
   - Resource bazlı prefix (örn. `servers`, `domains`).  
   - POST/PUT/DELETE handler’larından (veya merkezi hook’tan) ilgili prefix’e ait key’leri temizleyen fonksiyon.  
   - In-memory: key’leri prefix’e göre sil; Redis varsa DEL/SCAN ile pattern delete.

4. **Cloudflare cache header’ları**  
   - Public endpoint’ler (örn. `GET /health`): `Cache-Control: public, max-age=120`.  
   - Auth gerektiren route’larda: `Cache-Control: private, no-store` (veya mevcut no-cache).  
   - Bunu bir **reply hook** veya route bazında header set ile yapmak; dokümantasyonda hangi route’un public olduğunu belirtmek.

5. **Rate limiting**  
   - **Mevcut @fastify/rate-limit** korunur.  
   - İleride çok instance gerekiyorsa: Redis store’lu rate limit **opsiyonel** eklenebilir; şu an zorunlu değil.

6. **Örnek route’lar (Fastify)**  
   - 1–2 GET route’unda cache middleware kullanımı (örn. public bir “list” veya “health”).  
   - 1 POST/PUT/DELETE örneği ile invalidation çağrısı.  
   - Express yerine **Fastify route + schema** örnekleri.

7. **Scaling / best practices (dokümantasyon)**  
   - Tek instance: in-memory yeterli.  
   - Çok instance + paylaşılan cache istersen: Redis opsiyonel; cache key naming, TTL ve invalidation pattern’leri dokümante edilsin.

---

## 5. Yapılmayacaklar / Farklı Yapılacaklar

| Prompt maddesi | Neden / Nasıl |
|----------------|----------------|
| **Express routes** | Proje Fastify kullanıyor; çıktı **Fastify route + hook** olmalı. |
| **Redis’i zorunlu backend cache** | Redis projeden kaldırıldı; **opsiyonel** veya sadece **in-memory** ile uygulanmalı. |
| **Session storage (Redis)** | Auth JWT; session store eklenmez. |
| **Job queue (Redis)** | Analiz işleri inline; kuyruk eklenmez. |
| **Tüm GET’leri cache’lemek** | Sadece **güvenli ve public veya cache’lenebilir** route’larda (public + aynı yanıtı dönen) kullanılmalı; JWT’li user-specific route’larda cache key’e Authorization dahil edilmedikçe edge/URL cache güvenli değil (zaten roadmap’te açıklandı). |

---

## 6. Önerilen Çıktı Yapısı (Prompt’a Paralel, CubiqPort’a Uygun)

Uygulama yapılırken aşağıdaki yapı projeye uyumlu olur:

1. **Cache client / store**  
   - `apps/api/src/cache/` altında: in-memory store (TTL’li map).  
   - Opsiyonel: `REDIS_URL` varsa Redis client wrapper (fail-safe: hata = in-memory veya bypass).

2. **Cache middleware (Fastify)**  
   - GET için cache lookup + onSend’te cache set; config’den TTL (default 300).  
   - Sadece opt-in route’larda kullanım.

3. **Örnek Fastify route’lar**  
   - Cache’li GET örneği (örn. public health veya list).  
   - Invalidation örneği (bir POST/PUT/DELETE’te prefix invalidation).

4. **Invalidation stratejisi**  
   - Prefix bazlı silme; hangi resource’un hangi prefix’i kullandığı kısa dokümantasyon veya kod içi not.

5. **Cloudflare cache header entegrasyonu**  
   - Public route’larda `Cache-Control: public, max-age=120`.  
   - Auth’lı route’larda `private, no-store` (veya mevcut no-cache).

6. **Rate limiting**  
   - Mevcut @fastify/rate-limit korunur; istenirse Redis store’lu sürüm **opsiyonel** ve ayrı bir adım olarak eklenir.

7. **Ölçekleme ve best practices**  
   - Kısa bir “Caching” bölümü: tek instance vs çok instance, cache key naming, TTL seçimi, invalidation; `docs/` veya `.cursor/rules`’a eklenebilir.

---

## 7. Kısa Özet

- **Tamamen uyumlu:** GET cache middleware (fail-safe), TTL’li cache (in-memory veya opsiyonel Redis), cache invalidation, Cloudflare cache header’ları, Fastify örnek route’lar, mevcut rate limiting.  
- **Atlanacak:** Express, zorunlu Redis, session storage, job queue.  
- **Opsiyonel:** Redis’i sadece “paylaşılan cache / rate limit” ihtiyacı olursa geri eklemek; varsayılan davranış Redis’siz ve fail-safe olmalı.

Bu rapor, prompt’taki isteklerin CubiqPort’a **uyarlanmış** ve uygulanabilir alt kümesini tanımlar; uygulama adımları bu çerçeveye göre yapılabilir.
