export type TechCategory =
  | 'container'
  | 'database'
  | 'runtime'
  | 'web'
  | 'messaging'
  | 'cache'
  | 'orchestration'
  | 'other';

export interface TechVersion {
  label: string;
  value: string;
}

export interface TechSpec {
  id: string;
  name: string;
  description: string;
  category: TechCategory;
  icon: string;
  versions?: TechVersion[];
  defaultVersion?: string;
  /** Shell komutu — kurulu sürümü stdout'a yazar, değilse boş */
  detectCmd: string;
  /** systemctl servis adları */
  serviceNames?: string[];
  /** Kurulum/güncelleme shell script'i */
  installScript: (version?: string) => string;
}

export const TECH_CATALOG: TechSpec[] = [
  // ─── Container ────────────────────────────────────────────────────────────────
  {
    id: 'docker',
    name: 'Docker',
    description: 'Container platformu ve runtime',
    category: 'container',
    icon: '🐳',
    detectCmd: `docker --version 2>/dev/null | awk '{print $3}' | tr -d ',' | head -1 || /usr/bin/docker --version 2>/dev/null | awk '{print $3}' | tr -d ',' | head -1 || echo ""`,
    serviceNames: ['docker'],
    installScript: () => `
set -e
export DEBIAN_FRONTEND=noninteractive
echo "→ Docker CE kuruluyor..."
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg lsb-release
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
echo ""
echo "✓ Docker başarıyla kuruldu!"
docker --version
docker compose version
`,
  },

  // ─── Runtime ──────────────────────────────────────────────────────────────────
  {
    id: 'nodejs',
    name: 'Node.js',
    description: 'JavaScript/TypeScript sunucu runtime (NVM ile)',
    category: 'runtime',
    icon: '🟩',
    versions: [
      { label: '22 (Güncel)', value: '22' },
      { label: '20 LTS (Önerilen)', value: '20' },
      { label: '18 LTS', value: '18' },
      { label: '16 LTS (EOL)', value: '16' },
    ],
    defaultVersion: '20',
    detectCmd: `node --version 2>/dev/null | tr -d 'v' | head -1 || (export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && node --version 2>/dev/null | tr -d 'v' | head -1) || echo ""`,
    installScript: (version = '20') => `
set -e
export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "→ NVM kuruluyor..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
fi
. "$NVM_DIR/nvm.sh"
echo "→ Node.js v${version} LTS kuruluyor..."
nvm install ${version}
nvm use ${version}
nvm alias default ${version}
NODE_BIN="$(nvm which ${version})"
ln -sf "$NODE_BIN" /usr/local/bin/node 2>/dev/null || true
ln -sf "$(dirname $NODE_BIN)/npm" /usr/local/bin/npm 2>/dev/null || true
ln -sf "$(dirname $NODE_BIN)/npx" /usr/local/bin/npx 2>/dev/null || true
echo ""
echo "✓ Node.js kuruldu!"
node --version
npm --version
`,
  },
  {
    id: 'php',
    name: 'PHP',
    description: 'Sunucu taraflı betik dili (ondrej/php PPA)',
    category: 'runtime',
    icon: '🐘',
    versions: [
      { label: '8.3 (Güncel)', value: '8.3' },
      { label: '8.2 LTS', value: '8.2' },
      { label: '8.1', value: '8.1' },
      { label: '8.0', value: '8.0' },
      { label: '7.4', value: '7.4' },
    ],
    defaultVersion: '8.3',
    detectCmd: `php -r 'echo PHP_VERSION;' 2>/dev/null || php --version 2>/dev/null | awk '/^PHP/{print $2}' | head -1 || echo ""`,
    serviceNames: ['php8.3-fpm', 'php8.2-fpm', 'php8.1-fpm', 'php8.0-fpm', 'php7.4-fpm'],
    installScript: (version = '8.3') => `
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get install -y -qq software-properties-common
LC_ALL=C.UTF-8 add-apt-repository -y ppa:ondrej/php
apt-get update -qq
apt-get install -y -qq \\
  php${version} \\
  php${version}-cli \\
  php${version}-fpm \\
  php${version}-common \\
  php${version}-mysql \\
  php${version}-pgsql \\
  php${version}-redis \\
  php${version}-mbstring \\
  php${version}-xml \\
  php${version}-curl \\
  php${version}-zip \\
  php${version}-bcmath \\
  php${version}-intl \\
  php${version}-gd \\
  php${version}-imagick 2>/dev/null || true
update-alternatives --set php /usr/bin/php${version} 2>/dev/null || true
systemctl enable --now php${version}-fpm 2>/dev/null || true
echo ""
echo "✓ PHP ${version} kuruldu!"
php --version
`,
  },
  {
    id: 'python',
    name: 'Python 3',
    description: 'Çok amaçlı programlama dili + pip',
    category: 'runtime',
    icon: '🐍',
    versions: [
      { label: '3.12 (Güncel)', value: '3.12' },
      { label: '3.11', value: '3.11' },
      { label: '3.10', value: '3.10' },
    ],
    defaultVersion: '3.12',
    detectCmd: `python3 --version 2>/dev/null | awk '{print $2}' | head -1 || echo ""`,
    installScript: (version = '3.12') => `
set -e
export DEBIAN_FRONTEND=noninteractive
add-apt-repository -y ppa:deadsnakes/ppa 2>/dev/null || true
apt-get update -qq
apt-get install -y -qq python${version} python${version}-pip python${version}-venv python${version}-dev
update-alternatives --install /usr/bin/python3 python3 /usr/bin/python${version} 1 2>/dev/null || true
curl -sS https://bootstrap.pypa.io/get-pip.py | python${version} 2>/dev/null || true
echo ""
echo "✓ Python kuruldu!"
python3 --version
pip3 --version 2>/dev/null || true
`,
  },

  // ─── Database ─────────────────────────────────────────────────────────────────
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    description: 'Gelişmiş açık kaynak ilişkisel veritabanı',
    category: 'database',
    icon: '🐘',
    versions: [
      { label: '16 (Güncel)', value: '16' },
      { label: '15', value: '15' },
      { label: '14 LTS', value: '14' },
      { label: '13', value: '13' },
    ],
    defaultVersion: '16',
    detectCmd: `psql --version 2>/dev/null | awk '{print $NF}' | head -1 || echo ""`,
    serviceNames: ['postgresql'],
    installScript: (version = '16') => `
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get install -y -qq curl ca-certificates
install -d /usr/share/postgresql-common/pgdg
curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
apt-get update -qq
apt-get install -y -qq postgresql-${version} postgresql-client-${version}
systemctl enable --now postgresql
echo ""
echo "✓ PostgreSQL ${version} kuruldu!"
psql --version
systemctl is-active postgresql
`,
  },
  {
    id: 'mysql',
    name: 'MySQL',
    description: 'En yaygın açık kaynak ilişkisel veritabanı',
    category: 'database',
    icon: '🐬',
    detectCmd: `mysql --version 2>/dev/null | awk '{print $3}' | tr -d ',' | head -1 || echo ""`,
    serviceNames: ['mysql'],
    installScript: () => `
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
debconf-set-selections <<< 'mysql-server mysql-server/root_password password root'
debconf-set-selections <<< 'mysql-server mysql-server/root_password_again password root'
apt-get install -y -qq mysql-server
systemctl enable --now mysql
echo ""
echo "✓ MySQL kuruldu! (root şifresi: root)"
mysql --version
systemctl is-active mysql
`,
  },
  {
    id: 'mariadb',
    name: 'MariaDB',
    description: 'MySQL uyumlu topluluk veritabanı',
    category: 'database',
    icon: '🦭',
    detectCmd: `mariadb --version 2>/dev/null | awk '{print $5}' | tr -d ',' | head -1 || mariadbd --version 2>/dev/null | awk '{print $5}' | head -1 || echo ""`,
    serviceNames: ['mariadb'],
    installScript: () => `
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq mariadb-server mariadb-client
systemctl enable --now mariadb
echo ""
echo "✓ MariaDB kuruldu!"
mariadb --version
systemctl is-active mariadb
`,
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    description: 'Belge tabanlı NoSQL veritabanı',
    category: 'database',
    icon: '🍃',
    detectCmd: `mongod --version 2>/dev/null | awk '/db version/{print $3}' | tr -d 'v' | head -1 || echo ""`,
    serviceNames: ['mongod'],
    installScript: () => `
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get install -y -qq gnupg curl
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update -qq
apt-get install -y -qq mongodb-org
systemctl enable --now mongod
echo ""
echo "✓ MongoDB kuruldu!"
mongod --version
systemctl is-active mongod
`,
  },

  // ─── Cache ────────────────────────────────────────────────────────────────────
  {
    id: 'redis',
    name: 'Redis',
    description: 'Yüksek performanslı bellek içi veri deposu',
    category: 'cache',
    icon: '🔴',
    detectCmd: `redis-server --version 2>/dev/null | awk '{print $3}' | cut -d= -f2 | head -1 || echo ""`,
    serviceNames: ['redis-server', 'redis'],
    installScript: () => `
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq redis-server
sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf 2>/dev/null || true
systemctl enable --now redis-server
echo ""
echo "✓ Redis kuruldu!"
redis-server --version
redis-cli ping
`,
  },

  // ─── Messaging ────────────────────────────────────────────────────────────────
  {
    id: 'rabbitmq',
    name: 'RabbitMQ',
    description: 'Kurumsal mesaj kuyruğu sistemi',
    category: 'messaging',
    icon: '🐰',
    detectCmd: `rabbitmqctl version 2>/dev/null | awk '{print $1}' | head -1 || rabbitmq-diagnostics -q server_version 2>/dev/null | head -1 || echo ""`,
    serviceNames: ['rabbitmq-server'],
    installScript: () => `
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get install -y -qq curl gnupg apt-transport-https
curl -1sLf "https://keys.openpgp.org/vks/v1/by-fingerprint/0A9AF2115F4687BD29803A206B73A36E6026DFCA" | gpg --dearmor | tee /usr/share/keyrings/com.rabbitmq.team.gpg > /dev/null
curl -1sLf "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0xf77f1eda57ebb1cc" | gpg --dearmor | tee /usr/share/keyrings/net.launchpad.ppa.rabbitmq.erlang.gpg > /dev/null
curl -1sLf "https://packagecloud.io/rabbitmq/rabbitmq-server/gpgkey" | gpg --dearmor | tee /usr/share/keyrings/io.packagecloud.rabbitmq.gpg > /dev/null
tee /etc/apt/sources.list.d/rabbitmq.list << 'SOURCES'
deb [signed-by=/usr/share/keyrings/net.launchpad.ppa.rabbitmq.erlang.gpg] http://ppa.launchpad.net/rabbitmq/rabbitmq-erlang/ubuntu noble main
deb-src [signed-by=/usr/share/keyrings/net.launchpad.ppa.rabbitmq.erlang.gpg] http://ppa.launchpad.net/rabbitmq/rabbitmq-erlang/ubuntu noble main
deb [signed-by=/usr/share/keyrings/io.packagecloud.rabbitmq.gpg] https://packagecloud.io/rabbitmq/rabbitmq-server/ubuntu/ noble main
deb-src [signed-by=/usr/share/keyrings/io.packagecloud.rabbitmq.gpg] https://packagecloud.io/rabbitmq/rabbitmq-server/ubuntu/ noble main
SOURCES
apt-get update -qq
apt-get install -y -qq rabbitmq-server
systemctl enable --now rabbitmq-server
rabbitmq-plugins enable rabbitmq_management
echo ""
echo "✓ RabbitMQ kuruldu! (Management UI: http://localhost:15672)"
rabbitmqctl version
`,
  },

  // ─── Web ──────────────────────────────────────────────────────────────────────
  {
    id: 'nginx',
    name: 'Nginx',
    description: 'Yüksek performanslı web & reverse proxy sunucusu',
    category: 'web',
    icon: '🌿',
    detectCmd: `nginx -v 2>&1 | awk -F/ '{print $2}' | awk '{print $1}' | head -1 || echo ""`,
    serviceNames: ['nginx'],
    installScript: () => `
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx
systemctl enable --now nginx
echo ""
echo "✓ Nginx kuruldu!"
nginx -v
systemctl is-active nginx
`,
  },
  {
    id: 'apache',
    name: 'Apache2',
    description: 'Dünya\'nın en yaygın web sunucusu',
    category: 'web',
    icon: '🪶',
    detectCmd: `apache2 -v 2>/dev/null | awk -F/ '/Server version/{print $2}' | awk '{print $1}' | head -1 || apachectl -v 2>/dev/null | awk -F/ '/Server version/{print $2}' | awk '{print $1}' | head -1 || echo ""`,
    serviceNames: ['apache2'],
    installScript: () => `
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq apache2
a2enmod rewrite ssl headers proxy proxy_http 2>/dev/null || true
systemctl enable --now apache2
echo ""
echo "✓ Apache2 kuruldu!"
apache2 -v
systemctl is-active apache2
`,
  },

  // ─── Orchestration ────────────────────────────────────────────────────────────
  {
    id: 'k3s',
    name: 'Kubernetes (k3s)',
    description: 'Hafif üretim Kubernetes dağıtımı',
    category: 'orchestration',
    icon: '☸️',
    detectCmd: `k3s --version 2>/dev/null | awk '/k3s/{print $3}' | tr -d 'v' | head -1 || kubectl version --client -o yaml 2>/dev/null | awk '/gitVersion:/{print $2}' | tr -d 'v"' | head -1 || echo ""`,
    serviceNames: ['k3s'],
    installScript: () => `
set -e
echo "→ k3s Kubernetes kuruluyor..."
curl -sfL https://get.k3s.io | sh -
systemctl enable --now k3s
echo ""
echo "✓ k3s kuruldu!"
k3s --version
k3s kubectl get nodes
`,
  },

  // ─── Other ────────────────────────────────────────────────────────────────────
  {
    id: 'git',
    name: 'Git',
    description: 'Dağıtık versiyon kontrol sistemi',
    category: 'other',
    icon: '📦',
    detectCmd: `git --version 2>/dev/null | awk '{print $3}' | head -1 || echo ""`,
    installScript: () => `
set -e
export DEBIAN_FRONTEND=noninteractive
add-apt-repository -y ppa:git-core/ppa 2>/dev/null || true
apt-get update -qq
apt-get install -y -qq git
echo ""
echo "✓ Git kuruldu!"
git --version
`,
  },
  {
    id: 'pm2',
    name: 'PM2',
    description: 'Node.js process manager (auto-restart, log)',
    category: 'other',
    icon: '⚡',
    detectCmd: `pm2 --version 2>/dev/null | head -1 || (export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && pm2 --version 2>/dev/null | head -1) || echo ""`,
    installScript: () => `
set -e
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
npm install -g pm2 2>/dev/null || (apt-get install -y -qq nodejs npm && npm install -g pm2)
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash 2>/dev/null || true
ln -sf "$(which pm2 2>/dev/null || echo /usr/local/bin/pm2)" /usr/local/bin/pm2 2>/dev/null || true
echo ""
echo "✓ PM2 kuruldu!"
pm2 --version
`,
  },
  {
    id: 'composer',
    name: 'Composer',
    description: 'PHP bağımlılık ve paket yöneticisi',
    category: 'other',
    icon: '🎼',
    detectCmd: `composer --version 2>/dev/null | awk '/Composer version/{print $3}' | head -1 || echo ""`,
    installScript: () => `
set -e
php -r "copy('https://getcomposer.org/installer', '/tmp/composer-setup.php');"
php /tmp/composer-setup.php --install-dir=/usr/local/bin --filename=composer
rm /tmp/composer-setup.php
echo ""
echo "✓ Composer kuruldu!"
composer --version
`,
  },
  {
    id: 'certbot',
    name: 'Certbot (Let\'s Encrypt)',
    description: 'Ücretsiz SSL sertifika yöneticisi',
    category: 'other',
    icon: '🔒',
    detectCmd: `certbot --version 2>/dev/null | awk '{print $2}' | head -1 || echo ""`,
    installScript: () => `
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq certbot python3-certbot-nginx python3-certbot-apache 2>/dev/null || apt-get install -y -qq certbot
echo ""
echo "✓ Certbot kuruldu!"
certbot --version
`,
  },
  {
    id: 'elasticsearch',
    name: 'Elasticsearch',
    description: 'Dağıtık arama ve analitik motoru',
    category: 'database',
    icon: '🔍',
    detectCmd: `curl -s http://localhost:9200 2>/dev/null | awk -F'"' '/"number"/{print $4}' | head -1 || elasticsearch --version 2>/dev/null | awk '{print $2}' | head -1 || echo ""`,
    serviceNames: ['elasticsearch'],
    installScript: () => `
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get install -y -qq curl gnupg apt-transport-https
curl -fsSL https://artifacts.elastic.co/GPG-KEY-elasticsearch | gpg --dearmor -o /usr/share/keyrings/elasticsearch-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/elasticsearch-keyring.gpg] https://artifacts.elastic.co/packages/8.x/apt stable main" | tee /etc/apt/sources.list.d/elastic-8.x.list
apt-get update -qq
apt-get install -y -qq elasticsearch
systemctl enable --now elasticsearch
echo ""
echo "✓ Elasticsearch kuruldu! (Port: 9200)"
curl -s http://localhost:9200 | head -5 2>/dev/null || echo "Başlıyor, lütfen bekleyin..."
`,
  },
];
