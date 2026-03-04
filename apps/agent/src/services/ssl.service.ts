import { execSync } from 'child_process';
import { AppError } from '../utils/errors.js';

export interface SslInstallParams {
  domain: string;
  email: string;
}

/**
 * Obtains a Let's Encrypt certificate via Certbot with the nginx plugin.
 * nginx must already have a valid config for the domain.
 */
export function installSsl(params: SslInstallParams): void {
  const cmd = [
    'certbot',
    '--nginx',
    '--non-interactive',
    '--agree-tos',
    `--email ${params.email}`,
    `-d ${params.domain}`,
    `-d www.${params.domain}`,
    '--redirect',
  ].join(' ');

  try {
    execSync(cmd, { stdio: 'pipe', timeout: 120_000 });
  } catch (err) {
    const output = err instanceof Error ? (err as NodeJS.ErrnoException).message : String(err);
    throw new AppError(`Certbot failed: ${output}`, 500);
  }
}

export function renewSsl(): void {
  execSync('certbot renew --quiet', { stdio: 'pipe' });
}
