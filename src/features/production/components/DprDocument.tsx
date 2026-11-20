import React from 'react';
import type { DprPdfData } from '../services/productionPdfService';

interface DprDocumentProps {
  data: DprPdfData;
}

export const DprDocument: React.FC<DprDocumentProps> = ({ data }) => {
  const { project, day, dpr, callSheet, location, cumulative, totalShootDays } = data;
  const totalLostMin = (dpr.delayEntries || []).reduce(
    (sum, d) => sum + (Number(d.durationMinutes) || 0),
    0
  );

  return (
    <article
      data-testid="dpr-document-sheet"
      className="prod-doc-sheet bg-white text-slate-900 w-full max-w-[816px] mx-auto p-6 sm:p-8 shadow-2xl border border-slate-300 font-sans text-[11px] leading-snug"
    >
      {/* Header Banner */}
      <header className="border-2 border-slate-900 mb-4 prod-doc-section">
        <div className="bg-slate-900 text-white px-4 py-2.5 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-[9px] uppercase tracking-[0.18em] text-slate-300 font-mono">
              {project.productionCompany || project.companyName || 'SCENEOS PRODUCTION PAPERWORK'}
            </div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight">
              {project.title} — DAILY PRODUCTION REPORT (DPR)
            </h1>
          </div>
          <div className="text-right font-mono shrink-0">
            <div className="px-2.5 py-0.5 rounded bg-[#C21845] text-white font-bold text-xs inline-block shadow-sm">
              DAY {day.dayNumber} OF {totalShootDays || 1} · {(dpr.status || 'Draft').toUpperCase()}
            </div>
            <div className="text-[10px] text-slate-200 mt-0.5">Shoot Date: {day.date}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-300 text-[10.5px] bg-slate-50">
          <div className="px-3 py-1.5">
            <span className="font-mono text-[9px] uppercase text-slate-500 block">Director</span>
            <span className="font-semibold">{dpr.directorName || project.director || '—'}</span>
          </div>
          <div className="px-3 py-1.5">
            <span className="font-mono text-[9px] uppercase text-slate-500 block">Location(s)</span>
            <span className="font-semibold">
              {dpr.locationSummary || location?.name || 'Not specified'}
            </span>
          </div>
          <div className="px-3 py-1.5">
            <span className="font-mono text-[9px] uppercase text-slate-500 block">Prepared By</span>
            <span className="font-semibold">
              {dpr.preparedBy || dpr.submittedBy || '1st AD'}
            </span>
          </div>
          <div className="px-3 py-1.5">
            <span className="font-mono text-[9px] uppercase text-slate-500 block">Approved By</span>
            <span className="font-semibold">
              {dpr.approvedBy || (dpr.status === 'Approved' ? 'Authorized Producer' : 'Pending')}
            </span>
          </div>
        </div>
      </header>

      {/* Planned vs Actual Timings + Cumulative Totals */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 prod-doc-section">
        <div className="md:col-span-2 border border-slate-400">
          <div className="bg-slate-900 text-white px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-wider">
            Planned vs. Actual Shooting Day Timings
          </div>
          <table className="w-full border-collapse prod-doc-table text-[10.5px]">
            <thead className="bg-slate-100 border-b border-slate-400 font-mono text-[9px] uppercase text-slate-700">
              <tr>
                <th className="text-left px-2.5 py-1.5 border-r border-slate-300">Milestone</th>
                <th className="text-left px-2.5 py-1.5 border-r border-slate-300">Planned</th>
                <th className="text-left px-2.5 py-1.5">Actual Recorded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              <tr className="prod-doc-row">
                <td className="px-2.5 py-1.5 border-r border-slate-300 font-medium">General Crew Call</td>
                <td className="px-2.5 py-1.5 border-r border-slate-300 font-mono">
                  {callSheet?.generalCallTime || day.callTime || '—'}
                </td>
                <td className="px-2.5 py-1.5 font-mono font-bold">{dpr.generalCall || '—'}</td>
              </tr>
              <tr className="prod-doc-row even:bg-slate-50">
                <td className="px-2.5 py-1.5 border-r border-slate-300 font-medium">First Shot (AM)</td>
                <td className="px-2.5 py-1.5 border-r border-slate-300 font-mono">
                  {callSheet?.firstShotTime || '—'}
                </td>
                <td className="px-2.5 py-1.5 font-mono font-bold">{dpr.firstShotTime || '—'}</td>
              </tr>
              <tr className="prod-doc-row">
                <td className="px-2.5 py-1.5 border-r border-slate-300 font-medium">Meal Out → Meal In</td>
                <td className="px-2.5 py-1.5 border-r border-slate-300 font-mono">
                  {callSheet?.mealInfo || 'Standard Window'}
                </td>
                <td className="px-2.5 py-1.5 font-mono font-bold">
                  {dpr.mealOutTime || '—'} → {dpr.mealInTime || '—'}
                </td>
              </tr>
              <tr className="prod-doc-row even:bg-slate-50">
                <td className="px-2.5 py-1.5 border-r border-slate-300 font-medium">Post-Meal First Shot</td>
                <td className="px-2.5 py-1.5 border-r border-slate-300 font-mono">
                  {dpr.plannedPostMealFirstShot || '—'}
                </td>
                <td className="px-2.5 py-1.5 font-mono font-bold">
                  {dpr.actualPostMealFirstShot || '—'}
                </td>
              </tr>
              <tr className="prod-doc-row">
                <td className="px-2.5 py-1.5 border-r border-slate-300 font-medium">Camera Wrap</td>
                <td className="px-2.5 py-1.5 border-r border-slate-300 font-mono">
                  {callSheet?.estimatedWrapTime || day.wrapTime || '—'}
                </td>
                <td className="px-2.5 py-1.5 font-mono font-bold">
                  {dpr.cameraWrapTime || dpr.wrapTime || '—'}
                </td>
              </tr>
              <tr className="prod-doc-row even:bg-slate-50">
                <td className="px-2.5 py-1.5 border-r border-slate-300 font-medium">Final Crew Wrap</td>
                <td className="px-2.5 py-1.5 border-r border-slate-300 font-mono">
                  {callSheet?.estimatedWrapTime || day.wrapTime || '—'}
                </td>
                <td className="px-2.5 py-1.5 font-mono font-bold">{dpr.wrapTime || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="border border-slate-400">
          <div className="bg-slate-200 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider border-b border-slate-400">
            Daily & Cumulative Progress
          </div>
          <div className="p-2.5 space-y-1.5 text-[10.5px]">
            <div className="flex justify-between">
              <span>Day Scenes Shot:</span>
              <span className="font-mono font-bold">
                {dpr.totalScenesCompleted}/{dpr.totalScenesScheduled}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Day Eighths Shot:</span>
              <span className="font-mono font-bold">
                {dpr.pagesCompletedEighths}/{dpr.pagesScheduledEighths} eighths
              </span>
            </div>
            <div className="flex justify-between">
              <span>Setups Completed:</span>
              <span className="font-mono font-bold">{dpr.setupsCompleted}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5">
              <span>Cumul. Scenes Shot:</span>
              <span className="font-mono font-bold">{cumulative.completedSceneIds.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Cumul. Script Progress:</span>
              <span className="font-mono font-bold">
                {cumulative.completedEighths}/{cumulative.totalScriptEighths} eighths
              </span>
            </div>
            <div className="flex justify-between">
              <span>Lost Time Today:</span>
              <span className="font-mono font-bold">{totalLostMin} min</span>
            </div>
          </div>
        </div>
      </section>

      {/* Scene-by-Scene Results */}
      <section className="mb-4">
        <div className="bg-slate-900 text-white px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-wider">
          Scene-by-Scene Shooting Results
        </div>
        <table className="w-full border-collapse prod-doc-table border border-slate-400 text-[10.5px]">
          <thead className="bg-slate-100 border-b border-slate-400 font-mono text-[9px] uppercase text-slate-700">
            <tr>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-16">Scene</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300">Set / Slugline</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-36">Outcome</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-20">Planned</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-20">Completed</th>
              <th className="text-left px-2 py-1.5 w-36">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {(dpr.sceneResults || []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-2.5 text-center text-slate-500 italic">
                  No Stripboard scenes attached to Day {day.dayNumber}.
                </td>
              </tr>
            ) : (
              (dpr.sceneResults || []).map((sr) => (
                <tr key={sr.sceneId} className="prod-doc-row even:bg-slate-50/70">
                  <td className="px-2 py-1.5 border-r border-slate-300 font-mono font-bold">
                    SC {sr.sceneNumber}
                  </td>
                  <td className="px-2 py-1.5 border-r border-slate-300 font-medium">
                    {sr.slugline}
                  </td>
                  <td className="px-2 py-1.5 border-r border-slate-300 font-mono font-semibold">
                    {sr.result}
                  </td>
                  <td className="px-2 py-1.5 border-r border-slate-300 font-mono">
                    {sr.plannedEighths}/8
                  </td>
                  <td className="px-2 py-1.5 border-r border-slate-300 font-mono font-bold">
                    {sr.completedEighths}/8
                  </td>
                  <td className="px-2 py-1.5 text-[10px]">{sr.notes || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Cast & Crew Attendance Table */}
      <section className="mb-4">
        <div className="bg-slate-900 text-white px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-wider">
          Cast & Crew Attendance & Actual Timings ({(dpr.attendanceLog || []).length})
        </div>
        <table className="w-full border-collapse prod-doc-table border border-slate-400 text-[10.5px]">
          <thead className="bg-slate-100 border-b border-slate-400 font-mono text-[9px] uppercase text-slate-700">
            <tr>
              <th className="text-left px-2 py-1.5 border-r border-slate-300">Name</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-16">Group</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300">Dept / Role</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-24">Attendance</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-16">In</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-16">Wrap</th>
              <th className="text-left px-2 py-1.5 w-28">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {(dpr.attendanceLog || []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-2.5 text-center text-slate-500 italic">
                  No attendance entries recorded for this shoot day.
                </td>
              </tr>
            ) : (
              (dpr.attendanceLog || []).map((row, idx) => (
                <tr key={idx} className="prod-doc-row even:bg-slate-50/70">
                  <td className="px-2 py-1.5 border-r border-slate-300 font-medium">{row.name}</td>
                  <td className="px-2 py-1.5 border-r border-slate-300 font-mono text-[10px]">
                    {row.category}
                  </td>
                  <td className="px-2 py-1.5 border-r border-slate-300">{row.departmentOrRole}</td>
                  <td className="px-2 py-1.5 border-r border-slate-300 font-mono">{row.status}</td>
                  <td className="px-2 py-1.5 border-r border-slate-300 font-mono">
                    {row.actualCallTime || dpr.generalCall || '—'}
                  </td>
                  <td className="px-2 py-1.5 border-r border-slate-300 font-mono">
                    {row.actualWrapTime || dpr.wrapTime || '—'}
                  </td>
                  <td className="px-2 py-1.5 text-[10px]">{row.notes || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Delays / Lost Time & Issues */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3 prod-doc-section">
        <div className="border border-slate-400">
          <div className="bg-slate-200 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider border-b border-slate-400">
            Delays & Lost Time Log ({totalLostMin} min total)
          </div>
          <div className="p-2.5">
            {(dpr.delayEntries || []).length === 0 ? (
              <p className="text-slate-500 italic text-[10.5px]">Zero delays logged today.</p>
            ) : (
              <ul className="space-y-1 text-[10.5px]">
                {(dpr.delayEntries || []).map((dl) => (
                  <li key={dl.id}>
                    <span className="font-mono font-bold">
                      [{dl.category} · {dl.durationMinutes}m]
                    </span>{' '}
                    {dl.description}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="border border-slate-400">
          <div className="bg-slate-200 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider border-b border-slate-400">
            Equipment Issues & Daily Production Notes
          </div>
          <div className="p-2.5 space-y-1 text-[10.5px]">
            {dpr.equipmentIssues && (
              <div>
                <span className="font-semibold">Equipment / Set Issues:</span>{' '}
                {dpr.equipmentIssues}
              </div>
            )}
            <div>{dpr.delaysNotes || 'No supplemental notes recorded.'}</div>
          </div>
        </div>
      </section>
    </article>
  );
};
