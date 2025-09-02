import React from "react";
import { Video, Users, Sparkles, Wand2, Heart, MessageCircle, Share2, Music2, Gauge, TrendingUp, AlarmClock, Link2 } from "lucide-react";

const Section = ({ id, title, icon, children }) => (
  <section
    id={id}
    className="rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur p-6 md:p-8 shadow-sm"
  >
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-xl bg-zinc-100">{icon}</div>
      <h2 className="text-xl md:text-2xl font-semibold tracking-tight">{title}</h2>
    </div>
    <div className="prose prose-zinc max-w-none">{children}</div>
  </section>
);

const Chip = ({ children }) => (
  <span className="inline-flex items-center text-xs md:text-sm rounded-full bg-zinc-100 px-3 py-1 font-medium">
    {children}
  </span>
);

const MetricTile = ({ label, hint }) => (
  <div className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col gap-1">
    <div className="text-2xl md:text-3xl font-bold tabular-nums">—</div>
    <div className="text-sm text-zinc-600">{label}</div>
    {hint ? <div className="text-xs text-zinc-400">{hint}</div> : null}
  </div>
);

export default function TikTokMVPPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-50 text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/75 backdrop-blur border-b border-zinc-200">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <div className="flex items-center justify-between py-3 md:py-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 grid place-items-center rounded-lg bg-zinc-900 text-white">
                <Video className="h-4 w-4" />
              </div>
              <span className="font-semibold tracking-tight">TikTok — MVP Brief</span>
            </div>
            <nav className="hidden md:flex gap-4 text-sm">
              <a className="hover:underline" href="#problem">Problem</a>
              <a className="hover:underline" href="#target">Users</a>
              <a className="hover:underline" href="#value">Value</a>
              <a className="hover:underline" href="#features">Features</a>
              <a className="hover:underline" href="#metrics">Metrics</a>
              <a className="hover:underline" href="#advantage">Advantage</a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 md:px-6 mt-8 md:mt-12">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 md:p-10 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-3">
              <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
                Minimum Viable Product — TikTok
              </h1>
              <p className="text-zinc-600 max-w-prose">
                A concise, product-first snapshot capturing the initial problem, value, scope, and success criteria of TikTok’s earliest incarnation.
              </p>
              <div className="flex flex-wrap gap-2">
                <Chip>Short-form video</Chip>
                <Chip>Personalized feed</Chip>
                <Chip>Lightning-fast creation</Chip>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 md:gap-3 w-full md:w-auto">
              <div className="rounded-xl border border-zinc-200 p-4 text-center">
                <Sparkles className="mx-auto h-5 w-5" />
                <div className="mt-2 text-xs text-zinc-500">Frictionless UX</div>
              </div>
              <div className="rounded-xl border border-zinc-200 p-4 text-center">
                <Users className="mx-auto h-5 w-5" />
                <div className="mt-2 text-xs text-zinc-500">Creator-led</div>
              </div>
              <div className="rounded-xl border border-zinc-200 p-4 text-center">
                <Music2 className="mx-auto h-5 w-5" />
                <div className="mt-2 text-xs text-zinc-500">Music-first</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content Sections */}
      <main className="mx-auto max-w-5xl px-4 md:px-6 mt-8 md:mt-12 mb-24 grid gap-6 md:gap-8">
        <Section id="problem" title="1. Problem" icon={<Video className="h-5 w-5" />}>
          <p>
            People—especially younger audiences—wanted a quick, entertaining, and personalized way to consume and create video content.
            Traditional platforms (YouTube, Instagram) were slower, less personalized, and less optimized for short attention spans.
          </p>
        </Section>

        <Section id="target" title="2. Target Users" icon={<Users className="h-5 w-5" />}>
          <ul>
            <li>Teenagers and young adults (initial core base)</li>
            <li>Creators who want fast virality and easy editing tools</li>
            <li>Casual viewers seeking quick, “snackable” entertainment</li>
          </ul>
        </Section>

        <Section id="value" title="3. Core Value Proposition" icon={<Sparkles className="h-5 w-5" />}>
          <p>
            A personalized short-form video platform where anyone can create, share, and discover content with minimal friction.
            The recommendation algorithm surfaces highly relevant videos, making every session addictive and engaging.
          </p>
        </Section>

        <Section id="features" title="4. Key Features (MVP Scope)" icon={<Wand2 className="h-5 w-5" />}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-zinc-200 p-4">
              <h3 className="font-medium flex items-center gap-2"><Video className="h-4 w-4"/> Short-form uploads</h3>
              <p className="text-sm text-zinc-600 mt-1">~15s videos to reduce creation friction and maximize completion rate.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4">
              <h3 className="font-medium flex items-center gap-2"><Wand2 className="h-4 w-4"/> Basic editing tools</h3>
              <p className="text-sm text-zinc-600 mt-1">Filters, music overlays, captions, and simple transitions for fast polish.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4">
              <h3 className="font-medium flex items-center gap-2"><Sparkles className="h-4 w-4"/> For You Page (FYP)</h3>
              <p className="text-sm text-zinc-600 mt-1">An AI-driven, personalized feed ranking videos by predicted enjoyment.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4">
              <h3 className="font-medium flex items-center gap-2"><Heart className="h-4 w-4"/> Engagement tools</h3>
              <p className="text-sm text-zinc-600 mt-1">Like, comment, and share primitives to reinforce feedback loops.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4 sm:col-span-2">
              <h3 className="font-medium flex items-center gap-2"><Link2 className="h-4 w-4"/> Follow system</h3>
              <p className="text-sm text-zinc-600 mt-1">Let users connect with creators and build lightweight communities.</p>
            </div>
          </div>
        </Section>

        <Section id="metrics" title="5. Success Metrics" icon={<Gauge className="h-5 w-5" />}>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            <MetricTile label="DAU / MAU" hint="Engagement ratio" />
            <MetricTile label="Avg. Session Length" hint="Stickiness" />
            <MetricTile label="Creation Rate" hint="% viewers who post" />
            <MetricTile label="Virality" hint="Shares & trend speed" />
          </div>
          <p className="text-sm text-zinc-600 mt-4">
            Early wins: rising DAU/MAU, longer sessions, and more creators posting regularly.
          </p>
        </Section>

        <Section id="advantage" title="6. Competitive Advantage" icon={<TrendingUp className="h-5 w-5" />}>
          <ul>
            <li><strong>Hyper-personalized recommendations:</strong> a best-in-class ranking system that quickly learns taste.</li>
            <li><strong>Low friction:</strong> instant playback, effortless creation, and fast iteration on trends.</li>
            <li><strong>Music integration:</strong> native audio library powering viral challenges, songs, and dances.</li>
          </ul>
        </Section>

        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg md:text-xl font-semibold">Map later feature expansions?</h3>
              <p className="text-sm text-zinc-600 max-w-prose">I can extend this MVP brief to include live streaming, e-commerce, and longer videos—showing how scope scaled while preserving the core loop.</p>
            </div>
            <button
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-zinc-900 px-4 py-2 text-white shadow-sm hover:opacity-90"
              onClick={() => alert("On it! Add sections for Live, Shops, Longer Video, and Creator Tools.")}
            >
              <AlarmClock className="h-4 w-4" /> Add Expansion Map
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-5xl px-4 md:px-6 pb-12 text-center text-xs text-zinc-500">
        Built with ❤️ in React + Tailwind.
      </footer>
    </div>
  );
}