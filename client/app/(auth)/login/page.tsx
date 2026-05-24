'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Headset, Eye, EyeOff, ArrowRight, Loader2, Shield, Zap, Globe, BarChart3, Clock, Lock } from 'lucide-react';

/* ── Floating particle config ──────────────────────────────────── */
const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 3 + 1.5,
  dur: Math.random() * 18 + 14,
  delay: Math.random() * -20,
  opacity: Math.random() * 0.25 + 0.08,
}));

/* ── Stats ticker ───────────────────────────────────────────────── */
const STATS = [
  { value: '99.99%', label: 'Uptime SLA' },
  { value: '<100ms', label: 'Latency' },
  { value: 'SOC 2', label: 'Compliant' },
  { value: '256-bit', label: 'Encryption' },
  { value: '24/7', label: 'Support' },
  { value: '50+', label: 'Data Centers' },
  { value: 'GDPR', label: 'Ready' },
  { value: 'ISO', label: '27001' },
];

/* ── Feature cards ─────────────────────────────────────────────── */
const FEATURES = [
  { icon: Globe, title: 'Global Reach', desc: '50+ data centers worldwide' },
  { icon: Zap, title: 'Sub-100ms', desc: 'Ultra-low latency routing' },
  { icon: Shield, title: 'Enterprise Security', desc: 'SOC 2 & GDPR compliant' },
  { icon: BarChart3, title: 'Real-time Analytics', desc: 'Live dashboards & reporting' },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [featuresVisible, setFeaturesVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => setFeaturesVisible(true), 600);
    return () => clearTimeout(t);
  }, []);

  /* Load remembered username */
  useEffect(() => {
    const saved = localStorage.getItem('remembered_user');
    if (saved) { setUsername(saved); setRememberMe(true); }
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setShakeKey((k) => k + 1);
        return;
      }

      if (rememberMe) {
        localStorage.setItem('remembered_user', username);
      } else {
        localStorage.removeItem('remembered_user');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/phone');
    } catch {
      setError('Network error — please check your connection');
      setShakeKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }, [username, password, rememberMe, router]);

  return (
    <div className="min-h-screen flex bg-tx-s0">
      {/* ════════════════════════════════════════════════════════════
          LEFT — Branding Panel
          ════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] relative overflow-hidden items-center justify-center bg-tx-s1 border-r border-tx-bdefault flex-col">
        {/* ── Animated gradient background ── */}
        <div className="absolute inset-0 bg-gradient-animate" />

        {/* ── Floating particles ── */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {PARTICLES.map((p) => (
            <div
              key={p.id}
              className="absolute rounded-full bg-tx-green particle-float"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
                opacity: p.opacity,
                animation: `particleFloat ${p.dur}s ease-in-out ${p.delay}s infinite`,
              }}
            />
          ))}
        </div>

        {/* ── Ambient glows ── */}
        <div className="absolute top-[10%] left-[15%] w-[420px] h-[420px] bg-tx-green/[0.06] rounded-full blur-[140px] animate-glow-drift" />
        <div className="absolute bottom-[15%] right-[10%] w-[350px] h-[350px] bg-tx-citron/[0.03] rounded-full blur-[120px] animate-glow-drift-reverse" />

        {/* ── Content ── */}
        <div className="relative z-10 px-12 flex-1 flex flex-col justify-center max-w-md mx-auto">
          {/* Logo */}
          <div className="logo-glow-container mb-8 inline-flex">
            <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-tx-md logo-pulse">
              <Headset className="w-5 h-5 text-tx-ti" strokeWidth={2.2} />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 mb-4">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full bg-tx-green animate-ping opacity-60" />
              <span className="relative w-1.5 h-1.5 rounded-full bg-tx-green" />
            </span>
            <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-tx-green">Live</span>
            <span className="text-tx-tt text-[11px]">· Telnyx Contact Center</span>
          </div>

          <h1 className="text-[34px] font-semibold text-tx-tp mb-3 tracking-tight leading-[1.05]">
            The agent desktop, reimagined.
          </h1>
          <p className="text-[14px] text-tx-ts leading-relaxed max-w-sm">
            Carrier-grade voice, messaging, and AI — unified into one workspace built for the people who actually talk to customers.
          </p>

          {/* Feature list (compact) */}
          <div className="mt-8 space-y-2 max-w-sm">
            {FEATURES.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="feature-card-stagger flex items-center gap-3 px-3 py-2 rounded-lg border border-tx-bsubtle"
                  style={{
                    opacity: featuresVisible ? 1 : 0,
                    transform: featuresVisible ? 'translateY(0)' : 'translateY(8px)',
                    transition: `opacity 0.45s cubic-bezier(0.16,1,0.3,1) ${i * 90}ms, transform 0.45s cubic-bezier(0.16,1,0.3,1) ${i * 90}ms`,
                  }}
                >
                  <div className="w-7 h-7 rounded-md bg-tx-s2 border border-tx-bsubtle flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-tx-green" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium text-tx-tp leading-none">{feat.title}</div>
                    <div className="text-[11px] text-tx-tt leading-none mt-1">{feat.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Scrolling stats ticker ── */}
        <div className="relative z-10 w-full border-t border-tx-bsubtle mt-auto">
          <div className="overflow-hidden py-3">
            <div className="ticker-scroll flex whitespace-nowrap">
              {[...STATS, ...STATS].map((stat, i) => (
                <div key={i} className="inline-flex items-center gap-1.5 mx-5">
                  <span className="text-tx-tp font-semibold text-[12px] tnum tracking-tight">{stat.value}</span>
                  <span className="text-tx-tt text-[11px]">{stat.label}</span>
                  <span className="text-tx-bsubtle mx-2">·</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          RIGHT — Form Panel
          ════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-tx-s0 relative">
        {/* Subtle right-side glow */}
        <div className="absolute top-[30%] left-[20%] w-[400px] h-[400px] bg-tx-green/[0.02] rounded-full blur-[160px] pointer-events-none" />

        <div className={`w-full max-w-[380px] relative z-10 ${error ? 'animate-shake' : ''}`} key={shakeKey}>
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-3 shadow-tx-md">
              <Headset className="w-5 h-5 text-tx-ti" strokeWidth={2} />
            </div>
            <h1 className="text-[20px] font-semibold text-tx-tp tracking-tight">Telnyx Contact Center</h1>
          </div>

          {/* Form card */}
          <div className="bg-tx-s2 border border-tx-bsubtle rounded-2xl p-7 shadow-tx-md">
            <div className="mb-6">
              <h2 className="text-[18px] font-semibold text-tx-tp tracking-tight">Sign in</h2>
              <p className="text-[12.5px] text-tx-ts mt-1">Welcome back — let’s get you to the dialer.</p>
            </div>

            {/* Error message (slide-down) */}
            <div
              className={`overflow-hidden transition-all duration-300 ease-spring ${
                error ? 'max-h-20 opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'
              }`}
            >
              <div className="bg-tx-red/[0.08] border border-tx-red/20 text-tx-red px-4 py-3 rounded-xl text-[13px] flex items-start gap-2.5">
                <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username */}
              <div className="floating-label-group">
                <input
                  type="text"
                  id="login-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="floating-input w-full px-3.5 pt-[18px] pb-1.5 bg-tx-s1 border border-tx-bdefault rounded-lg text-tx-tp text-[13.5px] placeholder-transparent focus:outline-none focus:ring-2 focus:ring-tx-green/30 focus:border-tx-green/40 transition-all"
                  placeholder="Username"
                  required
                  autoFocus
                />
                <label htmlFor="login-username" className="floating-label">Username</label>
              </div>

              {/* Password */}
              <div className="floating-label-group relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="floating-input w-full px-3.5 pt-[18px] pb-1.5 pr-11 bg-tx-s1 border border-tx-bdefault rounded-lg text-tx-tp text-[13.5px] placeholder-transparent focus:outline-none focus:ring-2 focus:ring-tx-green/30 focus:border-tx-green/40 transition-all"
                  placeholder="Password"
                  required
                />
                <label htmlFor="login-password" className="floating-label">Password</label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-tt hover:text-tx-ts transition-colors p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>

              {/* Remember me */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-[18px] h-[18px] rounded-[5px] border border-tx-bdefault bg-tx-s1 peer-checked:bg-tx-green/20 peer-checked:border-tx-green/40 transition-all flex items-center justify-center">
                      <svg
                        className={`w-3 h-3 text-tx-green transition-all ${rememberMe ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <span className="text-[13px] text-tx-ts group-hover:text-tx-tp transition-colors">Remember me</span>
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-lg gradient-primary text-tx-ti font-semibold text-[13.5px] shadow-sm hover:shadow-tx-glow active:scale-[0.99] transition-all duration-150 disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-[16px] h-[16px] animate-spin" />
                    <span>Authenticating</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>

              {/* Keyboard hint */}
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-tx-tt">
                <kbd className="px-1.5 py-0.5 rounded-md bg-tx-s3 border border-tx-bdefault text-[10px] font-mono">↵</kbd>
                <span>to sign in</span>
              </div>
            </form>

            {/* Demo credentials */}
            {process.env.NEXT_PUBLIC_SHOW_DEMO_CREDS === 'true' && (
              <div className="mt-7 pt-5 border-t border-tx-bsubtle">
                <p className="text-[11px] text-tx-tt text-center mb-3 uppercase tracking-wider font-medium">Demo Credentials</p>
                <div className="grid grid-cols-3 gap-2 text-[12px]">
                  {[
                    { user: 'admin', pass: 'admin1234' },
                    { user: 'agent1', pass: 'agent1234' },
                    { user: 'agent2', pass: 'agent1234' },
                  ].map((cred) => (
                    <button
                      key={cred.user}
                      type="button"
                      onClick={() => { setUsername(cred.user); setPassword(cred.pass); }}
                      className="bg-tx-s1 hover:bg-tx-s3 border border-tx-bsubtle rounded-lg py-2 px-2 text-tx-ts hover:text-tx-tp transition-all font-medium"
                    >
                      {cred.user}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-tx-tt">
            <Lock className="w-3 h-3" />
            <span>Powered by</span>
            <span className="text-tx-green font-semibold">Telnyx</span>
            <span className="text-tx-bsubtle">·</span>
            <span>v1.0.0</span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          Styles (scoped to this page)
          ════════════════════════════════════════════════════════════ */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* ── Gradient background animation ── */
        .bg-gradient-animate {
          background: linear-gradient(
            135deg,
            rgba(99, 102, 241, 0.03) 0%,
            transparent 40%,
            rgba(165, 180, 252, 0.02) 60%,
            transparent 100%
          );
          background-size: 400% 400%;
          animation: gradientShift 12s ease infinite;
        }

        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        /* ── Particle float ── */
        @keyframes particleFloat {
          0%, 100% { transform: translateY(0px) translateX(0px); opacity: var(--p-opacity, 0.15); }
          25% { transform: translateY(-30px) translateX(10px); }
          50% { transform: translateY(-15px) translateX(-8px); opacity: calc(var(--p-opacity, 0.15) * 1.8); }
          75% { transform: translateY(-40px) translateX(5px); }
        }

        /* ── Logo glow pulse ── */
        .logo-glow-container {
          position: relative;
        }

        .logo-glow-container::before {
          content: '';
          position: absolute;
          inset: -8px;
          border-radius: 20px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%);
          animation: logoGlow 3s ease-in-out infinite;
        }

        .logo-pulse {
          animation: logoPulse 3s ease-in-out infinite;
        }

        @keyframes logoGlow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }

        @keyframes logoPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }

        /* ── Glow drift (ambient blobs) ── */
        .animate-glow-drift {
          animation: glowDrift 20s ease-in-out infinite;
        }

        .animate-glow-drift-reverse {
          animation: glowDriftReverse 25s ease-in-out infinite;
        }

        @keyframes glowDrift {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(30px, -20px); }
          66% { transform: translate(-20px, 15px); }
        }

        @keyframes glowDriftReverse {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(-25px, 20px); }
          66% { transform: translate(15px, -25px); }
        }

        /* ── Stats ticker ── */
        .ticker-scroll {
          animation: tickerScroll 30s linear infinite;
        }

        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        /* ── Shake animation ── */
        .animate-shake {
          animation: shakeError 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
        }

        @keyframes shakeError {
          0%, 100% { transform: translateX(0); }
          10% { transform: translateX(-6px); }
          20% { transform: translateX(6px); }
          30% { transform: translateX(-5px); }
          40% { transform: translateX(5px); }
          50% { transform: translateX(-3px); }
          60% { transform: translateX(3px); }
          70% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }

        /* ── Floating label ── */
        .floating-label-group {
          position: relative;
        }

        .floating-label {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 14px;
          color: #5a7a6a; /* tx-tt */
          pointer-events: none;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .floating-input:focus ~ .floating-label,
        .floating-input:not(:placeholder-shown) ~ .floating-label {
          top: 10px;
          transform: translateY(0);
          font-size: 11px;
          color: #6366f1; /* tx-green */
          font-weight: 500;
        }
      `}} />
    </div>
  );
}
