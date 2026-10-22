import React, { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { DailyTask, WeeklyJournal as WeeklyJournalRecord, useOJT } from '../../context/OJTContext';

type WeeklyJournalExport = {
  studentId: string;
  journal: WeeklyJournalRecord;
  reflection: string;
  problems: string;
  assignedDepartment: string;
};

function formatTaskList(tasks: DailyTask[]) {
  if (tasks.length === 0) return '';
  return tasks.map(task => `${task.date}: ${task.title} - ${task.description}${task.output ? ` Output: ${task.output}.` : ''}`).join('\n\n');
}

function formatProblems(tasks: DailyTask[], fallback: string) {
  const taskProblems = tasks
    .map(task => task.problemsEncountered?.trim())
    .filter(Boolean)
    .filter(problem => problem.toLowerCase() !== 'none');
  return [...taskProblems, fallback].filter(Boolean).join('\n\n') || 'None';
}

function formatSkills(tasks: DailyTask[], reflection: string) {
  const skills = tasks
    .map(task => task.skillsApplied?.trim())
    .filter(Boolean);
  return [...skills, reflection].filter(Boolean).join('\n\n') || 'Not specified in daily task logs.';
}

export function PrintWeeklyJournal() {
  const { journalId } = useParams<{ journalId: string }>();
  const [searchParams] = useSearchParams();
  const { students, companies } = useOJT();
  const isPreview = searchParams.get('preview') === '1';
  const previewZoom = Number(searchParams.get('zoom') || '0.78');

  const exportData = (() => {
    if (!journalId) return null;
    try {
      const stored = sessionStorage.getItem(`weeklyJournal:${journalId}`);
      return stored ? JSON.parse(stored) as WeeklyJournalExport : null;
    } catch {
      return null;
    }
  })();

  const student = students.find(s =>
    s.studentId === exportData?.studentId ||
    s.weeklyJournals.some(journal => journal.id === journalId)
  );
  const savedJournal = student?.weeklyJournals.find(journal => journal.id === journalId);
  const journal = exportData?.journal || savedJournal;
  const company = student ? companies.find(c => c.id === student.companyId) : null;

  useEffect(() => {
    if (!journal || isPreview) return;
    const timer = setTimeout(() => window.print(), 800);
    return () => clearTimeout(timer);
  }, [journal, isPreview]);

  if (!journal || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-6">
        <div className="max-w-md w-full text-center space-y-4 bg-white p-8 border rounded-lg shadow-sm">
          <AlertCircle className="h-12 w-12 text-red-650 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">Weekly Journal Not Found</h2>
          <p className="text-slate-500 text-xs font-normal">The generated weekly journal could not be loaded.</p>
        </div>
      </div>
    );
  }

  const tasks = Array.isArray(journal.tasks) ? journal.tasks : [];
  const reflection = exportData?.reflection || journal.reflection || '';
  const problems = exportData?.problems || journal.problems || '';
  const department = exportData?.assignedDepartment || 'OJT Department';

  return (
    <div className={`weekly-print-root ${isPreview ? 'preview-mode' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        .weekly-print-root,
        .weekly-print-root * {
          box-sizing: border-box;
        }

        .weekly-print-root {
          background: #f8fafc;
          color: #111;
          min-height: 100vh;
          padding: 20px;
          font-family: Arial, Helvetica, sans-serif;
        }

        .no-print-btn {
          max-width: 8.5in;
          margin: 0 auto 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: white;
          padding: 10px 12px;
          font-size: 12px;
        }

        .print-button {
          background: #800000;
          color: white;
          border: 0;
          border-radius: 4px;
          padding: 7px 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .journal-page {
          width: 8.5in;
          min-height: 12.7in;
          margin: 0 auto;
          background: white;
          padding: 0.35in 0.5in 0.28in;
          overflow: hidden;
          box-shadow: 0 0 0 1px #cbd5e1;
        }

        .weekly-print-root.preview-mode {
          min-height: 0;
          padding: 8px;
          overflow: auto;
        }

        .weekly-print-root.preview-mode .journal-page {
          transform: scale(${Number.isFinite(previewZoom) ? previewZoom : 0.78});
          transform-origin: top left;
          margin: 0;
        }

        .campus-header {
          display: grid;
          grid-template-columns: 1.05in 1fr 1.05in;
          gap: 0.14in;
          align-items: start;
          margin-bottom: 0.18in;
        }

        .seal {
          width: 0.95in;
          height: 0.95in;
          object-fit: contain;
        }

        .header-text {
          text-align: left;
          line-height: 1.05;
        }

        .header-text p {
          margin: 0;
          font-family: "Times New Roman", serif;
          font-size: 12px;
        }

        .header-text h1 {
          margin: 0.02in 0;
          font-family: "Times New Roman", serif;
          font-size: 18px;
          line-height: 1;
          font-weight: 800;
        }

        .flag-logo {
          width: 0.95in;
          height: 0.95in;
          object-fit: contain;
          justify-self: end;
        }

        .form-title {
          border: 1.4px solid #111;
          display: grid;
          grid-template-columns: 1.05in 1fr 2.6in;
          min-height: 1.08in;
          margin-bottom: 0.08in;
        }

        .form-title > div {
          border-right: 1.4px solid #111;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 18px;
        }

        .form-title > div:last-child {
          border-right: 0;
        }

        .form-title .small-seal {
          width: 0.72in;
          height: 0.72in;
          object-fit: contain;
        }

        .program-row,
        .subject-row {
          border: 1.4px solid #111;
          border-top: 0;
          display: grid;
          grid-template-columns: 1fr 2.6in;
          font-size: 13px;
          min-height: 0.25in;
          align-items: center;
        }

        .program-row > div,
        .subject-row > div {
          padding: 0.03in 0.18in;
          border-right: 1.4px solid #111;
        }

        .program-row > div:last-child,
        .subject-row > div:last-child {
          border-right: 0;
        }

        .info-box {
          border: 1.4px solid #111;
          margin-top: 0.08in;
          padding: 0.12in 0.72in 0.06in;
          font-size: 13px;
          line-height: 1.18;
        }

        .detail-row {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: end;
          column-gap: 0.03in;
          margin-bottom: 0.015in;
        }

        .detail-row.two-up {
          grid-template-columns: auto minmax(0, 1.35fr) auto minmax(0, 0.8fr);
          column-gap: 0.035in;
        }

        .detail-label {
          white-space: nowrap;
        }

        .line-fill {
          border-bottom: 1px solid #111;
          display: inline-block;
          min-width: 0;
          width: 100%;
          padding: 0 0.04in;
          line-height: 1.08;
          min-height: 0.15in;
          white-space: normal;
          overflow-wrap: anywhere;
          word-break: normal;
        }

        .journal-heading {
          text-align: center;
          margin: 0.12in 0 0.08in;
          font-family: "Times New Roman", serif;
          font-size: 18px;
          letter-spacing: 0.02in;
        }

        .journal-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 11.5px;
        }

        .journal-table th,
        .journal-table td {
          border: 1.4px solid #111;
          vertical-align: top;
          padding: 0.06in;
        }

        .journal-table th {
          text-align: center;
          font-weight: 400;
          vertical-align: middle;
          line-height: 1.05;
        }

        .meta-row th {
          height: 0.43in;
        }

        .column-row th {
          height: 0.42in;
        }

        .body-row td {
          height: 5.65in;
          white-space: pre-wrap;
          line-height: 1.18;
        }

        .noted-supervisor {
          height: 1.64in;
          vertical-align: top;
          padding: 0 !important;
        }

        .noted-supervisor-inner {
          min-height: 1.64in;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 0.06in;
        }

        .supervisor {
          text-align: center;
          font-size: 13px;
          line-height: 1.15;
        }

        .supervisor-signature {
          display: block;
          width: 2.6in;
          max-width: 90%;
          border-bottom: 1.4px solid #111;
          margin: 0 auto 0.04in;
          min-height: 0.16in;
        }

        .footer {
          margin-top: 0.22in;
          padding-left: 0.5in;
          display: grid;
          grid-template-columns: 3.18in 1fr;
          gap: 0.08in;
          align-items: start;
          font-size: 9.5px;
          line-height: 1.1;
          width: 100%;
        }

        .footer strong {
          display: block;
          font-family: "Trajan Pro", serif;
          font-size: 18px;
          line-height: 1.05;
          margin-top: 0.04in;
        }

        .footer-email {
          color: #0645ad;
          text-decoration: underline;
        }

        .footer-art {
          width: 100%;
          max-width: 3.95in;
          height: auto;
          object-fit: contain;
          justify-self: end;
        }

        .one-line-field {
          white-space: nowrap;
        }

        .one-line-field .line-fill {
          width: auto;
          min-width: 0.45in;
          vertical-align: baseline;
        }

        @media print {
          @page {
            size: 8.5in 13in;
            margin: 0.15in;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: white;
            overflow: hidden;
          }

          .weekly-print-root {
            padding: 0;
            width: 8.2in;
            height: 12.7in;
            min-height: 0;
            overflow: hidden;
            background: white;
          }

          .no-print-btn {
            display: none;
          }

          .journal-page {
            width: 8.2in;
            height: 12.7in;
            min-height: 0;
            box-shadow: none;
            overflow: hidden;
            padding: 0.2in 0.38in 0.15in;
            page-break-after: avoid;
            break-after: avoid;
          }

          .campus-header {
            margin-bottom: 0.1in;
          }

          .form-title {
            min-height: 0.85in;
            margin-bottom: 0.04in;
          }

          .info-box {
            margin-top: 0.05in;
            padding: 0.08in 0.58in 0.045in;
            font-size: 11.5px;
            line-height: 1.08;
          }

          .journal-heading {
            margin: 0.08in 0 0.05in;
            font-size: 16px;
          }

          .meta-row th {
            height: 0.34in;
          }

          .column-row th {
            height: 0.34in;
          }

          .body-row td {
            height: 5.65in;
            font-size: 9.4px;
            line-height: 1.08;
            padding: 0.04in;
          }

          .noted-supervisor {
            height: 1.08in;
          }

          .noted-supervisor-inner {
            min-height: 1.08in;
            padding: 0.04in;
          }

          .supervisor {
            font-size: 10.5px;
          }

          .supervisor-signature {
            width: 2.25in;
            min-height: 0.12in;
            margin-bottom: 0.025in;
          }

          .footer {
            margin-top: 0.08in;
            font-size: 8.2px;
            grid-template-columns: 2.95in 1fr;
            gap: 0.06in;
            align-items: start;
            width: 100%;
          }

          .footer strong {
            font-size: 13px;
          }

          .seal,
          .flag-logo {
            width: 0.9in;
            height: 0.9in;
          }

          .footer-art {
            width: 100%;
            max-width: 3.55in;
          }
        }
      ` }} />

      {!isPreview && (
        <div className="no-print-btn">
          <span>Print mode ready. Use Print / Save PDF to download the completed Weekly Journal.</span>
          <button className="print-button" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      )}

      <main className="journal-page">
        <header className="campus-header">
          <img src="/pup-logo.png" alt="" className="seal" />
          <div className="header-text">
            <p>REPUBLIC OF THE PHILIPPINES</p>
            <h1>POLYTECHNIC UNIVERSITY OF THE PHILIPPINES</h1>
            <p>OFFICE OF THE VICE PRESIDENT FOR CAMPUSES</p>
            <h1>PARANAQUE CITY CAMPUS</h1>
          </div>
          <img src="/bagong-pilipinas.png" alt="" className="flag-logo" />
        </header>

        <section className="form-title">
          <div><img src="/pup-logo.png" alt="" className="small-seal" /></div>
          <div>WEEKLY JOURNAL REPORT</div>
          <div>FORM 4</div>
        </section>
        <section className="program-row">
          <div>Program: <strong>On the Job Training Program</strong></div>
          <div>Semester:</div>
        </section>
        <section className="subject-row">
          <div>Subject: <strong>Weekly Journal Report</strong></div>
          <div />
        </section>

        <section className="info-box">
          <div className="detail-row two-up">
            <span className="detail-label">Name of Trainee:</span><span className="line-fill">{student.name}</span>
            <span className="detail-label">Year and Section:</span><span className="line-fill">{student.section}</span>
          </div>
          <div className="detail-row"><span className="detail-label">Company:</span><span className="line-fill">{company?.name || student.companyName}</span></div>
          <div className="detail-row"><span className="detail-label">Address:</span><span className="line-fill">{company?.address || ''}</span></div>
          <div className="detail-row two-up">
            <span className="detail-label">Training Supervisor:</span><span className="line-fill">{company?.contactPerson || ''}</span>
            <span className="detail-label">Contact Numbers:</span><span className="line-fill">{company?.contactNumber || ''}</span>
          </div>
          <div>Instruction: Briefly discuss here your accomplished tasks and activities and the corresponding new skills learned and applied as well as any problem/difficulty encountered in any given area/department.</div>
        </section>

        <h2 className="journal-heading">WEEKLY JOURNAL REPORT</h2>

        <table className="journal-table">
          <colgroup>
            <col style={{ width: '16%' }} />
            <col style={{ width: '16.5%' }} />
            <col style={{ width: '16.5%' }} />
            <col style={{ width: '26%' }} />
            <col style={{ width: '25%' }} />
          </colgroup>
          <tbody>
            <tr className="meta-row">
              <th>Training Period</th>
              <th className="one-line-field">Week No. <span className="line-fill">{journal.weekNumber}</span></th>
              <th className="one-line-field">From <span className="line-fill">{journal.startDate}</span></th>
              <th className="one-line-field">To <span className="line-fill">{journal.endDate}</span></th>
              <th>Assigned Department:<br />{department}</th>
            </tr>
            <tr className="column-row">
              <th colSpan={3}>Assigned Tasks</th>
              <th>Any Problem/s/ Difficulty Encountered (if any)</th>
              <th>Relevant Skills/Competencies Learned/Applied</th>
            </tr>
            <tr className="body-row">
              <td colSpan={3}>{formatTaskList(tasks)}</td>
              <td>{formatProblems(tasks, problems)}</td>
              <td>{formatSkills(tasks, reflection)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="noted-supervisor">
                <div className="noted-supervisor-inner">
                  <span>Noted:</span>
                  <span className="supervisor">
                    <span className="supervisor-signature">{company?.contactPerson || ''}</span>
                    Company Training Supervisor
                  </span>
                </div>
              </td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <footer className="footer">
          <div>
            PUP Paranaque Campus, Col. E de Leon St. Wawa,<br />
            Brgy. Sto. Nino, Paranaque City<br />
            Direct line: (02) 8553 8623 | Email: <span className="footer-email">paranaque@pup.edu.ph</span><br />
            Website: www.pup.edu.ph | Inquiries: https://bit.ly/PUPSINTA
            <strong>A LEADING COMPREHENSIVE<br />POLYTECHNIC UNIVERSITY IN ASIA</strong>
          </div>
          <img src="/weekly-journal-footer.png" alt="" className="footer-art" />
        </footer>
      </main>
    </div>
  );
}
