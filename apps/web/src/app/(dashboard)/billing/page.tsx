'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { Header } from '@/components/layout/header';
import {
  CreditCardIcon,
  ReceiptIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ExternalLinkIcon,
  Loader2Icon,
  BuildingIcon,
  FileTextIcon,
  CalendarIcon,
  DownloadIcon,
} from 'lucide-react';

// Stripe Pricing Table custom element için TypeScript bildirimi
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'stripe-pricing-table': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'pricing-table-id': string;
          'publishable-key': string;
          'customer-email'?: string;
          'client-reference-id'?: string;
        },
        HTMLElement
      >;
    }
  }
}

const PRICING_TABLE_ID   = 'prctbl_1T7WkBJpoC0mNwVW4fwIUU6A';
const PUBLISHABLE_KEY    = 'pk_live_51RM643JpoC0mNwVWeCMfS1WckX9Bh8d25g02RHaIZBk8VTi84YEyFvZLsrC0WR53KMyB3YIcuWVAH7u1PmpDeG4t00ZdNBIgfd';

function useToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('cubiq_token') ?? '' : '';
}

interface Subscription {
  id: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
  billingPeriod: 'monthly' | 'yearly';
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
  daysRemaining: number | null;
}

interface BillingInfo {
  companyName?: string;
  taxId?: string;
  address?: string;
  city?: string;
  country?: string;
  billingEmail?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amountCents: number;
  currency: string;
  status: 'paid' | 'open' | 'void' | 'uncollectible';
  pdfUrl: string | null;
  hostedUrl: string | null;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
}

interface UserInfo {
  email: string;
  id: string;
}

