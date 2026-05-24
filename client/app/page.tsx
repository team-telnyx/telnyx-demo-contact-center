'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Headset } from 'lucide-react';

const STATS = [
  { label: 'Call Control', value: 'WebRTC', icon: '📞' },
  { label: 'Speech-to-Text', value: 'Live', icon: '⚡' },
  { label: 'AI Case Notes', value: 'Auto', icon: '🚀' },
  { label: 'Deploy', value: 'Docker', icon: '🌍' },
];

const FEATURES = [
  {
    title: 'Visual IVR Builder',
    desc: 'Drag-and-drop call flows. No code needed. Publish in seconds.',
    icon: '🔀',
    accent: 'from-tx-green to-tx-green-dark',
  },
  {
    title: 'AI-Powered Case Notes',
    desc: 'Automatic post-call summaries, sentiment analysis, and task extraction.',
    icon: '🤖',
    accent: 'from-tx-purple to-tx-green-dark',
  },
  {
    title: 'Live Transcription',
    desc: 'Real-time speech-to-text powered by Telnyx. See what callers say as they say it.',
    icon: '📝',
    accent: 'from-tx-blue to-tx-blue/70',
  },
  {
    title: 'WebRTC Softphone',
    desc: 'Take calls right in the browser. No hardware. No plugins. Just click.',
    icon: '📞',
    accent: 'from-tx-green-dark to-tx-citron',
  },
  {
    title: 'Smart Call Routing',
    desc: 'Priority-based ACD routes calls to the best available agent automatically.',
    icon: '📡',
    accent: 'from-tx-citron to-tx-green',
  },
  {
    title: 'Supervisor Tools',
    desc: 'Whisper mode, warm transfers, live dashboards — everything a team lead needs.',
    icon: '👁️',
    accent: 'from-tx-red to-tx-red/70',
  },
];

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (localStorage.getItem('token')) router.replace('/phone');
  }, [router]);

  return (
    <div className="min-h-screen bg-tx-s0 text-tx-tp overflow-hidden">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[20%] left-[15%] w-[500px] h-[500px] bg-tx-green/[0.06] rounded-full blur-[140px]" />
        <div className="absolute bottom-[15%] right-[10%] w-[400px] h-[400px] bg-tx-citron/[0.03] rounded-full blur-[120px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-tx-md">
            <Headset className="w-[18px] h-[18px] text-tx-ti" strokeWidth={2.2} />
          </div>
          <span className="text-lg font-bold tracking-tight">Contact Center</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-tx-green/10 text-tx-green border border-tx-green/20 ml-0.5 uppercase tracking-wider">Beta</span>
        </div>
        <button
          onClick={() => router.push('/login')}
          className="px-5 py-2 rounded-xl bg-tx-s2 border border-tx-bdefault text-[13px] font-medium text-tx-ts hover:text-tx-tp hover:border-tx-bstrong transition-all"
        >
          Sign In →
        </button>
      </nav>

      {/* Hero */}
      <div className="relative z-10 max-w-7xl mx-auto px-8 pt-20 pb-24">
        <div className="text-center max-w-3xl mx-auto">
          <div className={`transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-tx-green/[0.06] border border-tx-green/15 text-tx-green text-[13px] mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-tx-green live-dot" />
              Powered by Telnyx Call Control &amp; WebRTC
            </div>
          </div>

          <h1 className={`text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-6 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            Enterprise contact center
            <br />
            <span className="text-gradient">
              in minutes, not months
            </span>
          </h1>

          <p className={`text-lg text-tx-ts max-w-2xl mx-auto mb-10 leading-relaxed transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            Visual IVR builder, AI case notes, live transcription, WebRTC softphone —
            everything you need to run a world-class contact center, built on Telnyx.
          </p>

          <div className={`flex flex-col sm:flex-row items-center justify-center gap-3 transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <button
              onClick={() => router.push('/login')}
              className="px-7 py-3.5 rounded-xl gradient-primary text-tx-ti font-semibold text-base shadow-tx-lg hover:shadow-tx-glow hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              Launch Demo →
            </button>
            <a
              href="#features"
              className="px-7 py-3.5 rounded-xl bg-tx-s2 border border-tx-bdefault font-medium text-base text-tx-ts hover:text-tx-tp hover:border-tx-bstrong transition-all"
            >
              See Features ↓
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className={`mt-24 grid grid-cols-2 md:grid-cols-4 gap-3 transition-all duration-700 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {STATS.map((stat, i) => (
            <div key={i} className="bg-tx-s2 border border-tx-bsubtle rounded-2xl p-6 text-center hover:border-tx-bstrong transition-all duration-300 hover:-translate-y-0.5 group">
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className="text-2xl font-bold tnum">{stat.value}</div>
              <div className="text-[13px] text-tx-ts mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div id="features" className="relative z-10 max-w-7xl mx-auto px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            Everything your team needs
          </h2>
          <p className="text-tx-ts text-lg max-w-2xl mx-auto">
            A complete contact center platform. No integrations to stitch together. No vendors to juggle.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((feat, i) => (
            <div
              key={i}
              className="group relative bg-tx-s2 border border-tx-bsubtle rounded-2xl p-7 hover:border-tx-bstrong transition-all duration-300 hover:-translate-y-0.5 hover:shadow-tx-lg"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feat.accent} flex items-center justify-center text-xl mb-5 shadow-tx-sm group-hover:scale-105 transition-transform duration-200`}>
                {feat.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2 tracking-tight">{feat.title}</h3>
              <p className="text-[14px] text-tx-ts leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture */}
      <div className="relative z-10 max-w-7xl mx-auto px-8 py-16">
        <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-10 md:p-14 text-center shadow-tx-lg">
          <h2 className="text-3xl font-bold mb-2 tracking-tight">Built for the enterprise</h2>
          <p className="text-tx-ts mb-12">SIP trunking · WebRTC · AI · Everything between</p>

          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div>
              <div className="bg-tx-green/[0.06] border border-tx-green/15 rounded-xl p-5">
                <div className="text-2xl mb-2">📱</div>
                <p className="font-semibold text-[14px]">Caller</p>
                <p className="text-[12px] text-tx-tt">Dials Telnyx number</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-tx-purple/[0.06] border border-tx-purple/15 rounded-xl p-5">
                <div className="text-2xl mb-2">☁️</div>
                <p className="font-semibold text-[14px]">Telnyx Cloud</p>
                <p className="text-[12px] text-tx-tt">Call Control · WebRTC · SIP</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-tx-citron/[0.06] border border-tx-citron/15 rounded-lg p-3 text-[12px]">
                  <p className="font-medium">🤖 STT</p>
                </div>
                <div className="bg-tx-green/[0.06] border border-tx-green/15 rounded-lg p-3 text-[12px]">
                  <p className="font-medium">🧠 AI Notes</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-tx-green/[0.06] border border-tx-green/15 rounded-xl p-5">
                <div className="text-2xl mb-2">👩‍💼</div>
                <p className="font-semibold text-[14px]">Agent</p>
                <p className="text-[12px] text-tx-tt">WebRTC softphone</p>
              </div>
              <div className="bg-tx-citron/[0.06] border border-tx-citron/15 rounded-lg p-3 text-[12px]">
                <p className="font-medium">👁️ Supervisor</p>
                <p className="text-tx-tt">Whisper · Monitor</p>
              </div>
            </div>
          </div>

          <div className="mt-8 text-tx-tt text-sm tracking-wider">── · ── · ──</div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-tx-bsubtle py-8 text-center text-[13px] text-tx-tt">
        <p>Built with ❤️ by Telnyx · <a href="https://telnyx.com" className="text-tx-green hover:text-tx-green-hi transition">telnyx.com</a></p>
      </footer>
    </div>
  );
}
