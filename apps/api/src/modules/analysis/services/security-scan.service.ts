import { request } from 'undici';
import * as tls from 'tls';
import { logger } from '../../../utils/logger.js';

const TIMEOUT_MS = 10_000;
const SECURITY_HEADERS = [
  'x-frame-options',
  'x-content-type-options',
  'x-xss-protection',
  'strict-transport-security',
  'content-security-policy',
  'referrer-policy',
  'permissions-policy',
];

export interface SecurityScanResult {
  securityScore: number;
  httpsEnabled: boolean;
  securityHeaders: Record<string, string>;
  openPorts: number[];
  vulnerabilities: string[];
  sslValid: boolean;
  directoryListingEnabled: boolean;
  rawData?: Record<string, unknown>;
}

export async function runSecurityScan(domainHost: string): Promise<SecurityScanResult> {
  const vulnerabilities: string[] = [];
  const securityHeaders: Record<string, string> = {};
  let httpsEnabled = false;
  let sslValid = false;
  let directoryListingEnabled = false;

  const baseUrl = `https://${domainHost}`;
  const httpUrl = `http://${domainHost}`;

  try {
    const res = await request(baseUrl, {
      method: 'GET',
      headersTimeout: TIMEOUT_MS,
      bodyTimeout: TIMEOUT_MS,
      maxRedirections: 5,
      headers: { 'user-agent': 'CubiqPort-SecurityScan/1.0' },
    });
    httpsEnabled = true;
    const headers = res.headers as Record<string, string>;
    for (const name of SECURITY_HEADERS) {
      const value = headers[name];
      if (value) securityHeaders[name] = String(value).slice(0, 200);
    }
    if (!headers['x-frame-options']) vulnerabilities.push('Missing X-Frame-Options');
    if (!headers['x-content-type-options']) vulnerabilities.push('Missing X-Content-Type-Options');
    if (!headers['strict-transport-security']) vulnerabilities.push('Missing HSTS (Strict-Transport-Security)');
  } catch (err) {
    logger.warn({ err, domainHost }, 'HTTPS request failed for security scan');
    vulnerabilities.push('HTTPS not enforced or unreachable');
  }

  try {
    const res = await request(httpUrl, {
      method: 'GET',
      headersTimeout: 5000,
      maxRedirections: 0,
      headers: { 'user-agent': 'CubiqPort-SecurityScan/1.0' },
    });
    const loc = res.headers.location;
    if (!loc || !String(loc).toLowerCase().startsWith('https')) {
      vulnerabilities.push('HTTP does not redirect to HTTPS');
    }
  } catch {
    // HTTP might be disabled; that's ok if HTTPS works
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const socket = tls.connect(
        443,
        domainHost,
        { servername: domainHost, rejectUnauthorized: true, timeout: 5000 },
        () => {
          const cert = socket.getPeerCertificate();
          if (cert && Object.keys(cert).length > 0) sslValid = true;
          socket.destroy();
          resolve();
        },
      );
      socket.on('error', reject);
    });
  } catch (err) {
    vulnerabilities.push('SSL certificate invalid or expired');
  }

  try {
    const dirPaths = ['/', '/admin', '/backup', '/.git'];
    for (const path of dirPaths) {
      const url = `${baseUrl}${path}`;
      const res = await request(url, {
        method: 'GET',
        headersTimeout: 3000,
        maxRedirections: 2,
        headers: { 'user-agent': 'CubiqPort-SecurityScan/1.0' },
      });
      const body = (await res.body.text()) as string;
      if (
        res.statusCode === 200 &&
        (body.includes('Index of') || body.includes('Directory listing') || body.includes('<title>Index of'))
      ) {
        directoryListingEnabled = true;
        vulnerabilities.push(`Directory listing may be enabled at ${path}`);
        break;
      }
    }
  } catch {
    // ignore
  }

  let securityScore = 100;
  securityScore -= vulnerabilities.length * 15;
  if (!httpsEnabled) securityScore -= 25;
  if (!sslValid && httpsEnabled) securityScore -= 20;
  if (directoryListingEnabled) securityScore -= 15;
  securityScore = Math.max(0, Math.min(100, securityScore));

  return {
    securityScore,
    httpsEnabled,
    securityHeaders,
    openPorts: [],
    vulnerabilities,
    sslValid,
    directoryListingEnabled,
    rawData: {},
  };
}
