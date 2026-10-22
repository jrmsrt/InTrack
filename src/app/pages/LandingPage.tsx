import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react';

const pylonImage = 'https://www.pup.edu.ph/about/images/pylon2022.jpg';

export function LandingPage() {
  const navigate = useNavigate();

  const stats = [
    { count: '01', label: 'Connected user roles' },
    { count: '02', label: 'Organized OJT Stage Process' },
    { count: '03', label: 'Unified Workspace' },
  ];

  const roleHighlights = [
    {
      icon: Users,
      title: 'For students',
      description: 'Keep deployment requirements, attendance, daily tasks, weekly journals, and portfolio progress in one clear view.',
    },
    {
      icon: ClipboardCheck,
      title: 'For advisers',
      description: 'Review submissions, monitor rendered hours, and guide students with timely feedback throughout their placement.',
    },
    {
      icon: Building2,
      title: 'For coordinators',
      description: 'Manage student records, host establishments, MOAs, templates, and program-wide compliance from one place.',
    },
  ];

  const workflowItems = [
    { icon: FileText, label: 'Pre-OJT requirements and MOA routing' },
    { icon: MapPin, label: 'Location-aware attendance and DTR records' },
    { icon: ClipboardCheck, label: 'Task logs and weekly journal review' },
    { icon: BarChart3, label: 'Progress dashboards and completion reports' },
  ];

  return (
    <div className="min-h-screen overflow-hidden bg-white font-sans text-[#2b1111]">
      <main className="mx-auto max-w-[1600px] px-3 pt-3 sm:px-5 sm:pt-5">
        <section className="relative isolate min-h-[680px] overflow-hidden rounded-[28px] border border-[#d4af37]/20 bg-[#260000] shadow-[0_28px_100px_rgba(30,0,0,0.45)] sm:min-h-[740px] lg:min-h-[790px]">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-20 bg-cover bg-[center_43%]"
            style={{ backgroundImage: `url('${pylonImage}')` }}
          />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(45,0,0,0.99)_0%,rgba(91,0,0,0.94)_39%,rgba(91,0,0,0.66)_62%,rgba(35,0,0,0.2)_100%)]" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_70%_78%,rgba(212,175,55,0.2),transparent_38%),linear-gradient(0deg,rgba(35,0,0,0.65),transparent_36%)]" />
          <div aria-hidden="true" className="absolute -right-24 top-28 -z-10 h-80 w-80 rounded-full bg-[#d4af37]/15 blur-[100px]" />

          <header className="mx-auto flex max-w-[1320px] items-center justify-between gap-5 px-5 py-5 sm:px-9 sm:py-7 lg:px-14">
            <Link to="/" className="group flex min-w-0 items-center gap-3" aria-label="InTrack home">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#d4af37]/35 bg-[#800000]/45 p-1.5 shadow-lg backdrop-blur-md sm:h-14 sm:w-14">
                <img src="/pup-logo.png" alt="PUP seal" className="h-full w-full object-contain" />
              </span>
              <span className="min-w-0 leading-tight">
                <span
                  className="block truncate text-[10px] font-bold uppercase tracking-[0.19em] text-white/85 sm:text-xs"
                  style={{ fontFamily: '"Trajan Pro", "Times New Roman", serif' }}
                >
                  Polytechnic University of the Philippines
                </span>
              </span>
            </Link>

            <nav className="hidden items-center gap-8 text-sm font-medium text-white/70 lg:flex" aria-label="Main navigation">
              <a className="transition hover:text-white" href="#overview">About InTrack</a>
              <a className="transition hover:text-white" href="#workflow">How it works</a>
              <a className="transition hover:text-white" href="#roles">Who it serves</a>
            </nav>

            <button
              onClick={() => navigate('/login')}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#f1d77e]/70 bg-gradient-to-r from-[#f0cf62] to-[#d4af37] px-4 py-2.5 text-xs font-bold text-[#4a0000] shadow-[0_8px_30px_rgba(212,175,55,0.22)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#510000] sm:px-6 sm:text-sm"
            >
              Sign in <ArrowRight className="h-4 w-4" />
            </button>
          </header>

          <div className="mx-auto grid min-h-[565px] max-w-[1320px] items-center px-6 pb-16 pt-10 sm:min-h-[590px] sm:px-10 sm:pb-20 lg:min-h-[620px] lg:grid-cols-[1.04fr_0.96fr] lg:px-14 lg:pb-24 lg:pt-8">
            <div className="relative z-10 max-w-[650px]">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#f0d98b]/25 bg-[#800000]/35 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f8e9b4] backdrop-blur-md sm:text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-[#f0d36e] shadow-[0_0_12px_#f0d36e]" />
                PUP OJT monitoring system
              </div>
              <h1 className="max-w-[650px] text-[2.7rem] font-semibold leading-[1.04] tracking-[-0.055em] text-white sm:text-6xl lg:text-[4.55rem]">
                InTrack for <span className="bg-gradient-to-r from-[#f9e7a5] via-[#e8c85d] to-[#c89b24] bg-clip-text text-transparent">OJT Monitoring</span>
              </h1>
              <p className="mt-6 max-w-[560px] text-sm leading-7 text-white/80 sm:mt-7 sm:text-base sm:leading-8">
                InTrack supports students, advisers, and coordinators in recording requirements, attendance, journals, and progress throughout on-the-job training.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={() => navigate('/login')}
                className="inline-flex items-center justify-center gap-3 rounded-full border border-[#f1d77e]/80 bg-gradient-to-r from-[#f0cf62] to-[#d4af37] px-6 py-3.5 text-sm font-bold text-[#4a0000] shadow-[0_12px_36px_rgba(212,175,55,0.2)] transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#510000]"
                >
                  Log in to InTrack <ArrowRight className="h-4 w-4" />
                </button>
                <a href="#overview" className="inline-flex items-center justify-center gap-2 rounded-full border border-[#f0d98b]/45 bg-[#800000]/25 px-6 py-3.5 text-sm font-semibold text-white/90 backdrop-blur-sm transition hover:border-[#f0d98b]/75 hover:bg-[#800000]/45">
                  View system overview <ArrowDown className="h-4 w-4" />
                </a>
              </div>
              <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/55 sm:mt-12">
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#e3c04f]" /> Role-based access</span>
                <span className="hidden h-1 w-1 rounded-full bg-white/35 sm:block" />
                <span>For students, advisers, and coordinators</span>
              </div>
            </div>

            <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 top-24 hidden w-[52%] lg:block">
              <div className="absolute inset-y-10 left-0 w-24 bg-gradient-to-r from-[#510000] to-transparent" />
              <div className="absolute bottom-12 right-12 rounded-2xl border border-[#f0d98b]/30 bg-[#510000]/65 px-4 py-3 shadow-xl backdrop-blur-md xl:right-20">
                <span className="block text-[10px] uppercase tracking-[0.2em] text-[#f0d98b]/65">One connected journey</span>
                <span className="mt-1 block text-sm font-semibold text-white">Student · Adviser · Coordinator</span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d4af37]/60 to-transparent" />
        </section>

        <section className="relative z-10 mx-auto -mt-1 grid max-w-[1240px] grid-cols-1 gap-px overflow-hidden rounded-2xl border border-[#d4af37]/20 bg-[#d4af37]/20 shadow-[0_20px_60px_rgba(30,0,0,0.24)] backdrop-blur-xl sm:grid-cols-3">
          {stats.map((stat, index) => (
            <div key={stat.label} className="flex items-center gap-4 bg-[#3b0000]/95 px-6 py-5 sm:justify-center sm:py-6">
              <span className="text-3xl font-semibold tracking-tight text-[#e3c04f]">{stat.count}</span>
              <span className="text-xs font-medium leading-5 text-white/65 sm:text-sm">{stat.label}</span>
              {index < stats.length - 1 && <span className="hidden" />}
            </div>
          ))}
        </section>

        <section id="overview" className="mx-auto grid max-w-[1240px] scroll-mt-10 gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-16">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.23em] text-[#800000]">About InTrack</span>
            <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.035em] text-[#3b0909] sm:text-4xl">A clearer path through every OJT stage.</h2>
            <p className="mt-5 leading-7 text-slate-600">
              From pre-deployment clearance to final portfolio review, InTrack keeps the records and people behind your internship journey connected.
            </p>
            <p className="mt-4 leading-7 text-slate-600">
              Follow requirements, company placement, rendered hours, adviser feedback, and submissions through a shared, easy-to-follow workspace.
            </p>
          </div>

          <div id="workflow" className="scroll-mt-10 rounded-[26px] border border-[#d4af37]/35 bg-gradient-to-br from-[#800000] to-[#4b0000] p-5 shadow-2xl sm:p-7">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#e3c04f]/25 bg-[#d4af37]/10 text-[#f0d98b]"><ShieldCheck className="h-5 w-5" /></div>
              <div>
                <h3 className="font-semibold text-white">Everything in its place</h3>
                <p className="mt-1 text-sm leading-6 text-white/60">The right records, connected to each student profile and OJT stage.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {workflowItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex min-h-[76px] items-start gap-3 rounded-2xl border border-white/10 bg-[#360000] p-4">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#e3c04f]" />
                    <span className="text-sm leading-5 text-white/80">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="roles" className="mx-auto max-w-[1240px] scroll-mt-10 px-5 pb-20 sm:px-8 sm:pb-28">
          <div className="mb-8 max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-[0.23em] text-[#800000]">One platform, three perspectives</span>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-[#3b0909] sm:text-4xl">Made for the people who make OJT work.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {roleHighlights.map((item, index) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="group rounded-[24px] border border-[#6b0000] bg-[#800000] p-6 transition duration-300 hover:-translate-y-1 hover:border-[#d4af37]/60 hover:bg-[#6b0000] sm:p-7">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d4af37]/25 bg-[#d4af37]/10 text-[#f0d98b] transition group-hover:bg-[#d4af37]/20"><Icon className="h-5 w-5" /></div>
                  <span className="text-xs font-semibold tracking-[0.18em] text-[#f0d98b]/45">0{index + 1}</span>
                  </div>
                  <h3 className="mt-6 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/65">{item.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto mb-14 max-w-[1176px] overflow-hidden rounded-[28px] border border-[#d4af37]/25 bg-gradient-to-r from-[#510000] via-[#800000] to-[#4b0000] px-6 py-8 sm:px-10 sm:py-10">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.23em] text-[#f0d98b]">Program coverage</span>
              <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.03em] text-white sm:text-3xl">From first requirement to final completion.</h2>
              <p className="mt-4 text-sm leading-6 text-white/70">A connected view of the work, records, and milestones that move an internship forward.</p>
            </div>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {[
                'Student masterlists and account activation',
                'Company placements and GPS boundaries',
                'MOA tracking and review history',
                'Pre-, During-, and Post-OJT checklists',
                'Attendance, rendered hours, and DTRs',
                'Journals, evaluations, and announcements',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm leading-5 text-white/85">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#e3c04f]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-5 py-7 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} InTrack · OJT Monitoring System · Polytechnic University of the Philippines
      </footer>
    </div>
  );
}
