'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Stats {
  totalUsers: number; activeUsers: number; trialingUsers: number;
  totalServers: number; totalDomains: number;
  webhookTotal: number; webhookProcessed: number; webhookErrors: number;
}
interface User {
  id: string; email: string; role: string; createdAt: string;
  suspended: boolean; suspendedAt: string | null; suspendedReason: string | null;
  subStatus: string | null; subPeriod: string | null;
  trialEndsAt: string | null; currentPeriodEnd: string | null;
  stripeCustomerId: string | null; serverCount: number;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats]   = useState<Stats | null>(null);
  const [users, setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'trialing' | 'suspended' | 'expired'>('all');

  // Create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPass, setCreatePass]   = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createMsg, setCreateMsg]     = useState('');

  // Suspend modal
  const [suspendTarget, setSuspendTarget] = useState<User | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendLoading, setSuspendLoading] = useState(false);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('cubiq_token');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, []);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('cubiq_token');
    if (!token) { router.push('/login'); return; }
    try {
      const [sRes, uRes] = await Promise.all([
        fetch(`${API}/api/v1/admin/stats`, { headers: getHeaders() }),
        fetch(`${API}/api/v1/admin/users`, { headers: getHeaders() }),
      ]);
      if (sRes.status === 403) { setError('Bu sayfaya erişim yetkiniz yok.'); setLoading(false); return; }
      const sd = await sRes.json(); const ud = await uRes.json();
      if (sd.success) setStats(sd.data);
      if (ud.success) setUsers(ud.data);
    } catch { setError('Veriler yüklenemedi.'); }
    finally { setLoading(false); }
  }, [router, getHeaders]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateUser = async () => {
    if (!createEmail) return;
    setCreateLoading(true); setCreateMsg('');
    const res = await fetch(`${API}/api/v1/admin/users`, {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({ email: createEmail, password: createPass || undefined }),
    });
    const data = await res.json();
    if (data.success) {
      setCreateMsg('✓ Kullanıcı oluşturuldu ve e-posta gönderildi.');
      setCreateEmail(''); setCreatePass('');
      await fetchData();
    } else {
      setCreateMsg('✗ ' + (data.error ?? 'Hata'));
    }
    setCreateLoading(false);
  };

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    setSuspendLoading(true);
    const isSuspended = suspendTarget.suspended;
    const url = `${API}/api/v1/admin/users/${suspendTarget.id}/${isSuspended ? 'unsuspend' : 'suspend'}`;
    const res = await fetch(url, {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({ reason: suspendReason }),
    });
    const data = await res.json();
    if (data.success) { setSuspendTarget(null); setSuspendReason(''); await fetchData(); }
    setSuspendLoading(false);
  };

  const subColor = (s: string | null, suspended: boolean) => {
    if (suspended) return 'bg-red-100 text-red-700';
    if (s === 'active')   return 'bg-green-100 text-green-700';
    if (s === 'trialing') return 'bg-blue-100 text-blue-700';
    if (s === 'past_due') return 'bg-orange-100 text-orange-700';
    return 'bg-gray-100 text-gray-500';
  };

  const filtered = users.filter(u => {
    const matchSearch = u.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filterStatus === 'all'       ? true :
      filterStatus === 'suspended' ? u.suspended :
      filterStatus === 'expired'   ? (!u.subStatus || u.subStatus === 'canceled') && !u.suspended :
      u.subStatus === filterStatus && !u.suspended;
    return matchSearch && matchFilter;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (error)   return <div className="p-6"><div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div></div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Superadmin Paneli</h1>
          <p className="text-muted-foreground text-sm">Sistem geneli yönetim</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            + Yeni Kullanıcı
          </button>
          <Link href="/admin/webhooks" className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors">Webhook Logları</Link>
          <Link href="/admin/servers" className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors">Tüm Sunucular</Link>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Toplam Kullanıcı',  value: stats.totalUsers,       sub: `${stats.activeUsers} aktif` },
            { label: 'Deneme Süresi',     value: stats.trialingUsers,    sub: 'trialing' },
            { label: 'Sunucular',         value: stats.totalServers,     sub: 'toplam' },
            { label: 'Domainler',         value: stats.totalDomains,     sub: 'toplam' },
            { label: 'Askıya Alınan',     value: users.filter(u => u.suspended).length, sub: 'suspended', red: true },
            { label: 'Ödeme Bekleyen',    value: users.filter(u => u.subStatus === 'past_due').length, sub: 'past_due', warn: true },
            { label: 'Webhook Toplam',    value: stats.webhookTotal,     sub: `${stats.webhookProcessed} işlendi` },
            { label: 'Webhook Hata',      value: stats.webhookErrors,    sub: 'başarısız', red: true },
          ].map(c => (
            <div key={c.label} className={`rounded-xl border p-4 ${c.red && c.value > 0 ? 'border-red-200 bg-red-50' : c.warn && c.value > 0 ? 'border-orange-200 bg-orange-50' : 'bg-card'}`}>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className={`text-3xl font-bold mt-1 ${c.red && c.value > 0 ? 'text-red-600' : c.warn && c.value > 0 ? 'text-orange-600' : ''}`}>{c.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Kullanıcı listesi */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b flex flex-wrap gap-3 items-center justify-between">
          <h2 className="font-semibold">Kullanıcılar ({filtered.length}/{users.length})</h2>
          <div className="flex gap-2 flex-wrap">
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="E-posta ara..." className="border rounded-lg px-3 py-1.5 text-sm w-48 bg-background"
            />
            {(['all','active','trialing','suspended','expired'] as const).map(f => (
              <button key={f} onClick={() => setFilterStatus(f)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${filterStatus === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
                {f === 'all' ? 'Tümü' : f === 'active' ? 'Aktif' : f === 'trialing' ? 'Deneme' : f === 'suspended' ? 'Askıda' : 'Süresi Dolmuş'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">E-posta</th>
                <th className="text-left px-4 py-3 font-medium">Rol</th>
                <th className="text-left px-4 py-3 font-medium">Durum</th>
                <th className="text-left px-4 py-3 font-medium">Dönem</th>
                <th className="text-left px-4 py-3 font-medium">Deneme / Bitiş</th>
                <th className="text-left px-4 py-3 font-medium">Stripe</th>
                <th className="text-left px-4 py-3 font-medium">Sunucu</th>
                <th className="text-left px-4 py-3 font-medium">Kayıt</th>
                <th className="px-4 py-3 font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className={`border-t transition-colors ${u.suspended ? 'bg-red-50/50' : 'hover:bg-muted/30'}`}>
                  <td className="px-4 py-3 font-medium">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${u.role === 'superadmin' ? 'bg-purple-100 text-purple-700' : u.role === 'admin' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${subColor(u.subStatus, u.suspended)}`}>
                      {u.suspended ? 'Askıda' : (u.subStatus ?? '—')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{u.subPeriod ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {u.trialEndsAt ? new Date(u.trialEndsAt).toLocaleDateString('tr-TR') :
                     u.currentPeriodEnd ? new Date(u.currentPeriodEnd).toLocaleDateString('tr-TR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {u.stripeCustomerId
                      ? <a href={`https://dashboard.stripe.com/customers/${u.stripeCustomerId}`} target="_blank" rel="noreferrer" className="text-primary hover:underline font-mono">{u.stripeCustomerId.slice(0,14)}…</a>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">{u.serverCount}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(u.createdAt).toLocaleDateString('tr-TR')}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 items-center">
                      <Link href={`/admin/users/${u.id}`} className="text-xs text-primary hover:underline">Detay</Link>
                      {u.role !== 'superadmin' && (
                        <button onClick={() => { setSuspendTarget(u); setSuspendReason(''); }}
                          className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${u.suspended ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                          {u.suspended ? 'Aktifleştir' : 'Askıya Al'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">Kullanıcı bulunamadı.</p>}
        </div>
      </div>

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="font-bold text-lg mb-4">Yeni SaaS Kullanıcısı</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">E-posta *</label>
                <input value={createEmail} onChange={e => setCreateEmail(e.target.value)} type="email"
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background" placeholder="ornek@sirket.com" />
              </div>
              <div>
                <label className="text-sm font-medium">Şifre <span className="text-muted-foreground font-normal">(boş bırakılırsa otomatik üretilir)</span></label>
                <input value={createPass} onChange={e => setCreatePass(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background" placeholder="Şifre (opsiyonel)" />
              </div>
              {createMsg && <p className={`text-sm ${createMsg.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{createMsg}</p>}
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                Kullanıcı oluşturulduğunda otomatik olarak:<br />
                • 7 günlük deneme aboneliği başlatılır<br />
                • Stripe müşteri kaydı yapılır<br />
                • Hoşgeldin e-postası gönderilir
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setShowCreate(false); setCreateMsg(''); }} className="px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80">İptal</button>
              <button onClick={handleCreateUser} disabled={createLoading || !createEmail}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {createLoading ? 'Oluşturuluyor…' : 'Oluştur ve E-posta Gönder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {suspendTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="font-bold text-lg mb-1">
              {suspendTarget.suspended ? 'Hesabı Aktifleştir' : 'Hesabı Askıya Al'}
            </h2>
            <p className="text-muted-foreground text-sm mb-4">{suspendTarget.email}</p>
            {!suspendTarget.suspended && (
              <div>
                <label className="text-sm font-medium">Sebep <span className="text-muted-foreground font-normal">(opsiyonel)</span></label>
                <textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)} rows={3}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none" placeholder="Askıya alma sebebi..." />
                <p className="text-xs text-muted-foreground mt-1">Kullanıcıya e-posta ile bildirilecek.</p>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setSuspendTarget(null)} className="px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80">İptal</button>
              <button onClick={handleSuspend} disabled={suspendLoading}
                className={`px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50 ${suspendTarget.suspended ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {suspendLoading ? 'İşleniyor…' : suspendTarget.suspended ? 'Aktifleştir' : 'Askıya Al'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
