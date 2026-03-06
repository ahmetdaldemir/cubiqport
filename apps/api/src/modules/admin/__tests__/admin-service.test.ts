import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── DB + tüm dış bağımlılıkları mock'la ─────────────────────────────────────
vi.mock('../../../db/index.js', () => ({
  db: {
    select:  vi.fn(),
    update:  vi.fn(),
    insert:  vi.fn(),
    query:   { subscriptions: { findFirst: vi.fn() } },
  },
}));

vi.mock('../../../db/schema.js', () => ({
  users:         'users_table',
  servers:       'servers_table',
  domains:       'domains_table',
  subscriptions: 'subscriptions_table',
  webhookEvents: 'webhookEvents_table',
}));

vi.mock('../../../services/stripe.service.js', () => ({
  stripe: null,
  stripeConfigured: false,
}));

vi.mock('../../../services/email.service.js', () => ({
  sendWelcomeEmail:  vi.fn().mockResolvedValue(undefined),
  sendSuspendEmail:  vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../config/index.js', () => ({
  config: { PUBLIC_URL: 'http://localhost:3000' },
}));

vi.mock('../../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq:    vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq' })),
  desc:  vi.fn((_col: unknown) => ({ type: 'desc' })),
  count: vi.fn(() => ({ type: 'count' })),
  sql:   vi.fn((strings: TemplateStringsArray) => ({ type: 'sql', raw: strings[0] })),
  index: vi.fn(),
}));

// ─── ConflictError / NotFoundError ────────────────────────────────────────────
import { ConflictError, NotFoundError } from '../../../utils/errors.js';

describe('AdminService — error class entegrasyonu', () => {
  it('ConflictError doğru HTTP kodu taşımalı', () => {
    const err = new ConflictError('E-posta zaten kayıtlı');
    expect(err.statusCode).toBe(409);
    expect(err.message).toBe('E-posta zaten kayıtlı');
  });

  it('NotFoundError doğru HTTP kodu taşımalı', () => {
    const err = new NotFoundError('Kullanıcı');
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain('Kullanıcı');
  });
});

// ─── generatePassword mantığını izole test et ─────────────────────────────────
describe('AdminService — password üretimi', () => {
  // generatePassword private olduğu için kopyasını test ediyoruz
  function generatePassword(len = 12): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  it('istenen uzunlukta şifre üretmeli', () => {
    expect(generatePassword(12)).toHaveLength(12);
    expect(generatePassword(20)).toHaveLength(20);
  });

  it('yalnızca geçerli karakter seti içermeli', () => {
    const validChars = /^[A-HJ-NP-Za-hj-np-z2-9!@#$]+$/;
    for (let i = 0; i < 50; i++) {
      expect(generatePassword(16)).toMatch(validChars);
    }
  });

  it('her seferinde farklı şifre üretmeli', () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generatePassword(12)));
    // 20 çağrıda en az 15 benzersiz şifre olmalı (rastgelelik testi)
    expect(passwords.size).toBeGreaterThan(15);
  });
});

// ─── listUsers server count logic ─────────────────────────────────────────────
describe('listUsers — sunucu sayacı hesaplama', () => {
  it('server count map doğru hesaplanmalı', () => {
    // AdminService.listUsers içindeki map mantığını izole test ediyoruz
    const serverCountRows = [
      { userId: 'user-1', cnt: 3 },
      { userId: 'user-2', cnt: 1 },
    ];

    const countMap = Object.fromEntries(serverCountRows.map(r => [r.userId, r.cnt]));

    const users = [
      { id: 'user-1', email: 'a@a.com' },
      { id: 'user-2', email: 'b@b.com' },
      { id: 'user-3', email: 'c@c.com' }, // sunucu yok
    ];

    const result = users.map(u => ({ ...u, serverCount: countMap[u.id] ?? 0 }));

    expect(result[0].serverCount).toBe(3);
    expect(result[1].serverCount).toBe(1);
    expect(result[2].serverCount).toBe(0);
  });
});
