import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractSubscriptionId, calcTrialEnd, STRIPE_STATUS_MAP } from '../billing-helpers.js';

describe('extractSubscriptionId', () => {
  it('string subscription id döndürmeli', () => {
    const inv = { subscription: 'sub_abc123' };
    expect(extractSubscriptionId(inv)).toBe('sub_abc123');
  });

  it('genişletilmiş Subscription objesinden id almalı', () => {
    const inv = { subscription: { id: 'sub_xyz456', status: 'active' } };
    expect(extractSubscriptionId(inv)).toBe('sub_xyz456');
  });

  it('subscription null ise null döndürmeli', () => {
    expect(extractSubscriptionId({ subscription: null })).toBeNull();
  });

  it('subscription undefined ise null döndürmeli', () => {
    expect(extractSubscriptionId({ subscription: undefined })).toBeNull();
  });

  it('subscription olmayan obje için null döndürmeli', () => {
    expect(extractSubscriptionId({})).toBeNull();
  });

  it('null input için null döndürmeli', () => {
    expect(extractSubscriptionId(null)).toBeNull();
  });

  it('string input için null döndürmeli (tip koruması)', () => {
    expect(extractSubscriptionId('not-an-object')).toBeNull();
  });
});

describe('calcTrialEnd', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('şimdiden 7 gün sonrasını döndürmeli', () => {
    const result = calcTrialEnd();
    expect(result.toISOString()).toBe('2025-01-08T00:00:00.000Z');
  });

  it('verilen tarihten 7 gün sonrasını döndürmeli', () => {
    const from = new Date('2025-06-01T12:00:00.000Z');
    const result = calcTrialEnd(from);
    expect(result.toISOString()).toBe('2025-06-08T12:00:00.000Z');
  });

  it('orijinal tarihi değiştirmemeli (immutable)', () => {
    const from = new Date('2025-01-01T00:00:00.000Z');
    calcTrialEnd(from);
    expect(from.toISOString()).toBe('2025-01-01T00:00:00.000Z');
  });
});

describe('STRIPE_STATUS_MAP', () => {
  it('known status\'ları doğru map etmeli', () => {
    expect(STRIPE_STATUS_MAP.active).toBe('active');
    expect(STRIPE_STATUS_MAP.trialing).toBe('trialing');
    expect(STRIPE_STATUS_MAP.canceled).toBe('canceled');
    expect(STRIPE_STATUS_MAP.past_due).toBe('past_due');
    expect(STRIPE_STATUS_MAP.incomplete_expired).toBe('expired');
  });

  it('ödenmemiş abonelikler past_due olmalı', () => {
    expect(STRIPE_STATUS_MAP.unpaid).toBe('past_due');
    expect(STRIPE_STATUS_MAP.incomplete).toBe('past_due');
    expect(STRIPE_STATUS_MAP.paused).toBe('past_due');
  });
});
