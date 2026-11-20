/**
 * SceneOS — Production Paperwork Vector PDF Generator
 *
 * Generates genuine, multi-page US Letter (612 x 792 pt) PDF documents using
 * native PDF vector primitives and Helvetica typography (never application screenshots).
 * Supports ruled multi-column tables, repeating table headers across page breaks,
 * row page-break protection, section headers, and Page X of Y footers.
 */

import type { FilmProject, ParsedScene } from '../../../types';
import type {
  CallSheetRecord,
  DailyProductionReportRecord,
  DirectoryEntryRecord,
  ShootingDayRecord,
} from '../types';
import type { CumulativeDprProgress } from './productionStoreService';

export interface CallSheetCrewRow {
  department: string;
  role: string;
  name: string;
  phone: string;
  callTime: string;
}

export interface CallSheetPdfData {
  project: FilmProject;
  day: ShootingDayRecord;
  callSheet: CallSheetRecord;
  location?: DirectoryEntryRecord | null;
  scenes: ParsedScene[];
  crewRows: CallSheetCrewRow[];
  totalShootDays: number;
  nextShootDay?: ShootingDayRecord | null;
}

export interface DprPdfData {
  project: FilmProject;
  day: ShootingDayRecord;
  dpr: DailyProductionReportRecord;
  callSheet?: CallSheetRecord | null;
  location?: DirectoryEntryRecord | null;
  cumulative: CumulativeDprProgress;
  totalShootDays: number;
}

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 36;
const CONTENT_W = PAGE_W - MARGIN_X * 2; // 540 pt
const TOP_Y = PAGE_H - 38; // 754 pt
const BOTTOM_Y = 44;

