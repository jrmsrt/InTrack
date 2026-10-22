import type { jsPDF as JsPdf } from 'jspdf';
import type { DTRRecord } from '../context/OJTContext';

export interface DtrPdfDetails {
  dtr: DTRRecord;
  studentName: string;
  studentNumber?: string;
  companyName?: string;
  supervisorName?: string;
}

const formatCellTime = (value?: string | null) => {
  if (!value) return '';
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?$/i);
  if (!match) return value.trim().replace(/\s+/g, ' ');
  let hour = Number(match[1]);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hour > 12) hour -= 12;
  if (period === 'AM' && hour === 0) hour = 12;
  return `${hour}:${match[2]}`;
};

const safeFilePart = (value: string) => value.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '');

export async function openDtrPdf({ dtr, studentName, studentNumber, companyName, supervisorName }: DtrPdfDetails) {
  const viewer = window.open('', '_blank');
  if (viewer) viewer.opener = null;
  const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const outerMargin = 7;
  const gap = 4;
  const slipWidth = (pageWidth - (outerMargin * 2) - (gap * 2)) / 3;
  const logs = Array.isArray(dtr.logs) ? dtr.logs : [];
  const start = new Date(`${dtr.startDate}T00:00:00`);
  const monthName = Number.isNaN(start.getTime()) ? dtr.month : start.toLocaleString('en-US', { month: 'long' });
  const year = Number.isNaN(start.getTime()) ? dtr.month.match(/\d{4}/)?.[0] || '' : String(start.getFullYear());
  const officialStart = formatCellTime(logs[0]?.timeIn);
  const officialEnd = formatCellTime([...logs].reverse().find(log => log.timeOut)?.timeOut);

  doc.setProperties({
    title: `Daily Time Record - ${studentName} - ${dtr.month}`,
    subject: 'OJT Daily Time Record',
    author: 'InTrack - OJT Monitoring System',
  });

  const rowForDay = (day: number) => {
    const paddedDay = String(day).padStart(2, '0');
    const log = logs.find(item => item.date.split('-')[2] === paddedDay);
    return [
      String(day),
      formatCellTime(log?.timeIn),
      log ? '12:00' : '',
      log ? '1:00' : '',
      formatCellTime(log?.timeOut),
      '',
      '',
    ];
  };

  for (let copyIndex = 0; copyIndex < 3; copyIndex += 1) {
    const left = outerMargin + copyIndex * (slipWidth + gap);
    const center = left + slipWidth / 2;

    doc.setDrawColor(20);
    doc.setTextColor(15);
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.text('DAILY TIME RECORD', center, 10, { align: 'center' });
    doc.setFont('times', 'normal');
    doc.setFontSize(6);
    doc.text('-----o0o-----', center, 14, { align: 'center' });
    doc.line(left, 16, left + slipWidth, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.text(`Name: ${studentName}`, left, 20);
    doc.text(`Student No.: ${studentNumber || ''}`, left, 23);
    doc.text(`For the month of: ${monthName} ${year}`, left, 26);
    doc.text(`Official hours: ${officialStart || '____'} to ${officialEnd || '____'}`, left + slipWidth * 0.56, 26);

    autoTable(doc, {
      startY: 29,
      margin: { left, right: pageWidth - left - slipWidth },
      tableWidth: slipWidth,
      theme: 'grid',
      head: [
        [
          { content: 'Day', rowSpan: 2 },
          { content: 'A.M.', colSpan: 2 },
          { content: 'P.M.', colSpan: 2 },
          { content: 'Undertime', colSpan: 2 },
        ],
        ['Arrival', 'Departure', 'Arrival', 'Departure', 'Hours', 'Minutes'],
      ],
      body: [...Array.from({ length: 31 }, (_, index) => rowForDay(index + 1)), ['', { content: 'TOTAL', colSpan: 4 }, '', '']],
      styles: {
        font: 'helvetica',
        fontSize: 4.6,
        cellPadding: 0.45,
        minCellHeight: 3.1,
        lineColor: 20,
        lineWidth: 0.15,
        halign: 'center',
        valign: 'middle',
        textColor: 10,
      },
      headStyles: { fillColor: [255, 255, 255], textColor: 10, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: (slipWidth - 8) / 6 },
        2: { cellWidth: (slipWidth - 8) / 6 },
        3: { cellWidth: (slipWidth - 8) / 6 },
        4: { cellWidth: (slipWidth - 8) / 6 },
        5: { cellWidth: (slipWidth - 8) / 6 },
        6: { cellWidth: (slipWidth - 8) / 6 },
      },
    });

    const tableEnd = (doc as JsPdf & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 148;
    let y = tableEnd + 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.2);
    const certification = 'I certify on my honor that the above is a true and correct report of the hours of work performed, recorded daily at the time of arrival and departure from office.';
    const lines = doc.splitTextToSize(certification, slipWidth - 4);
    doc.text(lines, left + 2, y);
    y += lines.length * 2.4 + 7;
    doc.line(left + 12, y, left + slipWidth - 12, y);
    doc.text(studentName, center, y - 1, { align: 'center' });
    doc.text('Trainee signature over printed name', center, y + 3, { align: 'center' });
    y += 9;
    doc.setFont('helvetica', 'bold');
    doc.text('VERIFIED as to the prescribed office hours', center, y, { align: 'center' });
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.text('Noted by:', left + 2, y - 3);
    doc.line(left + 12, y + 2, left + slipWidth - 12, y + 2);
    doc.text(supervisorName || '', center, y + 1, { align: 'center' });
    doc.text('Training Supervisor', center, y + 5, { align: 'center' });
    doc.setFontSize(4.8);
    doc.text(companyName || '', center, Math.min(pageHeight - 5, y + 9), { align: 'center' });

    if (copyIndex < 2) {
      doc.setLineDashPattern([1, 1], 0);
      doc.setDrawColor(140);
      doc.line(left + slipWidth + gap / 2, 6, left + slipWidth + gap / 2, pageHeight - 6);
      doc.setLineDashPattern([], 0);
    }
  }

  const blobUrl = URL.createObjectURL(doc.output('blob'));
  if (viewer) viewer.location.href = blobUrl;
  else window.open(blobUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  return `${safeFilePart(studentName)}_${safeFilePart(dtr.month)}_DTR.pdf`;
}
