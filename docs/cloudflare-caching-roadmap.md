# Cloudflare Caching Yol Haritası (Redis Yerine)

Bu dokümanda, Redis kaldırıldıktan sonra önbellekleme için Cloudflare (ve isteğe bağlı API içi bellek önbelleği) nasıl kullanılır, adım adım anlatılmaktadır.

---

## 1. Durum Özeti

| Önce (Redis) | Şimdi | Cloudflare ile? |
|--------------|--------|------------------|
| Canlı metrik önbelleği (serverId bazlı) | Her istek agent/SSH’a gidiyor | Sınırlı (aşağıda) |
| Analiz kuyruğu (BullMQ) | API’de inline çalışıyor | Gerek yok |

**Önemli:** Canlı metrik endpoint’i JWT ile korunuyor: `GET /api/v1/monitoring/servers/:serverId/live`. Yanıt, sadece o sunucuya erişimi olan kullanıcı için geçerli. URL’de kullanıcı bilgisi yok; sadece URL’e göre önbellek yapılırsa bir kullanıcının yanıtı diğerine servis edilir veya yetkisiz kullanıcı önbellekten veri alabilir. Bu yüzden **Cloudflare’da sadece URL’e göre cache** bu endpoint için güvenli değildir.

---

## 2. Seçenekler

### A) Önerilen: API içi kısa TTL önbellek (Redis/Cloudflare’a gerek yok)

**Ne işe yarar:** Canlı metrik isteklerini sunucu bazlı (serverId) kısa süre (örn. 30 sn) bellekte tutarsınız; aynı sunucu için tekrarlayan istekler agent/SSH’a gitmez.

**Artıları:** Basit, ek servis yok, mevcut JWT akışı değişmez, güvenli.  
**Eksileri:** Önbellek sadece o API instance’ında; birden fazla API replikası varsa her biri kendi önbelleğini tutar (genelde kabul edilebilir).

**Yol haritası:**

1. **In-memory cache modülü ekleyin**  
   Örnek: `apps/api/src/cache/memory-cache.ts`  
   - `get<T>(key: string): T | null`  
   - `set<T>(key: string, value: T, ttlSeconds: number): void`  
   - Key: `metrics:live:{serverId}`, TTL: 30–60 sn (shared’daki `METRICS_TTL_SECONDS` ile uyumlu).

2. **Monitoring service’i güncelleyin**  
   - `monitoring.service.ts` içinde `getJson`/`setJson` (redis no-op) yerine bu memory cache’i kullanın.  
   - Böylece ilk istek agent/SSH’a gider, sonraki 30 sn içindeki istekler bellekten döner.

3. **Test**  
   - Aynı serverId için arka arkaya 2 istek atın; ikincisinde agent/SSH’a gidilmediğini (log veya mock ile) doğrulayın.

Bu adımlar tamamlandığında “Redis yerine” metrik önbelleği için ek bir şey (Cloudflare veya Redis) gerekmez.

---

### B) Cloudflare ile önbellek (sadece güvenli senaryolar)

Cloudflare, **istek URL’ine (ve seçilen header’lara)** göre önbellek yapar. Bu yüzden:

- **Kimlik doğrulama gerektirmeyen, herkese aynı yanıt veren endpoint’ler** → Cloudflare cache ile uyumludur.
- **JWT ile korunan, kullanıcıya özel veya yetkiye bağlı yanıtlar** → URL tek başına yeterli değildir; bu endpoint’leri “URL’e göre” cache’lemek güvenlik riski oluşturur.

#### B1) Hangi endpoint’ler Cloudflare’da güvenle cache’lenebilir?

- **Next.js static (/_next/static, /images vb.):** Zaten Cloudflare’da cache’lenebilir; Cache Rules veya Page Rules ile TTL verin.
- **Public API:** Örn. `GET /health`, `GET /api/status` gibi JWT gerektirmeyen, herkese aynı yanıt dönen route’lar.  
  - Bu tür route’larda API’den `Cache-Control: public, max-age=60` gibi header gönderin; Cloudflare bu yanıtları cache’ler.
- **Canlı metrik (/api/v1/monitoring/servers/:serverId/live):**  
  - **Standart Cache Rules (sadece URL):** Güvenli değil; kullanmayın.  
  - **İleri seviye:** Cloudflare Worker ile Cache API kullanıp cache key’i `serverId + hash(Authorization)` gibi türetirseniz teorik olarak “kullanıcı bazlı” cache mümkün, ancak karmaşıklık ve bakım maliyeti yüksektir. Pratikte **A seçeneği (API içi önbellek)** daha mantıklıdır.

#### B2) Cloudflare tarafında yapılacaklar (public içerik için)

1. **Dashboard:** Cloudflare → Zone → Caching → Cache Rules (veya Page Rules).
2. **Kural örnekleri:**  
   - URL contains `/_next/static` → Cache eligibility: Eligible for cache, TTL: 1 gün (veya Edge TTL).  
   - URL equals `https://yourdomain.com/api/health` → TTL: 1 dakika.
3. **API’den Cache-Control:** Cache’lenmesini istediğiniz public endpoint’lerde yanıta örn. `Cache-Control: public, max-age=60` ekleyin; Cloudflare bu yanıtları cache’ler.

Özet: **Cloudflare caching’i public ve statik içerik + public API için kullanın; JWT’li canlı metrik için kullanmayın.**

---

### C) Hibrit (önerilen pratik set)

1. **Canlı metrik:** A seçeneği (API içi memory cache) — güvenli, basit, Redis/Cloudflare’a gerek yok.  
2. **Static ve public API:** B seçeneği (Cloudflare Cache Rules + Cache-Control header).  
3. **Analiz işleri:** Zaten API’de inline; ek önbellek gerekmez.

Bu kombinasyon, “Redis yerine Cloudflare caching kullanabilir miyiz?” sorusuna pratik cevaptır:  
- **Metrik önbelleği:** Cloudflare ile güvenli yapılamaz (JWT); API içi cache kullanın.  
- **Diğer trafik:** Cloudflare caching kullanılabilir ve kullanılmalıdır.

---

## 3. Kısa Uygulama Sırası

| Öncelik | Ne yapılacak | Nerede |
|--------|----------------|--------|
| 1 | Bellek önbellek modülü (get/set, TTL) | `apps/api/src/cache/memory-cache.ts` |
| 2 | Monitoring service’te redis yerine memory cache | `monitoring.service.ts` |
| 3 | Public/health endpoint’e Cache-Control ekle (isteğe bağlı) | İlgili route/controller |
| 4 | Cloudflare’da Cache Rules (static + public API) | Dashboard |

İsterseniz bir sonraki adımda sadece 1 ve 2’yi (memory cache + monitoring’e bağlama) kod seviyesinde uygulayacak patch’i çıkarabilirim; Cloudflare tarafı dokümantasyonla kalabilir.