interface PdfColumnSpec {
  header: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

function sanitizeAscii(raw: string): string {
  return String(raw || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2192/g, '->')
    .replace(/\u00D7/g, 'x')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function escapePdf(raw: string): string {
  return sanitizeAscii(raw)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapToWidth(text: string, maxWidthPt: number, fontSize = 8): string[] {
  const clean = sanitizeAscii(text).trim();
  if (!clean) return ['-'];
  const avgCharW = fontSize * 0.51;
  const maxChars = Math.max(4, Math.floor(maxWidthPt / avgCharW));
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      if (word.length > maxChars) {
        let rest = word;
        while (rest.length > maxChars) {
          lines.push(rest.slice(0, maxChars));
          rest = rest.slice(maxChars);
        }
        current = rest;
      } else {
        current = word;
      }
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : ['-'];
}

class VectorPdfBuilder {
  private pages: string[] = [];
  private current = '';
  public y = TOP_Y;
  private docTitle: string;
  private docSubtitle: string;
  private docBadge: string;

  constructor(docTitle: string, docSubtitle: string, docBadge: string) {
    this.docTitle = docTitle;
    this.docSubtitle = docSubtitle;
    this.docBadge = docBadge;
    this.startPage(true);
  }

  private startPage(isFirst: boolean) {
    if (this.current) {
      this.pages.push(this.current);
    }
    this.current = '';
    this.y = TOP_Y;

    // Document top banner
    const bannerH = isFirst ? 44 : 26;
    const bannerBottom = this.y - bannerH;
    this.rectFill(MARGIN_X, bannerBottom, CONTENT_W, bannerH, 0.09, 0.11, 0.16);
    this.text(
      this.docTitle.toUpperCase(),
      MARGIN_X + 10,
      this.y - (isFirst ? 17 : 16),
      isFirst ? 11 : 9,
      'bold',
      1,
      1,
      1
    );
    if (isFirst && this.docSubtitle) {
      this.text(this.docSubtitle, MARGIN_X + 10, this.y - 33, 8, 'regular', 0.85, 0.88, 0.94);
    }

    const badgeW = Math.min(180, Math.max(92, sanitizeAscii(this.docBadge).length * 5.2 + 18));
    const badgeX = MARGIN_X + CONTENT_W - badgeW - 8;
    const badgeY = this.y - (isFirst ? 27 : 20);
    this.rectFill(badgeX, badgeY, badgeW, 15, 0.91, 0.89, 0.85);
    this.text(this.docBadge.toUpperCase(), badgeX + 6, badgeY + 4.5, 7.5, 'bold', 0.07, 0.09, 0.14);

    this.y = bannerBottom - 10;
  }

  ensureSpace(neededHeight: number) {
    if (this.y - neededHeight < BOTTOM_Y) {
      this.startPage(false);
    }
  }

  rectFill(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    g: number,
    b: number
  ) {
    this.current += `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${x.toFixed(
      2
    )} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f\n`;
  }

  rectStroke(
    x: number,
    y: number,
    w: number,
    h: number,
    gray = 0.72,
    lineW = 0.5
  ) {
    this.current += `${lineW} w ${gray.toFixed(2)} G ${x.toFixed(2)} ${y.toFixed(
      2
    )} ${w.toFixed(2)} ${h.toFixed(2)} re S\n`;
  }

  line(x1: number, y1: number, x2: number, y2: number, gray = 0.72, lineW = 0.5) {
    this.current += `${lineW} w ${gray.toFixed(2)} G ${x1.toFixed(2)} ${y1.toFixed(
      2
    )} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`;
  }

  text(
    str: string,
    x: number,
    y: number,
    size = 8,
    weight: 'regular' | 'bold' = 'regular',
    r = 0.1,
    g = 0.12,
    b = 0.16
  ) {
    const fontRef = weight === 'bold' ? '/F2' : '/F1';
    this.current += `BT ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${fontRef} ${size} Tf 1 0 0 1 ${x.toFixed(
      2
    )} ${y.toFixed(2)} Tm (${escapePdf(str)}) Tj ET\n`;
  }

  sectionHeading(title: string) {
    this.ensureSpace(26);
    const h = 15;
    this.rectFill(MARGIN_X, this.y - h, CONTENT_W, h, 0.92, 0.94, 0.97);
    this.rectStroke(MARGIN_X, this.y - h, CONTENT_W, h, 0.72, 0.5);
    this.text(title.toUpperCase(), MARGIN_X + 6, this.y - 10.5, 8, 'bold', 0.08, 0.1, 0.16);
    this.y -= h + 4;
  }

  keyValueGrid(
    boxes: Array<{ title: string; rows: Array<[string, string]> }>,
    gap = 6
  ) {
    const colCount = boxes.length;
    const boxW = (CONTENT_W - gap * (colCount - 1)) / colCount;
    const labelW = 68;
    const valW = boxW - labelW - 12;

    const preparedBoxes = boxes.map((box) => {
      const preparedRows = box.rows.map(([k, v]) => ({
        label: k,
        lines: wrapToWidth(v, valW, 7.5),
      }));
      const h =
        16 +
        preparedRows.reduce((s, r) => s + Math.max(1, r.lines.length) * 10 + 2, 4);
      return { title: box.title, rows: preparedRows, h };
    });

    const maxH = Math.max(...preparedBoxes.map((b) => b.h));
    this.ensureSpace(maxH + 6);

    const startY = this.y;
    preparedBoxes.forEach((box, idx) => {
      const bx = MARGIN_X + idx * (boxW + gap);
      this.rectFill(bx, startY - 14, boxW, 14, 0.94, 0.95, 0.97);
      this.rectStroke(bx, startY - maxH, boxW, maxH, 0.72, 0.5);
      this.line(bx, startY - 14, bx + boxW, startY - 14, 0.72, 0.5);
      this.text(box.title.toUpperCase(), bx + 6, startY - 10, 7.5, 'bold');

      let cy = startY - 24;
      box.rows.forEach((row) => {
        this.text(`${row.label}:`, bx + 6, cy, 7.5, 'bold', 0.32, 0.36, 0.44);
        row.lines.forEach((line, lIdx) => {
          this.text(line, bx + 6 + labelW, cy - lIdx * 10, 7.5, 'regular', 0.09, 0.11, 0.16);
        });
        cy -= Math.max(1, row.lines.length) * 10 + 2;
      });
    });

    this.y = startY - maxH - 8;
  }

  table(columns: PdfColumnSpec[], rows: string[][], emptyMessage = 'No records') {
    const headerH = 15;
    const drawHeader = () => {
      this.rectFill(MARGIN_X, this.y - headerH, CONTENT_W, headerH, 0.16, 0.19, 0.25);
      let cx = MARGIN_X;
      columns.forEach((col) => {
        this.text(col.header.toUpperCase(), cx + 4, this.y - 10.5, 7, 'bold', 1, 1, 1);
        cx += col.width;
      });
      this.y -= headerH;
    };

    if (rows.length === 0) {
      this.ensureSpace(headerH + 18);
      drawHeader();
      this.rectStroke(MARGIN_X, this.y - 16, CONTENT_W, 16, 0.78, 0.4);
      this.text(emptyMessage, MARGIN_X + 6, this.y - 11, 7.5, 'regular', 0.42, 0.45, 0.5);
      this.y -= 22;
      return;
    }

    this.ensureSpace(headerH + 22);
    drawHeader();

    rows.forEach((row, rIdx) => {
      const wrappedCells = columns.map((col, cIdx) =>
        wrapToWidth(row[cIdx] ?? '-', col.width - 8, 7.5)
      );
      const maxLines = Math.max(...wrappedCells.map((c) => c.length));
      const rowH = Math.max(15, maxLines * 9.5 + 6);

      if (this.y - rowH < BOTTOM_Y) {
        this.startPage(false);
        drawHeader();
      }

      if (rIdx % 2 === 1) {
        this.rectFill(MARGIN_X, this.y - rowH, CONTENT_W, rowH, 0.98, 0.985, 0.99);
      }
      this.rectStroke(MARGIN_X, this.y - rowH, CONTENT_W, rowH, 0.8, 0.4);

      let cx = MARGIN_X;
      columns.forEach((col, cIdx) => {
        if (cIdx > 0) {
          this.line(cx, this.y, cx, this.y - rowH, 0.85, 0.35);
        }
        wrappedCells[cIdx].forEach((line, lIdx) => {
          this.text(line, cx + 4, this.y - 10 - lIdx * 9.5, 7.5, 'regular', 0.1, 0.12, 0.16);
        });
        cx += col.width;
      });

      this.y -= rowH;
    });

    this.y -= 8;
  }

  noteBox(title: string, body: string) {
    const clean = sanitizeAscii(body).trim() || 'None recorded.';
    const lines = wrapToWidth(clean, CONTENT_W - 14, 7.8);
    const boxH = 18 + lines.length * 10 + 4;
    this.ensureSpace(boxH + 4);
    this.rectFill(MARGIN_X, this.y - 14, CONTENT_W, 14, 0.95, 0.96, 0.98);
    this.rectStroke(MARGIN_X, this.y - boxH, CONTENT_W, boxH, 0.75, 0.45);
    this.line(MARGIN_X, this.y - 14, MARGIN_X + CONTENT_W, this.y - 14, 0.78, 0.4);
    this.text(title.toUpperCase(), MARGIN_X + 6, this.y - 10, 7.5, 'bold');
    lines.forEach((l, idx) => {
      this.text(l, MARGIN_X + 6, this.y - 24 - idx * 10, 7.8, 'regular');
    });
    this.y -= boxH + 6;
  }

  compile(footerLeft: string): Uint8Array {
    if (this.current) {
      this.pages.push(this.current);
      this.current = '';
    }

    const totalPages = this.pages.length;
    const finalizedStreams = this.pages.map((pageStream, idx) => {
      let s = pageStream;
      s += `0.5 w 0.78 G ${MARGIN_X} 30 m ${MARGIN_X + CONTENT_W} 30 l S\n`;
      s += `BT 0.42 0.45 0.50 rg /F1 7 Tf 1 0 0 1 ${MARGIN_X} 20 Tm (${escapePdf(
        footerLeft
      )}) Tj ET\n`;
      const pageLabel = `Page ${idx + 1} of ${totalPages}`;
      const rightX = MARGIN_X + CONTENT_W - pageLabel.length * 3.8;
      s += `BT 0.25 0.28 0.34 rg /F2 7 Tf 1 0 0 1 ${rightX.toFixed(
        2
      )} 20 Tm (${escapePdf(pageLabel)}) Tj ET\n`;
      return s;
    });

    const enc = new TextEncoder();
    const chunks: Uint8Array[] = [];
    let offset = 0;
    const offsets: number[] = [];

    const pushStr = (str: string) => {
      const b = enc.encode(str);
      chunks.push(b);
      offset += b.length;
    };
    const pushBytes = (b: Uint8Array) => {
      chunks.push(b);
      offset += b.length;
    };
    const beginObj = (id: number) => {
      offsets[id] = offset;
      pushStr(`${id} 0 obj\n`);
    };
    const endObj = () => pushStr('endobj\n');

    pushStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

    const FIRST_PAGE_ID = 5;
    const FIRST_STREAM_ID = 5 + totalPages;

    beginObj(1);
    pushStr('<< /Type /Catalog /Pages 2 0 R >>\n');
    endObj();

    beginObj(2);
    const kids = Array.from({ length: totalPages }, (_, i) => `${FIRST_PAGE_ID + i} 0 R`).join(' ');
    pushStr(`<< /Type /Pages /Kids [${kids}] /Count ${totalPages} >>\n`);
    endObj();

    beginObj(3);
    pushStr('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\n');
    endObj();

    beginObj(4);
    pushStr('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\n');
    endObj();

    for (let i = 0; i < totalPages; i++) {
      beginObj(FIRST_PAGE_ID + i);
      pushStr(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${
          FIRST_STREAM_ID + i
        } 0 R >>\n`
      );
      endObj();
    }

    for (let i = 0; i < totalPages; i++) {
      const bytes = enc.encode(finalizedStreams[i]);
      beginObj(FIRST_STREAM_ID + i);
      pushStr(`<< /Length ${bytes.length} >>\nstream\n`);
      pushBytes(bytes);
      pushStr('\nendstream\n');
      endObj();
    }

    const totalObjs = FIRST_STREAM_ID + totalPages;
    const xrefPos = offset;
    pushStr(`xref\n0 ${totalObjs}\n0000000000 65535 f \n`);
    for (let id = 1; id < totalObjs; id++) {
      pushStr(`${String(offsets[id] || 0).padStart(10, '0')} 00000 n \n`);
    }
    pushStr(`trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

    const out = new Uint8Array(offset);
    let cursor = 0;
    chunks.forEach((c) => {
      out.set(c, cursor);
      cursor += c.length;
    });
    return out;
  }
}

export function buildCallSheetPdfBytes(data: CallSheetPdfData): Uint8Array {
  const { project, day, callSheet, location, scenes, crewRows, totalShootDays, nextShootDay } = data;
  const rev = callSheet.revisionNumber || 1;
  const statusTag = callSheet.published ? `PUBLISHED REV ${rev}` : `DRAFT REV ${rev}`;
  const doc = new VectorPdfBuilder(
    `${project.title} - CALL SHEET`,
    `Shoot Date: ${day.date}  |  Day ${day.dayNumber} of ${totalShootDays || 1}  |  Director: ${project.director || 'Not specified'}`,
    statusTag
  );

  doc.keyValueGrid([
    {
      title: 'Call Times & Daylight',
      rows: [
        ['Crew Call', callSheet.generalCallTime || day.callTime || '-'],
        ['First Shot', callSheet.firstShotTime || '-'],
        ['Est. Wrap', callSheet.estimatedWrapTime || day.wrapTime || '-'],
        ['Sunrise / Set', callSheet.sunriseTime || callSheet.sunsetTime ? `${callSheet.sunriseTime || '-'} / ${callSheet.sunsetTime || '-'}` : 'Not recorded'],
        ['Weather', callSheet.weatherSummary || 'Not recorded'],
      ],
    },
    {
      title: 'Location & Basecamp',
      rows: [
        ['Primary Set', location?.name || 'Not assigned in Directory'],
        ['Address', location?.address || 'Not specified'],
        ['Basecamp', callSheet.basecampAddress || callSheet.parkingNotes || location?.parkingNotes || 'Not specified'],
        ['Parking', callSheet.parkingNotes || location?.parkingNotes || 'See Basecamp'],
        ['Site Contact', location?.phone || location?.email || 'Not specified'],
      ],
    },
    {
      title: 'Medical & Key Contacts',
      rows: [
        ['Nearest Hosp', callSheet.hospitalOverride || location?.nearestHospital || 'Unverified / Not Specified'],
        ['Emergency', callSheet.emergencyContact || 'Unverified / Not Specified'],
        ['Producer', project.producer || 'Not specified'],
        ...(callSheet.keyContacts || []).slice(0, 2).map<[string, string]>((kc) => [
          kc.role || 'Contact',
          `${kc.name}${kc.phone ? ` (${kc.phone})` : ''}`,
        ]),
      ],
    },
  ]);

  doc.sectionHeading(`Scene Schedule in Shooting Order (${scenes.length} Scenes)`);
  doc.table(
    [
      { header: 'SC #', width: 36 },
      { header: 'Set / Slugline & Synopsis', width: 204 },
      { header: 'I/E D/N', width: 58 },
      { header: 'Pgs', width: 38 },
      { header: 'Cast IDs', width: 78 },
      { header: 'Est Time', width: 50 },
      { header: 'Location', width: 76 },
    ],
    scenes.map((sc) => {
      const ov = callSheet.sceneTimingOverrides?.[sc.id];
      return [
        sc.sceneNumber,
        `${sc.slugline}${ov?.notes ? ` — ${ov.notes}` : sc.synopsis ? ` — ${sc.synopsis}` : ''}`,
        `${sc.intExt} ${sc.timeOfDay}`,
        sc.pageLengthDisplay || `${sc.pageLengthEighths}/8`,
        (ov?.castIds && ov.castIds.length > 0 ? ov.castIds : sc.characters || []).join(', ') || '-',
        ov?.startTime || `${sc.estimatedDurationMinutes || 30}m`,
        sc.location || '-',
      ];
    }),
    'No scenes scheduled in Breakdown Stripboard for this Shoot Day.'
  );

  doc.sectionHeading(`Cast Call Table (${(callSheet.castCalls || []).length})`);
  doc.table(
    [
      { header: 'ID', width: 34 },
      { header: 'Character', width: 108 },
      { header: 'Performer', width: 112 },
      { header: 'Pickup', width: 52 },
      { header: 'H/MU', width: 52 },
      { header: 'Wardrobe', width: 56 },
      { header: 'On Set', width: 54 },
      { header: 'Status', width: 72 },
    ],
    (callSheet.castCalls || []).map((c) => [
      c.castNumber || '-',
      c.character || '-',
      c.performer || '-',
      c.pickupTime || '-',
      c.makeupTime || '-',
      c.wardrobeTime || '-',
      c.onSetCall || callSheet.firstShotTime || '-',
      c.status || 'Confirmed',
    ]),
    'No cast rows assigned on this Call Sheet.'
  );

  doc.sectionHeading(`Department & Crew Calls (${crewRows.length})`);
  doc.table(
    [
      { header: 'Department', width: 104 },
      { header: 'Role / Position', width: 136 },
      { header: 'Name', width: 130 },
      { header: 'Contact', width: 108 },
      { header: 'Call', width: 62 },
    ],
    crewRows.map((c) => [c.department || 'Production', c.role, c.name, c.phone || '-', c.callTime]),
    'No crew members added to Call Sheet.'
  );

  if (callSheet.departmentInstructions && callSheet.departmentInstructions.length > 0) {
    doc.sectionHeading('Department Instructions');
    doc.table(
      [
        { header: 'Department', width: 140 },
        { header: 'Instructions & Requirements', width: 400 },
      ],
      callSheet.departmentInstructions.map((d) => [d.department, d.instruction])
    );
  }

  doc.noteBox(
    'Meals, Safety & Production Notes',
    [
      callSheet.mealInfo ? `Meals: ${callSheet.mealInfo}` : '',
      callSheet.safetyNotes ? `Safety: ${callSheet.safetyNotes}` : '',
      callSheet.productionNotes ? `Notes: ${callSheet.productionNotes}` : '',
      callSheet.advanceNextDay
        ? `Next Day Advance: ${callSheet.advanceNextDay}`
        : nextShootDay
        ? `Advance: Shoot Day ${nextShootDay.dayNumber} scheduled ${nextShootDay.date} (${nextShootDay.sceneIds.length} scenes)`
        : '',
    ]
      .filter(Boolean)
      .join(' | ') || 'No supplemental meal or production notes recorded.'
  );

  return doc.compile(`${project.title} · Call Sheet Day ${day.dayNumber} · Rev ${rev}`);
}

export function buildDprPdfBytes(data: DprPdfData): Uint8Array {
  const { project, day, dpr, callSheet, location, cumulative, totalShootDays } = data;
  const doc = new VectorPdfBuilder(
    `${project.title} - DAILY PRODUCTION REPORT`,
    `Shoot Date: ${day.date}  |  Day ${day.dayNumber} of ${totalShootDays || 1}  |  Director: ${
      dpr.directorName || project.director || 'Not specified'
    }  |  Prepared by: ${dpr.preparedBy || dpr.submittedBy || '1st AD'}`,
    `DPR: ${(dpr.status || 'Draft').toUpperCase()}`
  );

  doc.keyValueGrid([
    {
      title: 'Production Summary',
      rows: [
        ['Location', dpr.locationSummary || location?.name || 'Not specified'],
        ['Company', project.productionCompany || project.companyName || 'Not specified'],
        ['Director', dpr.directorName || project.director || 'Not specified'],
        ['Report State', dpr.status || 'Draft'],
        ['Approved By', dpr.approvedBy || (dpr.status === 'Approved' ? 'Authorized Producer' : 'Pending')],
      ],
    },
    {
      title: 'Daily & Cumulative Progress',
      rows: [
        ['Day Scenes', `${dpr.totalScenesCompleted}/${dpr.totalScenesScheduled}`],
        ['Day Eighths', `${dpr.pagesCompletedEighths}/${dpr.pagesScheduledEighths} eighths`],
        ['Setups Shot', `${dpr.setupsCompleted} setups today (${cumulative.totalSetups} total)`],
        ['Cumul. Pgs', `${cumulative.completedEighths}/${cumulative.totalScriptEighths} eighths (${cumulative.completedSceneIds.length} scenes)`],
        ['Lost Time', `${(dpr.delayEntries || []).reduce((s, d) => s + (d.durationMinutes || 0), 0)} min today`],
      ],
    },
  ]);

  doc.sectionHeading('Planned vs. Actual Schedule Timings');
  doc.table(
    [
      { header: 'Milestone Timing', width: 170 },
      { header: 'Planned (Call Sheet / Day)', width: 120 },
      { header: 'Actual Recorded', width: 120 },
      { header: 'Notes', width: 130 },
    ],
    [
      ['General Crew Call', callSheet?.generalCallTime || day.callTime || '-', dpr.generalCall || '-', ''],
      ['First Shot (AM)', callSheet?.firstShotTime || '-', dpr.firstShotTime || '-', ''],
      ['Meal Out / Meal In', callSheet?.mealInfo || '12:30 - 13:30', `${dpr.mealOutTime || '-'} - ${dpr.mealInTime || '-'}`, ''],
      ['Post-Meal First Shot', dpr.plannedPostMealFirstShot || '-', dpr.actualPostMealFirstShot || '-', ''],
      ['Camera Wrap', callSheet?.estimatedWrapTime || day.wrapTime || '-', dpr.cameraWrapTime || dpr.wrapTime || '-', ''],
      ['Final Crew Wrap', callSheet?.estimatedWrapTime || day.wrapTime || '-', dpr.wrapTime || '-', ''],
    ]
  );

  const sceneResults = dpr.sceneResults || [];
  doc.sectionHeading(`Scene-by-Scene Results (${sceneResults.length})`);
  doc.table(
    [
      { header: 'Scene', width: 48 },
      { header: 'Set / Slugline', width: 222 },
      { header: 'Result', width: 92 },
      { header: 'Plan Pgs', width: 52 },
      { header: 'Shot Pgs', width: 52 },
      { header: 'Notes', width: 74 },
    ],
    sceneResults.map((sr) => [
      `SC ${sr.sceneNumber}`,
      sr.slugline,
      sr.result,
      `${sr.plannedEighths}/8`,
      `${sr.completedEighths}/8`,
      sr.notes || '-',
    ]),
    'No scheduled scenes recorded for this day.'
  );

  doc.sectionHeading(`Cast & Crew Attendance & Actual Timings (${(dpr.attendanceLog || []).length})`);
  doc.table(
    [
      { header: 'Name', width: 130 },
      { header: 'Type', width: 46 },
      { header: 'Department / Role', width: 136 },
      { header: 'Status', width: 76 },
      { header: 'Actual In', width: 52 },
      { header: 'Wrap', width: 52 },
      { header: 'Notes', width: 48 },
    ],
    (dpr.attendanceLog || []).map((a) => [
      a.name,
      a.category,
      a.departmentOrRole,
      a.status,
      a.actualCallTime || dpr.generalCall || '-',
      a.actualWrapTime || dpr.wrapTime || '-',
      a.notes || '-',
    ]),
    'No attendance records logged for this shooting day.'
  );

  doc.sectionHeading(`Delays, Lost Time & Incidents (${(dpr.delayEntries || []).length})`);
  doc.table(
    [
      { header: 'Category', width: 96 },
      { header: 'Lost (Min)', width: 74 },
      { header: 'Cause & Resolution Details', width: 370 },
    ],
    (dpr.delayEntries || []).map((dl) => [
      dl.category,
      `${dl.durationMinutes} min`,
      dl.description,
    ]),
    'Zero production delays logged.'
  );

  doc.noteBox(
    'Equipment / Production Issues & Notes',
    [
      dpr.equipmentIssues ? `Equipment/Issues: ${dpr.equipmentIssues}` : '',
      dpr.delaysNotes ? `Daily Production Notes: ${dpr.delaysNotes}` : '',
    ]
      .filter(Boolean)
      .join(' | ') || 'No equipment issues or additional daily notes reported.'
  );

  return doc.compile(`${project.title} · DPR Day ${day.dayNumber} · ${dpr.status || 'Draft'}`);
}

export function triggerProductionPdfDownload(bytes: Uint8Array, filename: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
