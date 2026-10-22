import React, { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { DTRRecord, useOJT } from '../../context/OJTContext';

export function PrintDTR() {
  const { dtrId } = useParams<{ dtrId: string }>();
  const [searchParams] = useSearchParams();
  const { students, companies } = useOJT();
  const isPreview = searchParams.get('preview') === '1';

  const generatedExport = (() => {
    if (!dtrId) return null;
    try {
      const stored = sessionStorage.getItem(`generatedDtr:${dtrId}`);
      return stored ? JSON.parse(stored) as { studentId: string; dtr: DTRRecord } : null;
    } catch {
      return null;
    }
  })();

  const student = students.find(s =>
    (s.dtrHistory || []).some(d => d.id === dtrId) ||
    s.studentId === generatedExport?.studentId
  );
  const dtr = student?.dtrHistory?.find(d => d.id === dtrId) || generatedExport?.dtr;
  const company = student ? companies.find(c => c.id === student.companyId) : null;

  useEffect(() => {
    if (!dtr || isPreview) return;
    const timer = setTimeout(() => window.print(), 800);
    return () => clearTimeout(timer);
  }, [dtr, isPreview]);

  if (!dtr || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-6">
        <div className="max-w-md w-full text-center space-y-4 bg-white p-8 border rounded-lg shadow-sm">
          <AlertCircle className="h-12 w-12 text-red-650 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">DTR Record Not Found</h2>
          <p className="text-slate-500 text-xs font-normal">
            We could not retrieve the requested Daily Time Record details. Please verify the DTR ID.
          </p>
        </div>
      </div>
    );
  }

  const logs = Array.isArray(dtr.logs) ? dtr.logs : [];

  const start = new Date(dtr.startDate);
  const monthName = Number.isNaN(start.getTime())
    ? (dtr.month || '').replace(/\s+\d{4}$/, '')
    : start.toLocaleString('en-US', { month: 'long' });
  const yearSuffix = Number.isNaN(start.getTime())
    ? (dtr.month || '').match(/\d{4}/)?.[0].slice(-2) || ''
    : String(start.getFullYear()).slice(-2);

  const getLogForDay = (day: number) => {
    const paddedDay = day < 10 ? `0${day}` : `${day}`;
    return logs.find(log => log.date.split('-')[2] === paddedDay);
  };

  const formatCellTime = (value?: string | null) => {
    if (!value) return '';
    const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?$/i);
    if (!match) return value.trim().replace(/\s+/g, ' ');
    let hour = Number(match[1]);
    const minute = match[2];
    const period = match[3]?.toUpperCase();
    if (period === 'PM' && hour > 12) hour -= 12;
    if (period === 'AM' && hour === 0) hour = 12;
    return `${hour}:${minute}`;
  };

  const officialStart = formatCellTime(logs[0]?.timeIn);
  const officialEnd = formatCellTime([...logs].reverse().find(log => log.timeOut)?.timeOut);

  const DTRSlip = ({ copyIndex }: { copyIndex: number }) => (
    <section className={`dtr-slip ${copyIndex < 2 ? 'with-divider' : ''}`}>
      <div className="title-block">
        <h1>DAILY TIME RECORD</h1>
        <p>-----o0o-----</p>
      </div>

      <div className="top-rule" />

      <div className="meta-grid">
        <div className="meta-left">
          <p>For the month of</p>
          <p>Official hours of</p>
          <p>arrival and departure</p>
        </div>
        <div className="meta-right">
          <div className="month-row">
            <span className="line month-line">{monthName}</span>
            <span>20</span>
            <span className="line year-line">{yearSuffix}</span>
          </div>
          <div className="hours-row">
            <span className="line hours-line">{officialStart}</span>
            <span>Regular days</span>
            <span className="line hours-line">{officialEnd}</span>
          </div>
          <div className="hours-row">
            <span className="line hours-line">&nbsp;</span>
            <span>Saturdays</span>
            <span className="line hours-line">&nbsp;</span>
          </div>
        </div>
      </div>

      <table className="dtr-table">
        <colgroup>
          <col className="col-day" />
          <col className="col-am-arrival" />
          <col className="col-am-departure" />
          <col className="col-pm-arrival" />
          <col className="col-pm-departure" />
          <col className="col-under-hours" />
          <col className="col-under-minutes" />
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} className="day-col">Day</th>
            <th colSpan={2}>A.M.</th>
            <th colSpan={2}>P.M.</th>
            <th colSpan={2}>Undertime</th>
          </tr>
          <tr>
            <th>Arrival</th>
            <th>Departure</th>
            <th>Arrival</th>
            <th>Departure</th>
            <th>Hours</th>
            <th>Minutes</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 31 }, (_, index) => {
            const day = index + 1;
            const log = getLogForDay(day);
            return (
              <tr key={day}>
                <td>{day}</td>
                <td className="time-cell">{formatCellTime(log?.timeIn)}</td>
                <td className="time-cell">{log ? '12:00' : ''}</td>
                <td className="time-cell">{log ? '1:00' : ''}</td>
                <td className="time-cell">{formatCellTime(log?.timeOut)}</td>
                <td />
                <td />
              </tr>
            );
          })}
          <tr className="total-row">
            <td />
            <td colSpan={4}>TOTAL</td>
            <td />
            <td />
          </tr>
        </tbody>
      </table>

      <p className="certification">
        I certify on my honor that the above is true and correct report of the hours of work performed, record of which was made daily at the time of arrival and departure from office.
      </p>

      <div className="signature-line" />
      <p className="verified">VERIFIED as to the prescribed office hours</p>

      <p className="noted">Noted by:</p>
      <div className="signature-line lower-line">{company?.contactPerson || ''}</div>
      <p className="supervisor">Training Supervisor</p>
    </section>
  );

  return (
    <div className="print-root">
      <style dangerouslySetInnerHTML={{ __html: `
        .print-root {
          background: white;
          color: black;
          min-height: 100vh;
          padding: 18px;
          font-family: Arial, Helvetica, sans-serif;
        }

        .print-root,
        .print-root * {
          box-sizing: border-box;
        }

        .no-print-btn {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1100px;
          margin: 0 auto 16px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 10px 12px;
          font-size: 12px;
          color: #334155;
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

        .dtr-page {
          width: 100%;
          max-width: 1320px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0;
          overflow: hidden;
        }

        .dtr-slip {
          position: relative;
          padding: 12px 26px 0;
          min-height: 945px;
          overflow: hidden;
        }

        .with-divider {
          border-right: 1.5px solid #111;
        }

        .title-block {
          text-align: center;
          height: 75px;
        }

        .title-block h1 {
          margin: 0;
          font-size: 20px;
          letter-spacing: 0;
          line-height: 1.1;
          font-weight: 800;
        }

        .title-block p {
          margin: 7px 0 0;
          font-size: 12px;
          font-weight: 700;
        }

        .top-rule {
          height: 2px;
          background: #111;
          margin: 0 0 22px;
        }

        .meta-grid {
          display: grid;
          grid-template-columns: 38% 62%;
          gap: 8px;
          margin-bottom: 20px;
          font-size: 13px;
          font-style: italic;
          line-height: 1.25;
        }

        .meta-left p {
          margin: 0 0 3px;
        }

        .meta-right {
          display: grid;
          gap: 5px;
        }

        .month-row,
        .hours-row {
          display: grid;
          grid-template-columns: 1fr auto 72px;
          align-items: end;
          gap: 8px;
        }

        .hours-row {
          grid-template-columns: 1fr 86px 78px;
        }

        .line {
          border-bottom: 2px solid #111;
          min-height: 16px;
          text-align: center;
          font-style: normal;
          font-size: 11px;
          font-weight: 600;
        }

        .dtr-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 11px;
        }

        .col-day {
          width: 10.5%;
        }

        .col-am-arrival,
        .col-pm-arrival {
          width: 13.25%;
        }

        .col-am-departure,
        .col-pm-departure {
          width: 17.2%;
        }

        .col-under-hours {
          width: 12.6%;
        }

        .col-under-minutes {
          width: 15.6%;
        }

        .dtr-table th,
        .dtr-table td {
          border: 1.5px solid #111;
          text-align: center;
          height: 16px;
          padding: 0 2px;
          line-height: 1;
          vertical-align: middle;
        }

        .dtr-table td.time-cell {
          font-size: 8.25px;
          font-family: Arial Narrow, Arial, Helvetica, sans-serif;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          overflow: hidden;
          padding-left: 1px;
          padding-right: 1px;
        }

        .dtr-table th {
          font-weight: 800;
          height: 18px;
        }

        .dtr-table thead tr:nth-child(2) th {
          font-weight: 400;
          font-size: 9px;
        }

        .day-col,
        .dtr-table tbody td:first-child {
          width: 36px;
        }

        .total-row td {
          height: 18px;
          font-weight: 800;
        }

        .certification {
          margin: 4px 6px 34px;
          font-size: 11px;
          font-style: italic;
          line-height: 1.28;
          text-align: left;
        }

        .signature-line {
          border-bottom: 2px solid #111;
          height: 18px;
          text-align: center;
          font-size: 11px;
          font-weight: 600;
          line-height: 18px;
        }

        .verified {
          margin: 2px 0 20px;
          text-align: center;
          font-size: 11px;
          font-style: italic;
        }

        .noted {
          margin: 0 0 22px 14px;
          font-size: 11px;
          font-style: italic;
        }

        .lower-line {
          margin-top: 0;
        }

        .supervisor {
          margin: 5px 0 0;
          text-align: center;
          font-size: 12px;
          font-style: italic;
        }

        @media print {
          @page {
            size: letter landscape;
            margin: 0.25in;
          }

          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: white;
            overflow: hidden;
            width: auto;
            height: auto;
          }

          .print-root {
            padding: 0;
            width: 10.5in;
            height: 7.92in;
            min-height: 0;
            overflow: hidden;
            page-break-after: avoid;
            break-after: avoid;
            page-break-before: avoid;
            break-before: avoid;
          }

          .no-print-btn {
            display: none;
          }

          .dtr-page {
            max-width: none;
            width: 10.5in;
            height: 7.92in;
            grid-template-columns: repeat(3, 3.5in);
            overflow: hidden;
            page-break-after: avoid;
            break-after: avoid;
            page-break-before: avoid;
            break-before: avoid;
          }

          .dtr-slip {
            min-height: auto;
            width: 3.5in;
            height: 7.92in;
            padding: 0.13in 0.16in 0;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .title-block {
            height: 0.53in;
          }

          .title-block h1 {
            font-size: 16.5px;
            line-height: 1.05;
          }

          .title-block p {
            margin-top: 0.04in;
            font-size: 10px;
          }

          .top-rule {
            height: 1.5px;
            margin-bottom: 0.18in;
          }

          .meta-grid {
            gap: 0.05in;
            margin-bottom: 0.13in;
            font-size: 10.25px;
            line-height: 1.12;
          }

          .meta-right {
            gap: 0.025in;
          }

          .month-row {
            grid-template-columns: 1fr auto 0.43in;
            gap: 0.04in;
          }

          .hours-row {
            grid-template-columns: 0.74in 0.66in 0.48in;
            gap: 0.035in;
          }

          .line {
            border-bottom-width: 1.5px;
            min-height: 0.12in;
            font-size: 8.25px;
            line-height: 1;
          }

          .dtr-table {
            font-size: 8.4px;
          }

          .dtr-table th,
          .dtr-table td {
            border-width: 1px;
            height: 0.128in;
            padding: 0 1px;
            line-height: 1;
          }

          .dtr-table th {
            height: 0.145in;
          }

          .dtr-table thead tr:nth-child(2) th {
            font-size: 7.15px;
          }

          .dtr-table td.time-cell {
            font-size: 7px;
            padding-left: 0;
            padding-right: 0;
          }

          .total-row td {
            height: 0.14in;
          }

          .certification {
            margin: 0.035in 0.03in 0.25in;
            font-size: 8.6px;
            line-height: 1.18;
          }

          .signature-line {
            height: 0.13in;
            border-bottom-width: 1.5px;
            font-size: 8px;
            line-height: 0.13in;
          }

          .verified {
            margin: 0.015in 0 0.14in;
            font-size: 8.5px;
          }

          .noted {
            margin: 0 0 0.18in 0.08in;
            font-size: 8.5px;
          }

          .supervisor {
            margin-top: 0.03in;
            font-size: 9.3px;
          }
        }
      ` }} />

      {!isPreview && (
        <div className="no-print-btn">
          <span>Print mode ready. This DTR follows the three-copy official template layout.</span>
          <button className="print-button" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      )}

      <main className="dtr-page">
        <DTRSlip copyIndex={0} />
        <DTRSlip copyIndex={1} />
        <DTRSlip copyIndex={2} />
      </main>
    </div>
  );
}
