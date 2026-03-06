const APP_DIR = '/var/www/port8083/html';

module.exports = {
  apps: [
    {
      name: 'cubiqport-api',
      script: `${APP_DIR}/apps/api/dist/apps/api/src/server.js`,
      cwd: APP_DIR,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_file: `${APP_DIR}/.env`,
      env: { NODE_ENV: 'production' },
      error_file: '/var/log/pm2/cubiqport-api-error.log',
      out_file: '/var/log/pm2/cubiqport-api-out.log',
    },
    {
      name: 'cubiqport-web',
      script: 'node',
      args: `${APP_DIR}/apps/web/.next/standalone/apps/web/server.js`,
      cwd: `${APP_DIR}/apps/web`,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_file: `${APP_DIR}/.env`,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        HOSTNAME: '0.0.0.0',
      },
      error_file: '/var/log/pm2/cubiqport-web-error.log',
      out_file: '/var/log/pm2/cubiqport-web-out.log',
    },
  ],
};