const statusConfig = {
  trialing: { label: 'Deneme Süresi', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  active:   { label: 'Aktif',          color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  past_due: { label: 'Ödeme Bekliyor', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  canceled: { label: 'İptal Edildi',   color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  expired:  { label: 'Süresi Doldu',   color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

function fmtMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ── Stripe Pricing Table ───────────────────────────────────────────────────
function StripePricingTable({ email, userId }: { email: string; userId: string }) {
  return (
    <>
      <Script
        src="https://js.stripe.com/v3/pricing-table.js"
        strategy="lazyOnload"
      />
      <div className="rounded-xl overflow-hidden">
        <stripe-pricing-table
          pricing-table-id={PRICING_TABLE_ID}
          publishable-key={PUBLISHABLE_KEY}
          customer-email={email || undefined}
          client-reference-id={userId || undefined}
        />
      </div>
    </>
  );
}

// ── Main Content ──────────────────────────────────────────────────────────────
function BillingContent() {
  const token        = useToken();
  const searchParams = useSearchParams();

  const [sub,           setSub]           = useState<Subscription | null>(null);
  const [billing,       setBilling]       = useState<BillingInfo>({});
  const [invoiceList,   setInvoiceList]   = useState<Invoice[]>([]);
  const [userInfo,      setUserInfo]      = useState<UserInfo | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [billingLoading,setBillingLoading]= useState(false);
  const [msg,           setMsg]           = useState('');
  const [editingBilling,setEditingBilling]= useState(false);
  const [form,          setForm]          = useState<BillingInfo>({});

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // JWT'den user bilgisini çöz
  function parseJwt(token: string): UserInfo | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return { email: payload.email ?? '', id: payload.sub ?? '' };
    } catch {
      return null;
    }
  }

  const loadAll = useCallback(async () => {
    if (!token) return;
    setUserInfo(parseJwt(token));
    try {
      const [subRes, billingRes, invRes] = await Promise.all([
        fetch('/api/v1/billing/subscription', { headers }),
        fetch('/api/v1/billing/info',          { headers }),
        fetch('/api/v1/billing/invoices',      { headers }),
      ]);
      const [subJ, billingJ, invJ] = await Promise.all([
        subRes.json(), billingRes.json(), invRes.json(),
      ]);
      setSub(subJ.data ?? null);
      const bi = billingJ.data ?? {};
      setBilling(bi);
      setForm(bi);
      setInvoiceList(invJ.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadAll();
    if (searchParams.get('success') === '1') {
      setMsg('✓ Abonelik başarıyla oluşturuldu! Panel erişiminiz aktif.');
    }
    if (searchParams.get('canceled') === '1') setMsg('Ödeme iptal edildi.');
  }, [loadAll, searchParams]);

  async function openPortal() {
    setActionLoading('portal');
    try {
      const res = await fetch('/api/v1/billing/portal', { method: 'GET', headers });
      const j = await res.json();
      if (j.data?.url) {
        window.location.href = j.data.url;
      } else {
        setMsg(`✗ ${j.error ?? 'Portal açılamadı'}`);
      }
    } catch {
      setMsg('✗ Bağlantı hatası');
    } finally {
      setActionLoading('');
    }
  }

  async function saveBilling() {
    setBillingLoading(true);
    try {
      const res = await fetch('/api/v1/billing/info', {
        method: 'POST',
        headers,
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (res.ok) {
        setBilling(j.data);
        setEditingBilling(false);
        setMsg('✓ Fatura bilgileri güncellendi');
      } else {
        setMsg(`✗ ${j.error}`);
      }
    } finally {
      setBillingLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col">
        <Header title="Faturalama" description="Abonelik ve ödeme yönetimi" />
        <div className="p-6 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const status     = sub?.status ?? 'expired';
  const statusInfo = statusConfig[status];
  const isActive   = status === 'active';
  const needsPay   = !isActive; // trialing, expired, canceled, past_due, null → pricing table göster

  return (
    <div className="flex flex-col">
      <Header title="Faturalama" description="Abonelik ve ödeme yönetimi" />

      <div className="p-6 space-y-6 max-w-4xl">

        {/* Flash mesajı */}
        {msg && (
          <div className={`rounded-lg px-4 py-3 text-sm border flex items-center gap-2 ${
            msg.startsWith('✓')
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            {msg.startsWith('✓')
              ? <CheckCircleIcon className="h-4 w-4 shrink-0" />
              : <AlertCircleIcon className="h-4 w-4 shrink-0" />}
            {msg}
          </div>
        )}

        {/* ── Abonelik özeti (aktif kullanıcılar için) ── */}
        {isActive && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-start justify-between gap-4 flex-wrap p-6 border-b border-border">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
                  <CreditCardIcon className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">CubiqPort Pro</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {sub?.billingPeriod === 'yearly' ? 'Yıllık plan · $96/yıl' : 'Aylık plan · $10/ay'}
                  </p>
                </div>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                {sub?.currentPeriodEnd && (
                  <div className="rounded-lg bg-secondary/50 p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5" /> Yenileme Tarihi
                    </p>
                    <p className="font-semibold">{fmtDate(sub.currentPeriodEnd)}</p>
                    {sub.cancelAtPeriodEnd && (
                      <p className="text-xs text-amber-400 mt-0.5">Dönem sonunda iptal edilecek</p>
                    )}
                  </div>
                )}
                <div className="rounded-lg bg-secondary/50 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Fatura Dönemi</p>
                  <p className="font-semibold">{sub?.billingPeriod === 'yearly' ? 'Yıllık' : 'Aylık'}</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Tutar</p>
                  <p className="font-semibold">{sub?.billingPeriod === 'yearly' ? '$96.00 / yıl' : '$10.00 / ay'}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={openPortal}
                  disabled={actionLoading === 'portal'}
                  className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-5 py-2.5 text-sm font-medium hover:bg-secondary/80 disabled:opacity-60 transition"
                >
                  {actionLoading === 'portal'
                    ? <Loader2Icon className="h-4 w-4 animate-spin" />
                    : <ExternalLinkIcon className="h-4 w-4" />}
                  Ödeme Yönetimi
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Planınızı değiştirmek, iptal etmek veya ödeme yönteminizi güncellemek için "Ödeme Yönetimi"ne tıklayın.
              </p>
            </div>
          </div>
        )}

        {/* ── Stripe Pricing Table (ödeme gerekenler) ── */}
        {needsPay && (
          <div className="space-y-4">
            {/* Mevcut durum uyarısı */}
            {sub && status !== 'trialing' && (
              <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-300">
                <AlertCircleIcon className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  {status === 'past_due'
                    ? 'Ödemeniz alınamadı. Devam etmek için aşağıdan plan seçin.'
                    : 'Aboneliğiniz sona erdi. Panele erişmek için plan seçin.'}
                </span>
              </div>
            )}

            {sub?.status === 'trialing' && (
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-indigo-300">
                    Deneme süreniz devam ediyor
                    {(sub.daysRemaining ?? 0) > 0 && ` · ${sub.daysRemaining} gün kaldı`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Deneme bitiminde erişim kesilmeden devam etmek için bir plan seçin.
                  </p>
                </div>
                <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>
            )}

            {/* Stripe Pricing Table */}
            <div className="rounded-xl border border-border bg-card p-1 overflow-hidden">
              <StripePricingTable
                email={userInfo?.email ?? billing.billingEmail ?? ''}
                userId={userInfo?.id ?? ''}
              />
            </div>
          </div>
        )}

        {/* ── Fatura Bilgileri ── */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <BuildingIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Fatura Bilgileri</h3>
                <p className="text-xs text-muted-foreground">Faturalarınız bu bilgilere düzenlenir</p>
              </div>
            </div>
            {!editingBilling && (
              <button
                onClick={() => { setForm(billing); setEditingBilling(true); }}
                className="text-xs text-primary hover:underline"
              >
                Düzenle
              </button>
            )}
          </div>

          {editingBilling ? (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { key: 'companyName',  label: 'Şirket Adı',       placeholder: 'Şirket A.Ş.' },
                  { key: 'taxId',        label: 'Vergi No / TC',     placeholder: '1234567890' },
                  { key: 'billingEmail', label: 'Fatura E-postası',  placeholder: 'fatura@sirket.com' },
                  { key: 'city',         label: 'Şehir',             placeholder: 'İstanbul' },
                  { key: 'country',      label: 'Ülke',              placeholder: 'TR' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                    <input
                      value={(form as Record<string, string>)[key] ?? ''}
                      onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">Adres</label>
                  <textarea
                    value={form.address ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Tam adres"
                    rows={2}
                    className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={saveBilling}
                  disabled={billingLoading}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {billingLoading
                    ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                    : <CheckCircleIcon className="h-3.5 w-3.5" />}
                  Kaydet
                </button>
                <button
                  onClick={() => setEditingBilling(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary"
                >
                  İptal
                </button>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {billing.companyName ? (
                <>
                  <div><p className="text-xs text-muted-foreground">Şirket</p><p className="font-medium mt-0.5">{billing.companyName}</p></div>
                  {billing.taxId && <div><p className="text-xs text-muted-foreground">Vergi No</p><p className="font-medium mt-0.5">{billing.taxId}</p></div>}
                  {billing.billingEmail && <div><p className="text-xs text-muted-foreground">Fatura E-postası</p><p className="font-medium mt-0.5">{billing.billingEmail}</p></div>}
                  {billing.address && <div><p className="text-xs text-muted-foreground">Adres</p><p className="font-medium mt-0.5">{billing.address}, {billing.city}</p></div>}
                </>
              ) : (
                <div className="sm:col-span-2 text-muted-foreground text-sm py-2">
                  Fatura bilgileri eklenmemiş.{' '}
                  <button onClick={() => setEditingBilling(true)} className="text-primary hover:underline">
                    Ekle →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Fatura Geçmişi ── */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <ReceiptIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Fatura Geçmişi</h3>
              <p className="text-xs text-muted-foreground">Tüm ödeme kayıtlarınız</p>
            </div>
          </div>

          {invoiceList.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center gap-3">
              <FileTextIcon className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Henüz fatura bulunmuyor</p>
              <p className="text-xs text-muted-foreground">İlk ödemenizden sonra faturalar burada görünecek</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {['Fatura No', 'Dönem', 'Tutar', 'Durum', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoiceList.map(inv => (
                    <tr key={inv.id} className="hover:bg-secondary/20 transition">
                      <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber || inv.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {inv.periodStart
                          ? `${fmtDate(inv.periodStart)} – ${fmtDate(inv.periodEnd)}`
                          : fmtDate(inv.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-semibold">{fmtMoney(inv.amountCents, inv.currency)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          inv.status === 'paid'
                            ? 'bg-green-500/10 border-green-500/20 text-green-400'
                            : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        }`}>
                          {inv.status === 'paid' ? 'Ödendi' : 'Bekliyor'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {inv.pdfUrl && (
                            <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" title="PDF İndir"
                              className="text-muted-foreground hover:text-foreground transition">
                              <DownloadIcon className="h-4 w-4" />
                            </a>
                          )}
                          {inv.hostedUrl && (
                            <a href={inv.hostedUrl} target="_blank" rel="noopener noreferrer" title="Fatura Görüntüle"
                              className="text-muted-foreground hover:text-foreground transition">
                              <ExternalLinkIcon className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground text-sm">Yükleniyor…</div>}>
      <BillingContent />
    </Suspense>
  );
}
