# Sunucuda Dosya Yapısı (CubiqPort)

**Ana dizin:** `/var/www/html`  
**Sunucu:** 45.67.203.202 (root)

---

## Beklenen dizin ağacı (deploy sonrası)

```
/var/www/html/
├── .env                    # Ortam değişkenleri (DATABASE_URL, JWT_SECRET vb.)
├── package.json            # Monorepo root (npm workspaces)
├── package-lock.json
├── ecosystem.config.cjs    # PM2 config (api + web)
│
├── packages/
│   └── shared/
│       └── dist/           # Shared package build çıktısı
│
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   └── dist/           # API build (TypeScript → JS)
│   │       └── apps/
│   │           └── api/
│   │               └── src/
│   │                   ├── server.js      ← PM2 bunu çalıştırır
│   │                   ├── app.js
│   │                   ├── config/
│   │                   ├── db/
│   │                   ├── modules/
│   │                   └── ...
│   │
│   └── web/
│       ├── package.json
│       ├── .next/
│       │   ├── standalone/           # Next.js standalone build
│       │   │   └── apps/
│       │   │       └── web/
│       │   │           ├── server.js ← PM2 bunu çalıştırır (node server.js)
│       │   │           ├── .next/
│       │   │   │       └── static/
│       │   │   └── ...
│       │   └── static/                # Static assets (standalone dışı kopya)
│       └── ...
│
└── scripts/
    └── nginx-cubiqport.conf   # Nginx örnek config
```

---

## Önemli dosya yolları

| Ne | Yol |
|----|-----|
| **Ana dizin** | `/var/www/html` |
| **API giriş noktası** | `/var/www/html/apps/api/dist/apps/api/src/server.js` |
| **Web (Next) giriş noktası** | `/var/www/html/apps/web/.next/standalone/apps/web/server.js` |
| **PM2 çalışma dizini (API)** | `/var/www/html` (cwd) |
| **PM2 çalışma dizini (Web)** | `/var/www/html/apps/web` |
| **Ortam değişkenleri** | `/var/www/html/.env` |
| **Nginx config örneği** | `/var/www/html/scripts/nginx-cubiqport.conf` |

---

## PM2 (ecosystem.config.cjs)

- **cubiqport-api:** `APP_DIR/apps/api/dist/apps/api/src/server.js`, cwd: `APP_DIR`
- **cubiqport-web:** `node APP_DIR/apps/web/.next/standalone/apps/web/server.js`, cwd: `APP_DIR/apps/web`

Loglar: `/var/log/pm2/cubiqport-api-*.log`, `/var/log/pm2/cubiqport-web-*.log`

---

## Not

Şu an sunucuda `/var/www/html` altında sadece boş/az dosya var. Tam yapıyı oluşturmak için yerelde:

```bash
./deploy.sh all
```

çalıştırın; rsync ile tüm build çıktıları bu dizinlere kopyalanır.
