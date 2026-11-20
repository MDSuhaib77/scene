import React from 'react';
import type { CallSheetPdfData } from '../services/productionPdfService';

interface CallSheetDocumentProps {
  data: CallSheetPdfData;
}

export const CallSheetDocument: React.FC<CallSheetDocumentProps> = ({ data }) => {
  const { project, day, callSheet, location, scenes, crewRows, totalShootDays, nextShootDay } = data;
  const rev = callSheet.revisionNumber || 1;
  const crewByDept = new Map<string, typeof crewRows>();
  crewRows.forEach((row) => {
    const dept = row.department || 'General Crew';
    const arr = crewByDept.get(dept) || [];
    arr.push(row);
    crewByDept.set(dept, arr);
  });

  const totalEighths = scenes.reduce((sum, s) => sum + (Number(s.pageLengthEighths) || 8), 0);
  const wholePgs = Math.floor(totalEighths / 8);
  const remEighths = totalEighths % 8;
  const pagesLabel =
    scenes.length > 0 ? `${wholePgs} ${remEighths}/8 pgs (${totalEighths} eighths)` : '0 pgs';

  return (
    <article
      data-testid="call-sheet-document-sheet"
      className="prod-doc-sheet bg-white text-slate-900 w-full max-w-[816px] mx-auto p-6 sm:p-8 shadow-2xl border border-slate-300 font-sans text-[11px] leading-snug"
    >
      {/* Document Header Banner */}
      <header className="border-2 border-slate-900 mb-4 prod-doc-section">
        <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-slate-300 font-mono">
              {project.productionCompany || project.companyName || 'SCENEOS PRODUCTION PAPERWORK'}
            </div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight">
              {project.title} — CALL SHEET
            </h1>
          </div>
          <div className="text-right font-mono">
            <div className="px-2.5 py-0.5 rounded bg-[#C21845] text-white font-bold text-xs inline-block shadow-sm">
              DAY {day.dayNumber} OF {totalShootDays || 1} · REV {rev}
            </div>
            <div className="text-[10px] text-slate-200 mt-0.5">
              {callSheet.published ? 'PUBLISHED' : 'DRAFT'} · {day.date}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-300 text-[10.5px] bg-slate-50">
          <div className="px-3 py-1.5">
            <span className="font-mono text-[9px] uppercase text-slate-500 block">Director</span>
            <span className="font-semibold text-slate-900">
              {project.director || 'Not specified'}
            </span>
          </div>
          <div className="px-3 py-1.5">
            <span className="font-mono text-[9px] uppercase text-slate-500 block">Producer</span>
            <span className="font-semibold text-slate-900">
              {project.producer || 'Not specified'}
            </span>
          </div>
          <div className="px-3 py-1.5">
            <span className="font-mono text-[9px] uppercase text-slate-500 block">General Crew Call</span>
            <span className="font-mono font-bold text-slate-900">
              {callSheet.generalCallTime || day.callTime}
            </span>
          </div>
          <div className="px-3 py-1.5">
            <span className="font-mono text-[9px] uppercase text-slate-500 block">
              Shooting / Est. Wrap
            </span>
            <span className="font-mono font-bold text-slate-900">
              {callSheet.firstShotTime || '—'} → {callSheet.estimatedWrapTime || day.wrapTime}
            </span>
          </div>
        </div>
      </header>

      {/* Top Three-Column Logistics Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 prod-doc-section">
        <div className="border border-slate-400">
          <div className="bg-slate-200 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider border-b border-slate-400">
            Location & Basecamp
          </div>
          <div className="p-2.5 space-y-1">
            <div>
              <span className="font-semibold">Set Location:</span>{' '}
              {location?.name || 'Not assigned in Directory'}
            </div>
            <div>
              <span className="font-semibold">Address:</span>{' '}
              {location?.address || 'Not specified'}
            </div>
            <div>
              <span className="font-semibold">Basecamp:</span>{' '}
              {callSheet.basecampAddress || 'Not specified'}
            </div>
            <div>
              <span className="font-semibold">Parking & Access:</span>{' '}
              {callSheet.parkingNotes || location?.parkingNotes || 'Not specified'}
            </div>
          </div>
        </div>

        <div className="border border-slate-400">
          <div className="bg-slate-200 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider border-b border-slate-400">
            Medical & Emergency
          </div>
          <div className="p-2.5 space-y-1">
            <div>
              <span className="font-semibold">Nearest Hospital:</span>{' '}
              {callSheet.hospitalOverride ||
                location?.nearestHospital ||
                'Unverified / Not Specified'}
            </div>
            <div>
              <span className="font-semibold">Emergency Contact:</span>{' '}
              {callSheet.emergencyContact || 'Unverified / Not Specified'}
            </div>
            <div>
              <span className="font-semibold">Safety / Unit Notes:</span>{' '}
              {callSheet.safetyNotes || 'None recorded'}
            </div>
            {location?.phone && (
              <div>
                <span className="font-semibold">Site Contact:</span> {location.phone}
              </div>
            )}
          </div>
        </div>

        <div className="border border-slate-400">
          <div className="bg-slate-200 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider border-b border-slate-400">
            Weather, Daylight & Contacts
          </div>
          <div className="p-2.5 space-y-1">
            <div>
              <span className="font-semibold">Weather:</span>{' '}
              {callSheet.weatherSummary || 'Not recorded'}
            </div>
            <div>
              <span className="font-semibold">Sunrise / Sunset:</span>{' '}
              {callSheet.sunriseTime || callSheet.sunsetTime
                ? `${callSheet.sunriseTime || '—'} / ${callSheet.sunsetTime || '—'}`
                : 'Not recorded'}
            </div>
            <div>
              <span className="font-semibold">Meals:</span>{' '}
              {callSheet.mealInfo || 'Not specified'}
            </div>
            {(callSheet.keyContacts || []).length > 0 && (
              <div className="pt-1 border-t border-slate-200 space-y-0.5">
                {(callSheet.keyContacts || []).map((kc, idx) => (
                  <div key={idx} className="truncate">
                    <span className="font-semibold">{kc.role}:</span> {kc.name}
                    {kc.phone ? ` (${kc.phone})` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Scene Schedule in Shooting Order */}
      <section className="mb-4">
        <div className="bg-slate-900 text-white px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-wider flex items-center justify-between">
          <span>Scene Schedule (Authoritative Stripboard Order)</span>
          <span>
            {scenes.length} Scenes · {pagesLabel}
          </span>
        </div>
        <table className="w-full border-collapse prod-doc-table border border-slate-400 text-[10.5px]">
          <thead className="bg-slate-100 border-b border-slate-400 font-mono text-[9px] uppercase text-slate-700">
            <tr>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-10">#</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-14">Scene</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300">
                Set / Slugline & Description
              </th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-24">I/E · D/N</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-16">Pages</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-24">Cast IDs</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-24">Location</th>
              <th className="text-left px-2 py-1.5 w-20">Est. Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {scenes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-3 text-center text-slate-500 italic">
                  No scenes linked from Breakdown Stripboard for Day {day.dayNumber}.
                </td>
              </tr>
            ) : (
              scenes.map((sc, idx) => {
                const ov = callSheet.sceneTimingOverrides?.[sc.id];
                return (
                  <tr key={sc.id} className="prod-doc-row even:bg-slate-50/70">
                    <td className="px-2 py-1.5 border-r border-slate-300 font-mono">{idx + 1}</td>
                    <td className="px-2 py-1.5 border-r border-slate-300 font-mono font-bold">
                      {sc.sceneNumber}
                    </td>
                    <td className="px-2 py-1.5 border-r border-slate-300">
                      <div className="font-semibold text-slate-900">{sc.slugline}</div>
                      {(ov?.notes || sc.synopsis) && (
                        <div className="text-[10px] text-slate-600">{ov?.notes || sc.synopsis}</div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 border-r border-slate-300 font-mono text-[10px]">
                      {sc.intExt} · {sc.timeOfDay}
                    </td>
                    <td className="px-2 py-1.5 border-r border-slate-300 font-mono">
                      {sc.pageLengthDisplay || `${sc.pageLengthEighths}/8`}
                    </td>
                    <td className="px-2 py-1.5 border-r border-slate-300 text-[10px]">
                      {(ov?.castIds && ov.castIds.length > 0
                        ? ov.castIds
                        : sc.characters || []
                      ).join(', ') || '—'}
                    </td>
                    <td className="px-2 py-1.5 border-r border-slate-300 text-[10px]">
                      {sc.location || '—'}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-[10px]">
                      {ov?.startTime || `${sc.estimatedDurationMinutes || 30}m`}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {/* Cast Calls Table */}
      <section className="mb-4">
        <div className="bg-slate-900 text-white px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-wider">
          Cast Calls ({(callSheet.castCalls || []).length})
        </div>
        <table className="w-full border-collapse prod-doc-table border border-slate-400 text-[10.5px]">
          <thead className="bg-slate-100 border-b border-slate-400 font-mono text-[9px] uppercase text-slate-700">
            <tr>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-14">Cast #</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300">Character</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300">Performer</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-16">Pickup</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-16">Makeup</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-20">Wardrobe</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-20">On Set</th>
              <th className="text-left px-2 py-1.5 w-20">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {(callSheet.castCalls || []).length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-2.5 text-center text-slate-500 italic">
                  No cast call rows added for this day.
                </td>
              </tr>
            ) : (
              (callSheet.castCalls || []).map((c, idx) => (
                <tr key={idx} className="prod-doc-row even:bg-slate-50/70">
                  <td className="px-2 py-1.5 border-r border-slate-300 font-mono font-bold">
                    {c.castNumber}
                  </td>
                  <td className="px-2 py-1.5 border-r border-slate-300 font-semibold">
                    {c.character}
                  </td>
                  <td className="px-2 py-1.5 border-r border-slate-300">{c.performer || '—'}</td>
                  <td className="px-2 py-1.5 border-r border-slate-300 font-mono">
                    {c.pickupTime || '—'}
                  </td>
                  <td className="px-2 py-1.5 border-r border-slate-300 font-mono">
                    {c.makeupTime || '—'}
                  </td>
                  <td className="px-2 py-1.5 border-r border-slate-300 font-mono">
                    {c.wardrobeTime || '—'}
                  </td>
                  <td className="px-2 py-1.5 border-r border-slate-300 font-mono font-bold">
                    {c.onSetCall || callSheet.firstShotTime}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">{c.status || 'Confirmed'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Crew Call Roster Organised by Department */}
      <section className="mb-4">
        <div className="bg-slate-900 text-white px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-wider">
          Crew Roster & Department Calls ({crewRows.length})
        </div>
        <table className="w-full border-collapse prod-doc-table border border-slate-400 text-[10.5px]">
          <thead className="bg-slate-100 border-b border-slate-400 font-mono text-[9px] uppercase text-slate-700">
            <tr>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-32">Department</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300">Role / Title</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300">Person</th>
              <th className="text-left px-2 py-1.5 border-r border-slate-300 w-32">Contact</th>
              <th className="text-left px-2 py-1.5 w-20">Call Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {crewRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-2.5 text-center text-slate-500 italic">
                  No crew called from Directory yet.
                </td>
              </tr>
            ) : (
              Array.from(crewByDept.entries()).flatMap(([dept, members]) =>
                members.map((m, idx) => (
                  <tr key={`${dept}-${idx}`} className="prod-doc-row even:bg-slate-50/70">
                    <td className="px-2 py-1.5 border-r border-slate-300 font-semibold">{dept}</td>
                    <td className="px-2 py-1.5 border-r border-slate-300">{m.role}</td>
                    <td className="px-2 py-1.5 border-r border-slate-300 font-medium">{m.name}</td>
                    <td className="px-2 py-1.5 border-r border-slate-300 font-mono text-[10px]">
                      {m.phone || '—'}
                    </td>
                    <td className="px-2 py-1.5 font-mono font-bold">{m.callTime}</td>
                  </tr>
                ))
              )
            )}
          </tbody>
        </table>
      </section>

      {/* Department Instructions & Production Notes / Advance */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3 prod-doc-section">
        <div className="border border-slate-400">
          <div className="bg-slate-200 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider border-b border-slate-400">
            Department Instructions & Production Notes
          </div>
          <div className="p-2.5 space-y-1.5 text-[10.5px]">
            {(callSheet.departmentInstructions || []).length > 0 && (
              <ul className="space-y-1">
                {(callSheet.departmentInstructions || []).map((inst, i) => (
                  <li key={i}>
                    <span className="font-semibold">{inst.department}:</span> {inst.instruction}
                  </li>
                ))}
              </ul>
            )}
            <div>{callSheet.productionNotes || 'No special department production notes recorded.'}</div>
          </div>
        </div>

        <div className="border border-slate-400">
          <div className="bg-slate-200 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider border-b border-slate-400">
            Advance Schedule (Next Shoot Day)
          </div>
          <div className="p-2.5 text-[10.5px]">
            {callSheet.advanceNextDay ? (
              <p>{callSheet.advanceNextDay}</p>
            ) : nextShootDay ? (
              <p>
                Shoot Day {nextShootDay.dayNumber} ({nextShootDay.date}) · Call{' '}
                {nextShootDay.callTime} · {nextShootDay.sceneIds.length} scene(s) scheduled.
              </p>
            ) : (
              <p className="text-slate-500 italic">No subsequent shooting day scheduled yet.</p>
            )}
          </div>
        </div>
      </section>
    </article>
  );
};
