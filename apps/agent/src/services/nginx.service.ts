import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const SITES_AVAILABLE = '/etc/nginx/sites-available';
const SITES_ENABLED = '/etc/nginx/sites-enabled';

export interface NginxConfig {
  domain: string;
  port: number;
  rootPath: string;
  sslEnabled?: boolean;
}

function renderTemplate(cfg: NginxConfig): string {
  const serverNames = `${cfg.domain} www.${cfg.domain}`;

  const sslBlock = cfg.sslEnabled
    ? `
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    ssl_certificate     /etc/letsencrypt/live/${cfg.domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${cfg.domain}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;
`
    : '';

  const redirectBlock = cfg.sslEnabled
    ? `
server {
    listen 80;
    listen [::]:80;
    server_name ${serverNames};
    return 301 https://$host$request_uri;
}
`
    : '';

  return `${redirectBlock}
server {
    ${cfg.sslEnabled ? '' : 'listen 80;\n    listen [::]:80;'}
    ${sslBlock}
    server_name ${serverNames};

    root ${cfg.rootPath};
    index index.html;

    access_log /var/log/nginx/${cfg.domain}.access.log;
    error_log  /var/log/nginx/${cfg.domain}.error.log;

    # Security headers
    add_header X-Frame-Options        "SAMEORIGIN"    always;
    add_header X-Content-Type-Options "nosniff"       always;
    add_header X-XSS-Protection       "1; mode=block" always;

    location / {
        proxy_pass         http://127.0.0.1:${cfg.port};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
}
`;
}

export function createNginxConfig(cfg: NginxConfig): string {
  if (!existsSync(SITES_AVAILABLE)) {
    mkdirSync(SITES_AVAILABLE, { recursive: true });
  }

  const configPath = join(SITES_AVAILABLE, `${cfg.domain}.conf`);
  writeFileSync(configPath, renderTemplate(cfg), 'utf8');

  // Enable site via symlink
  const enabledPath = join(SITES_ENABLED, `${cfg.domain}.conf`);
  try {
    execSync(`ln -sf ${configPath} ${enabledPath}`);
  } catch {
    // Symlink may already exist
  }

  // Test config syntax
  execSync('nginx -t', { stdio: 'pipe' });

  // Reload nginx
  execSync('systemctl reload nginx || nginx -s reload', { stdio: 'pipe' });

  return configPath;
}

export function removeNginxConfig(domain: string): void {
  try {
    execSync(`rm -f ${join(SITES_ENABLED, `${domain}.conf`)}`, { stdio: 'pipe' });
    execSync(`rm -f ${join(SITES_AVAILABLE, `${domain}.conf`)}`, { stdio: 'pipe' });
    execSync('systemctl reload nginx || nginx -s reload', { stdio: 'pipe' });
  } catch {
    // Best effort
  }
}
