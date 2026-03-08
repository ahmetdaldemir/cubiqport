import { request } from 'undici';
import * as cheerio from 'cheerio';
import { logger } from '../../../utils/logger.js';

const TIMEOUT_MS = 15_000;

export interface SeoAnalysisResult {
  title: string | null;
  metaDescription: string | null;
  h1Tags: string[];
  loadTimeMs: number;
  mobileFriendly: boolean;
  lighthouseScore: number | null;
  brokenLinksCount: number;
  sitemapExists: boolean;
  robotsTxtExists: boolean;
  seoScore: number;
  rawData?: Record<string, unknown>;
}

function resolveUrl(base: string, path: string): string {
  if (path.startsWith('http')) return path;
  const u = new URL(base);
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${u.origin}${p}`;
}

export async function runSeoAnalysis(domainHost: string): Promise<SeoAnalysisResult> {
  const baseUrl = `https://${domainHost}`;
  const altUrl = `http://${domainHost}`;
  let html = '';
  let loadTimeMs = 0;
  let finalUrl = baseUrl;

  try {
    const start = Date.now();
    const res = await request(baseUrl, {
      method: 'GET',
      headersTimeout: TIMEOUT_MS,
      bodyTimeout: TIMEOUT_MS,
      maxRedirections: 5,
      headers: { 'user-agent': 'CubiqPort-SEO-Check/1.0' },
    });
    loadTimeMs = Date.now() - start;
    finalUrl = res.headers.location ? new URL(res.headers.location as string, baseUrl).href : baseUrl;
    if (res.statusCode !== 200) {
      const fallback = await request(altUrl, {
        method: 'GET',
        headersTimeout: TIMEOUT_MS,
        bodyTimeout: TIMEOUT_MS,
        maxRedirections: 5,
        headers: { 'user-agent': 'CubiqPort-SEO-Check/1.0' },
      });
      if (fallback.statusCode === 200) {
        html = (await fallback.body.text()) as string;
        loadTimeMs = loadTimeMs || Date.now() - start;
      }
    } else {
      html = (await res.body.text()) as string;
    }
  } catch (err) {
    logger.warn({ err, domainHost }, 'HTTPS failed, trying HTTP for SEO');
    const start = Date.now();
    const res = await request(altUrl, {
      method: 'GET',
      headersTimeout: TIMEOUT_MS,
      bodyTimeout: TIMEOUT_MS,
      maxRedirections: 5,
      headers: { 'user-agent': 'CubiqPort-SEO-Check/1.0' },
    });
    loadTimeMs = Date.now() - start;
    if (res.statusCode === 200) html = (await res.body.text()) as string;
  }

  const $ = cheerio.load(html || '<html></html>');
  const title = $('title').first().text().trim() || null;
  const metaDesc =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    null;
  const h1Tags: string[] = [];
  $('h1').each((_, el) => {
    const t = $(el).text().trim();
    if (t) h1Tags.push(t);
  });
  const viewport = $('meta[name="viewport"]').attr('content') ?? '';
  const mobileFriendly = /width=device-width|width\s*=\s*device-width/i.test(viewport);

  let brokenLinksCount = 0;
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('javascript:')) {
      links.push(resolveUrl(finalUrl, href));
    }
  });
  const uniqueLinks = [...new Set(links)].slice(0, 50);
  for (const url of uniqueLinks) {
    try {
      const r = await request(url, { method: 'HEAD', headersTimeout: 5000, maxRedirections: 2 });
      if (r.statusCode && r.statusCode >= 400) brokenLinksCount++;
    } catch {
      brokenLinksCount++;
    }
  }

  const origin = new URL(finalUrl).origin;
  let sitemapExists = false;
  let robotsTxtExists = false;
  try {
    const sitemapRes = await request(`${origin}/sitemap.xml`, { method: 'HEAD', headersTimeout: 3000 });
    sitemapExists = sitemapRes.statusCode === 200;
  } catch {
    // ignore
  }
  try {
    const robotsRes = await request(`${origin}/robots.txt`, { method: 'HEAD', headersTimeout: 3000 });
    robotsTxtExists = robotsRes.statusCode === 200;
  } catch {
    // ignore
  }

  let seoScore = 0;
  if (title) seoScore += 15;
  if (metaDesc) seoScore += 15;
  if (h1Tags.length > 0) seoScore += 15;
  if (mobileFriendly) seoScore += 15;
  if (loadTimeMs > 0 && loadTimeMs < 3000) seoScore += 10;
  else if (loadTimeMs > 0) seoScore += 5;
  if (sitemapExists) seoScore += 10;
  if (robotsTxtExists) seoScore += 5;
  seoScore += Math.max(0, 10 - brokenLinksCount);
  seoScore = Math.min(100, seoScore);

  return {
    title,
    metaDescription: metaDesc,
    h1Tags,
    loadTimeMs,
    mobileFriendly,
    lighthouseScore: null,
    brokenLinksCount,
    sitemapExists,
    robotsTxtExists,
    seoScore,
    rawData: { finalUrl, linksChecked: uniqueLinks.length },
  };
}
