'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ServerIcon,
  GlobeIcon,
  ContainerIcon,
  ShieldCheckIcon,
  ZapIcon,
  BarChart3Icon,
  CheckIcon,
  ArrowRightIcon,
  MenuIcon,
  XIcon,
  StarIcon,
} from 'lucide-react';

// ─── Auth Modal ───────────────────────────────────────────────────────────────
function AuthModal({ mode, onClose }: { mode: 'login' | 'register'; onClose: () => void }) {
  const [tab, setTab] = useState<'login' | 'register'>(mode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const endpoint = tab === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Failed');
      if (tab === 'login') {
        localStorage.setItem('cubiq_token', j.data.token);
        window.location.href = '/dashboard';
      } else {
        // Auto-login after register
        const loginRes = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const loginJ = await loginRes.json();
        if (loginRes.ok) {
          localStorage.setItem('cubiq_token', loginJ.data.token);
          window.location.href = '/dashboard';
        } else {
          window.location.href = '/login';
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0d14] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex gap-1 rounded-lg bg-white/5 p-1">
            <button
              onClick={() => setTab('login')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === 'login' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Giriş Yap
            </button>
            <button
              onClick={() => setTab('register')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === 'register' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Kayıt Ol
            </button>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="px-6 pb-6 space-y-4">
          {tab === 'register' && (
            <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-4 py-3 text-sm text-indigo-300">
              🎉 <span className="font-semibold">7 gün ücretsiz</span> deneyin — kredi kartı gerekmez
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">E-posta</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="siz@sirket.com"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Şifre</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <>
                {tab === 'login' ? 'Giriş Yap' : 'Ücretsiz Deneyin'}
                <ArrowRightIcon className="h-4 w-4" />
              </>
            )}
          </button>

          {tab === 'register' && (
            <p className="text-xs text-center text-gray-500">
              Kayıt olarak{' '}
              <span className="text-gray-400 underline cursor-pointer">Kullanım Koşulları</span>
              {' '}ve{' '}
              <span className="text-gray-400 underline cursor-pointer">Gizlilik Politikasını</span>
              {' '}kabul etmiş olursunuz.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const features = [
  {
    icon: ServerIcon,
    title: 'Sunucu Yönetimi',
    desc: 'SSH ile bağlanın, tarayın ve yönetin. Şifre veya anahtar tabanlı kimlik doğrulama.',
    color: 'from-indigo-500 to-indigo-700',
  },
  {
    icon: GlobeIcon,
    title: 'Domain & DNS',
    desc: 'Nginx yapılandırması, SSL sertifikaları ve Cloudflare DNS yönetimi tek panelden.',
    color: 'from-violet-500 to-violet-700',
  },
  {
    icon: ContainerIcon,
    title: 'Docker Yönetimi',
    desc: "Container'ları başlatın, durdurun, logları görüntüleyin. Canlı RAM/CPU izleme.",
    color: 'from-sky-500 to-sky-700',
  },
  {
    icon: BarChart3Icon,
    title: 'Canlı Metrikler',
    desc: 'CPU, RAM, disk ve ağ kullanımını gerçek zamanlı SSH ile izleyin.',
    color: 'from-emerald-500 to-emerald-700',
  },
  {
    icon: ZapIcon,
    title: 'GitHub Deploy',
    desc: 'Webhook ile otomatik deployment. Tek tıkla pull ve rebuild.',
    color: 'from-amber-500 to-amber-700',
  },
  {
    icon: ShieldCheckIcon,
    title: 'SSL & Güvenlik',
    desc: "Let's Encrypt ile otomatik SSL. Şifreli SSH kimlik bilgileri saklama.",
    color: 'from-rose-500 to-rose-700',
  },
];

const testimonials = [
  {
    text: "CubiqPort sayesinde sunucu yönetimim çok kolaylaştı. Docker containerlarını tek panelden yönetiyorum.",
    name: "Ahmet Y.",
    role: "Full-Stack Geliştirici",
  },
  {
    text: "7 günlük deneme ile başladım, hemen abone oldum. Fiyat/performans mükemmel.",
    name: "Selin K.",
    role: "DevOps Mühendisi",
  },
  {
    text: "Nginx ve SSL kurulumunu artık terminal açmadan yapıyorum. Harika bir araç.",
    name: "Mert A.",
    role: "Backend Geliştirici",
  },
];

// ─── Landing Page ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <div className="min-h-screen bg-[#08080f] text-white overflow-x-hidden">
      {authModal && <AuthModal mode={authModal} onClose={() => setAuthModal(null)} />}

      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-white/5 bg-[#08080f]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
                <ServerIcon className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight">CubiqPort</span>
            </div>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
              <a href="#features" className="hover:text-white transition">Özellikler</a>
              <a href="#pricing" className="hover:text-white transition">Fiyatlandırma</a>
              <a href="#testimonials" className="hover:text-white transition">Yorumlar</a>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={() => setAuthModal('login')}
                className="text-sm text-gray-400 hover:text-white transition px-3 py-1.5"
              >
                Giriş Yap
              </button>
              <button
                onClick={() => setAuthModal('register')}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 transition"
              >
                Ücretsiz Başla
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-gray-400 hover:text-white"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              {mobileMenu ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenu && (
          <div className="md:hidden border-t border-white/5 px-4 py-4 space-y-3">
            <a href="#features" className="block text-sm text-gray-400 hover:text-white py-1" onClick={() => setMobileMenu(false)}>Özellikler</a>
            <a href="#pricing" className="block text-sm text-gray-400 hover:text-white py-1" onClick={() => setMobileMenu(false)}>Fiyatlandırma</a>
            <a href="#testimonials" className="block text-sm text-gray-400 hover:text-white py-1" onClick={() => setMobileMenu(false)}>Yorumlar</a>
            <div className="pt-2 flex gap-3">
              <button onClick={() => { setAuthModal('login'); setMobileMenu(false); }} className="flex-1 rounded-lg border border-white/10 py-2 text-sm font-medium hover:bg-white/5 transition">Giriş Yap</button>
              <button onClick={() => { setAuthModal('register'); setMobileMenu(false); }} className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold hover:bg-indigo-500 transition">Ücretsiz Başla</button>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-24 px-4 sm:px-6 overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="mx-auto max-w-4xl text-center relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs text-indigo-300 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
            7 Gün Ücretsiz Deneme — Kredi Kartı Gerekmez
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
            Sunucularınızı
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              kolayca yönetin
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            SSH bağlantısı, domain yönetimi, Docker container&apos;ları ve canlı metrikler.
            Teknik bilgi gerektirmeden, tek panelden.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setAuthModal('register')}
              className="w-full sm:w-auto rounded-xl bg-indigo-600 px-8 py-4 text-base font-semibold hover:bg-indigo-500 transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25"
            >
              Ücretsiz Başla
              <ArrowRightIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setAuthModal('login')}
              className="w-full sm:w-auto rounded-xl border border-white/10 px-8 py-4 text-base font-medium hover:bg-white/5 transition"
            >
              Hesabım Var
            </button>
          </div>

          <p className="mt-6 text-sm text-gray-500">
            7 gün ücretsiz · Sonra <span className="text-gray-300 font-semibold">$10/ay</span> · İstediğiniz zaman iptal
          </p>
        </div>

        {/* Dashboard preview */}
        <div className="mx-auto max-w-5xl mt-16 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-[#08080f] to-transparent z-10 pointer-events-none rounded-2xl" style={{ top: '60%' }} />
          <div className="rounded-2xl border border-white/10 bg-[#0d0d14] overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
              <div className="h-3 w-3 rounded-full bg-red-500/70" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
              <div className="h-3 w-3 rounded-full bg-green-500/70" />
              <span className="ml-3 text-xs text-gray-500">CubiqPort — Sunucu Yönetimi</span>
            </div>
            <div className="grid grid-cols-4 gap-4 p-6 min-h-[200px]">
              {[
                { label: 'Sunucular', value: '3', color: 'indigo' },
                { label: 'Domainler', value: '12', color: 'violet' },
                { label: 'Container\'lar', value: '8', color: 'sky' },
                { label: 'Uptime', value: '99.9%', color: 'emerald' },
              ].map(item => (
                <div key={item.label} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-xs text-gray-500 mb-2">{item.label}</p>
                  <p className={`text-2xl font-bold text-${item.color}-400`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Her şey tek panelde</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Sunucu altyapınızı yönetmek için ihtiyacınız olan tüm araçlar
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="group rounded-2xl border border-white/5 bg-white/[0.02] p-6 hover:border-white/10 hover:bg-white/[0.04] transition">
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.color} mb-5 shadow-lg`}>
                  <f.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-base font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 px-4 sm:px-6 relative">
        <div className="absolute inset-0 bg-indigo-600/5 pointer-events-none" />
        <div className="mx-auto max-w-3xl relative">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Sade fiyatlandırma</h2>
            <p className="text-gray-400 text-lg">Gizli ücret yok. İstediğiniz zaman iptal.</p>
          </div>

          <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-500/10 to-transparent p-8 sm:p-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-xs text-indigo-300 font-medium mb-3">
                  <StarIcon className="h-3 w-3" />
                  En Popüler
                </div>
                <h3 className="text-2xl font-bold">Pro Plan</h3>
                <p className="text-gray-400 mt-1">Sınırsız sunucu ve domain yönetimi</p>
              </div>
              <div className="text-right">
                <div className="flex items-end gap-1">
                  <span className="text-5xl font-bold">$10</span>
                  <span className="text-gray-400 mb-1">/ay</span>
                </div>
                <p className="text-sm text-indigo-300 font-medium">7 gün ücretsiz deneme</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mb-8">
              {[
                'Sınırsız sunucu',
                'Sınırsız domain',
                'Docker yönetimi',
                'SSH şifre/anahtar desteği',
                'Canlı metrik izleme',
                'GitHub webhook deploy',
                'SSL sertifika yönetimi',
                'Cloudflare DNS entegrasyonu',
                '7/24 SSH erişimi',
                'Fatura & ödeme geçmişi',
              ].map(item => (
                <div key={item} className="flex items-center gap-2.5 text-sm text-gray-300">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 shrink-0">
                    <CheckIcon className="h-3 w-3 text-indigo-400" />
                  </div>
                  {item}
                </div>
              ))}
            </div>

            <button
              onClick={() => setAuthModal('register')}
              className="w-full rounded-xl bg-indigo-600 py-4 text-base font-semibold hover:bg-indigo-500 transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              7 Gün Ücretsiz Dene
              <ArrowRightIcon className="h-5 w-5" />
            </button>
            <p className="text-center text-xs text-gray-500 mt-3">
              Kredi kartı gerekmez · Deneme bitmeden iptal edebilirsiniz
            </p>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-24 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Kullanıcılar ne diyor?</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <StarIcon key={j} className="h-4 w-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-gray-300 leading-relaxed mb-5">&quot;{t.text}&quot;</p>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Hemen başlayın</h2>
          <p className="text-gray-400 text-lg mb-8">
            7 günlük ücretsiz deneme ile tüm özelliklere erişin.
          </p>
          <button
            onClick={() => setAuthModal('register')}
            className="rounded-xl bg-indigo-600 px-10 py-4 text-base font-semibold hover:bg-indigo-500 transition inline-flex items-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            Ücretsiz Başla
            <ArrowRightIcon className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-8 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-indigo-600">
              <ServerIcon className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold">CubiqPort</span>
          </div>
          <p className="text-xs text-gray-500">© {new Date().getFullYear()} CubiqPort. Tüm hakları saklıdır.</p>
          <div className="flex gap-5 text-xs text-gray-500">
            <Link href="/login" className="hover:text-white transition">Giriş</Link>
            <button onClick={() => setAuthModal('register')} className="hover:text-white transition">Kayıt</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
