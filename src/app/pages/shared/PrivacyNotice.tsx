import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, ShieldCheck } from 'lucide-react';
import { BrandedHeader } from '../../components/shared/BrandedHeader';
import { PRIVACY_NOTICE_EFFECTIVE_DATE, PRIVACY_NOTICE_VERSION, localTestNoticeAvailable } from '../../lib/privacy';

export function PrivacyNotice() {
  const [params]=useSearchParams();
  if(localTestNoticeAvailable(params.get('version')))return <div className="min-h-screen bg-slate-50 font-sans text-slate-800"><BrandedHeader/><main className="mx-auto max-w-4xl px-6 py-10"><article className="space-y-6 rounded-2xl border bg-white p-8 shadow-sm"><h1 className="text-3xl font-bold text-[#800000]">Local Development Privacy Notice</h1><p className="text-sm text-slate-500">Version: dev-test-only</p><p>This local InTrack instance is for development and testing. It stores account names, email addresses, role assignments, authentication-related records and test OJT records in the local database. Email codes and recovery messages are sent through the configured email provider to the address supplied for the account.</p><p>Use synthetic academic, employment and document records. Access is limited to provisioned accounts and their assigned permissions. Acknowledging this notice allows local account testing; it does not approve university processing of live internship records.</p><p>Institutional retention, hosting and production privacy approvals remain unset. Contact the local project owner about test records or access.</p><Link className="inline-block text-[#800000] underline" to="/password-decision">Return to password decision</Link></article></main></div>;
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <BrandedHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <Link to="/login" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#800000] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 bg-gradient-to-r from-[#800000] to-[#650000] px-6 py-8 text-white sm:px-10">
            <ShieldCheck className="mb-4 h-8 w-8 text-[#D4AF37]" />
            <h1 className="text-3xl font-bold">InTrack Data Privacy Notice</h1>
            <p className="mt-2 text-sm text-white/80">Version {PRIVACY_NOTICE_VERSION} · Effective {PRIVACY_NOTICE_EFFECTIVE_DATE}</p>
          </header>

          <div className="space-y-7 px-6 py-8 text-base leading-7 sm:px-10">
            <section>
              <h2 className="text-xl font-bold text-slate-900">Purpose and scope</h2>
              <p className="mt-2">The Polytechnic University of the Philippines InTrack OJT Monitoring System processes personal information needed to administer, monitor, review, and document internship activities for students, advisers, supervisors, and coordinators.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900">Information we process</h2>
              <p className="mt-2">This may include identity and contact details, PUP account information, student and program records, company placement details, attendance and location-supported entries, tasks, journals, evaluations, messages, uploaded requirements, portfolio materials, and account security records.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900">How the information is used</h2>
              <p className="mt-2">Information is used to verify access, coordinate OJT requirements, monitor attendance and progress, review submissions, communicate with participants, generate institutional reports, protect the service from abuse, and meet applicable recordkeeping obligations.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900">Sharing and retention</h2>
              <p className="mt-2">Access is limited according to assigned roles and legitimate OJT responsibilities. Information may be available to authorized PUP personnel, assigned advisers or supervisors, and service providers supporting the system, subject to appropriate safeguards. Records are retained only for as long as necessary for these purposes and applicable university requirements.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900">Your choices and rights</h2>
              <p className="mt-2">You may request appropriate access, correction, or assistance concerning your personal information. Where processing relies on consent, you may ask about withdrawing it, subject to legal, academic, and recordkeeping requirements. Declining the login consent means InTrack cannot complete the sign-in process.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900">Consent record</h2>
              <p className="mt-2">When you accept the notice during sign-in, InTrack records your account identifier, role, notice version, and acceptance date and time. You will be asked again when a materially updated notice version is released.</p>
            </section>

            <section className="rounded-xl border border-[#D4AF37]/50 bg-amber-50/60 p-5">
              <h2 className="text-xl font-bold text-slate-900">Questions or privacy requests</h2>
              <p className="mt-2">For official contact channels, policy details, and privacy requests, visit the PUP Privacy Statement.</p>
              <a href="https://www.pup.edu.ph/privacy/" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 font-semibold text-[#800000] hover:underline">
                PUP Privacy Statement <ExternalLink className="h-4 w-4" />
              </a>
            </section>
          </div>
        </article>
      </main>
    </div>
  );
}
