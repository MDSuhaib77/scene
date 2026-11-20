import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  ImageOff,
  X,
} from 'lucide-react';
import type { ParsedScene } from '../../../types';
import type { LookbookRecord, VisualReferenceAsset } from '../types';

interface LookbookPresentationModalProps {
  lookbook: LookbookRecord | null;
  productionTitle: string;
  scenes: ParsedScene[];
  referenceAssets: VisualReferenceAsset[];
  onClose: () => void;
}

export const LookbookPresentationModal: React.FC<LookbookPresentationModalProps> = ({
  lookbook,
  productionTitle,
  scenes,
  referenceAssets,
  onClose,
}) => {
  // 'all' displays the continuous editorial presentation; a section ID focuses that section
  const [activeSectionId, setActiveSectionId] = useState<'all' | string>('all');
  const [brokenAssetIds, setBrokenAssetIds] = useState<Record<string, boolean>>({});

  const assetMap = useMemo(() => {
    const map = new Map<string, VisualReferenceAsset>();
    referenceAssets.forEach((a) => map.set(a.id, a));
    return map;
  }, [referenceAssets]);

  const sceneMap = useMemo(() => {
    const map = new Map<string, ParsedScene>();
    scenes.forEach((s) => map.set(s.id, s));
    return map;
  }, [scenes]);

  if (!lookbook) return null;

  const sortedSections = [...lookbook.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const coverAsset = lookbook.coverAssetId ? assetMap.get(lookbook.coverAssetId) || null : null;
  const linkedSceneLabels = lookbook.linkedSceneIds
    .map((id) => sceneMap.get(id))
    .filter((s): s is ParsedScene => Boolean(s))
    .map((s) => `SC ${s.sceneNumber} — ${s.slugline}`);

  const visibleSections =
    activeSectionId === 'all'
      ? sortedSections
      : sortedSections.filter((s) => s.id === activeSectionId);

  const currentSectionIndex =
    activeSectionId === 'all'
      ? -1
      : sortedSections.findIndex((s) => s.id === activeSectionId);

  const handleStepSection = (delta: -1 | 1) => {
    if (sortedSections.length === 0) return;
    if (activeSectionId === 'all') {
      setActiveSectionId(sortedSections[0].id);
      return;
    }
    const nextIdx = currentSectionIndex + delta;
    if (nextIdx < 0) {
      setActiveSectionId('all');
    } else if (nextIdx < sortedSections.length) {
      setActiveSectionId(sortedSections[nextIdx].id);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const content = (
    <>
      {/* Isolated Editorial PDF Stylesheet: prints ONLY #lookbook-printable-document */}
      <style>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 18mm 16mm;
          }
          html, body {
            background: #ffffff !important;
            color: #111827 !important;
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #lookbook-printable-document,
          #lookbook-printable-document * {
            visibility: visible !important;
          }
          #lookbook-printable-document {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #111827 !important;
          }
          .lookbook-print-section {
            break-inside: avoid-page;
          }
        }
      `}</style>

      {/* Screen Presentation Overlay (Distraction-Free Editorial Reader) */}
      <div
        data-testid="lookbook-presentation-modal"
        className="fixed inset-0 z-[120] bg-[#080602]/95 backdrop-blur-2xl text-slate-100 flex flex-col overflow-hidden select-text print:hidden"
      >
        {/* Minimal Presentation Chrome */}
        <header className="px-6 py-3 border-b border-white/[0.08] bg-[#120f06]/95 border-b border-[#FFD34E]/25 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
              {productionTitle}
            </span>
            {lookbook.department && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-[11px] font-medium text-yellow-300">
                  {lookbook.department}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {sortedSections.length > 0 && (
              <div className="hidden md:flex items-center gap-1 mr-2">
                <button
                  type="button"
                  onClick={() => handleStepSection(-1)}
                  disabled={activeSectionId === 'all'}
                  title="Previous section"
                  className="p-1.5 rounded-lg border border-white/10 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStepSection(1)}
                  disabled={
                    activeSectionId !== 'all' &&
                    currentSectionIndex === sortedSections.length - 1
                  }
                  title="Next section"
                  className="p-1.5 rounded-lg border border-white/10 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              data-testid="lookbook-export-pdf-btn"
              onClick={handlePrintPdf}
              className="px-3 py-1.5 rounded-lg border border-[#FFD34E]/30 bg-[#1F2226] text-yellow-200 hover:border-white/30 text-xs font-medium text-yellow-100 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              Export PDF
            </button>

            <button
              type="button"
              data-testid="lookbook-close-presentation-btn"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-slate-950 font-bold shadow-xs hover:bg-[#FFF1A8] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Exit Presentation
            </button>
          </div>
        </header>

        {/* Section Navigator Strip */}
        {sortedSections.length > 0 && (
          <nav
            aria-label="Lookbook Sections"
            className="px-6 py-2.5 border-b border-white/[0.06] bg-[#100d04]/90 border-b border-[#FFD34E]/20 flex items-center gap-2 overflow-x-auto shrink-0"
          >
            <button
              type="button"
              onClick={() => setActiveSectionId('all')}
              className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                activeSectionId === 'all'
                  ? 'bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white border border-white/10'
              }`}
            >
              All Sections ({sortedSections.length})
            </button>
            {sortedSections.map((sec, idx) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSectionId(sec.id)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                  activeSectionId === sec.id
                    ? 'bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white border border-white/10'
                }`}
              >
                {idx + 1}. {sec.title}
              </button>
            ))}
          </nav>
        )}

        {/* Distraction-Free Editorial Scroll Canvas */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 md:px-12 lg:px-20 py-10 space-y-14">
          {/* Editorial Cover Block (shown on 'all' or as header) */}
          <div className="max-w-5xl mx-auto space-y-6 border-b border-white/[0.08] pb-10">
            <div className="space-y-3">
              {lookbook.department && (
                <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-yellow-300/80">
                  {lookbook.department}
                </div>
              )}
              <h1 className="text-3xl md:text-4xl font-semibold text-yellow-100 tracking-tight leading-tight">
                {lookbook.title}
              </h1>
              {lookbook.description && (
                <p className="text-sm md:text-base text-slate-300 max-w-3xl leading-relaxed">
                  {lookbook.description}
                </p>
              )}
              {linkedSceneLabels.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {linkedSceneLabels.map((lbl) => (
                    <span
                      key={lbl}
                      className="px-2.5 py-1 rounded-full border border-white/10 bg-[#15171A]/85 backdrop-blur-xl border border-[#FFD34E]/20 font-mono text-[10px] text-slate-300"
                    >
                      {lbl}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {coverAsset && !brokenAssetIds[coverAsset.id] && (
              <div className="rounded-2xl overflow-hidden bg-[#0c0f16] border border-white/[0.08] max-h-[460px] flex items-center justify-center">
                <img
                  src={coverAsset.thumbnailDataUrl || coverAsset.storageRef}
                  alt={lookbook.title}
                  onError={() =>
                    setBrokenAssetIds((prev) => ({ ...prev, [coverAsset.id]: true }))
                  }
                  className="w-full max-h-[460px] object-contain"
                />
              </div>
            )}
          </div>

          {/* Curated Lookbook Sections */}
          {visibleSections.length === 0 ? (
            <div className="max-w-5xl mx-auto py-12 text-center text-sm text-slate-500">
              No sections added to this Lookbook yet.
            </div>
          ) : (
            visibleSections.map((sec, idx) => {
              const sectionNumber =
                activeSectionId === 'all' ? idx + 1 : currentSectionIndex + 1;
              const sortedItems = [...sec.items].sort((a, b) => a.sortOrder - b.sortOrder);

              return (
                <section
                  key={sec.id}
                  data-testid={`presentation-section-${sec.id}`}
                  className="max-w-5xl mx-auto space-y-6 pb-8 border-b border-white/[0.06] last:border-b-0"
                >
                  <div className="space-y-2 max-w-3xl">
                    <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-slate-500">
                      Section {String(sectionNumber).padStart(2, '0')}
                    </div>
                    <h2 className="text-2xl font-semibold text-yellow-100 tracking-tight">
                      {sec.title}
                    </h2>
                    {sec.summary && (
                      <p className="text-sm text-slate-300 leading-relaxed">{sec.summary}</p>
                    )}
                    {sec.creativeNotes && (
                      <p className="text-xs font-mono text-slate-400 border-l-2 border-yellow-400/40 pl-3 py-0.5">
                        {sec.creativeNotes}
                      </p>
                    )}
                  </div>

                  {sortedItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-slate-500">
                      No visual plates assigned to this section yet.
                    </div>
                  ) : (
                    <div
                      className={`grid gap-6 ${
                        sortedItems.length === 1
                          ? 'grid-cols-1'
                          : 'grid-cols-1 md:grid-cols-2'
                      }`}
                    >
                      {sortedItems.map((item) => {
                        const asset = assetMap.get(item.assetId) || null;
                        const src = asset?.thumbnailDataUrl || asset?.storageRef;
                        const broken = !asset || Boolean(brokenAssetIds[asset.id]);

                        return (
                          <figure
                            key={item.id}
                            className="rounded-2xl border border-white/[0.08] bg-[#15171A]/85 backdrop-blur-xl border border-[#FFD34E]/20 overflow-hidden flex flex-col"
                          >
                            <div className="w-full bg-[#0A0B0D] flex items-center justify-center min-h-[240px] max-h-[520px] p-2">
                              {src && !broken ? (
                                <img
                                  src={src}
                                  alt={item.caption || asset?.originalFilename || 'Lookbook frame'}
                                  onError={() =>
                                    asset &&
                                    setBrokenAssetIds((prev) => ({
                                      ...prev,
                                      [asset.id]: true,
                                    }))
                                  }
                                  className="max-w-full max-h-[500px] w-auto h-auto object-contain rounded"
                                />
                              ) : (
                                <div className="py-12 flex flex-col items-center gap-1.5 text-slate-500">
                                  <ImageOff className="w-6 h-6" />
                                  <span className="text-xs">Reference image unavailable</span>
                                </div>
                              )}
                            </div>
                            {(item.caption || item.note) && (
                              <figcaption className="px-4 py-3 border-t border-white/[0.06] space-y-1">
                                {item.caption && (
                                  <div className="text-xs font-medium text-yellow-100">
                                    {item.caption}
                                  </div>
                                )}
                                {item.note && (
                                  <div className="text-[11px] text-slate-400">{item.note}</div>
                                )}
                              </figcaption>
                            )}
                          </figure>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>

      {/* Dedicated Hidden Print Document (Rendered exclusively into #lookbook-printable-document during PDF Export) */}
      <div id="lookbook-printable-document" className="hidden">
        <div style={{ fontFamily: 'Georgia, serif', color: '#111827', padding: '12px 0' }}>
          <div style={{ borderBottom: '2px solid #1f2937', paddingBottom: '18px', marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#4b5563', marginBottom: '6px' }}>
              {productionTitle}
              {lookbook.department ? ` · ${lookbook.department}` : ''}
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 8px 0', color: '#030712' }}>
              {lookbook.title}
            </h1>
            {lookbook.description && (
              <p style={{ fontSize: '13px', lineHeight: 1.6, color: '#374151', margin: '0 0 10px 0' }}>
                {lookbook.description}
              </p>
            )}
            {linkedSceneLabels.length > 0 && (
              <div style={{ fontSize: '11px', color: '#4b5563' }}>
                Scenes: {linkedSceneLabels.join(' · ')}
              </div>
            )}
          </div>

          {coverAsset && (coverAsset.thumbnailDataUrl || coverAsset.storageRef) && (
            <div style={{ marginBottom: '28px', textAlign: 'center' }}>
              <img
                src={coverAsset.thumbnailDataUrl || coverAsset.storageRef}
                alt={lookbook.title}
                style={{ maxWidth: '100%', maxHeight: '340px', objectFit: 'contain' }}
              />
            </div>
          )}

          {sortedSections.map((sec, idx) => {
            const sortedItems = [...sec.items].sort((a, b) => a.sortOrder - b.sortOrder);
            return (
              <div
                key={sec.id}
                className="lookbook-print-section"
                style={{ marginBottom: '28px', paddingBottom: '18px', borderBottom: '1px solid #e5e7eb' }}
              >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#6b7280' }}>
                  Section {String(idx + 1).padStart(2, '0')}
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 8px 0', color: '#111827' }}>
                  {sec.title}
                </h2>
                {sec.summary && (
                  <p style={{ fontSize: '12px', lineHeight: 1.55, color: '#374151', margin: '0 0 8px 0' }}>
                    {sec.summary}
                  </p>
                )}
                {sec.creativeNotes && (
                  <p style={{ fontSize: '11px', fontStyle: 'italic', color: '#4b5563', borderLeft: '3px solid #9ca3af', paddingLeft: '10px', margin: '0 0 14px 0' }}>
                    {sec.creativeNotes}
                  </p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  {sortedItems.map((item) => {
                    const asset = assetMap.get(item.assetId);
                    const src = asset?.thumbnailDataUrl || asset?.storageRef;
                    return (
                      <div key={item.id} style={{ border: '1px solid #e5e7eb', padding: '8px', background: '#f9fafb' }}>
                        {src ? (
                          <img
                            src={src}
                            alt={item.caption || asset?.originalFilename || 'Frame'}
                            style={{ width: '100%', maxHeight: '220px', objectFit: 'contain', display: 'block' }}
                          />
                        ) : (
                          <div style={{ padding: '24px', textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>
                            Reference unavailable
                          </div>
                        )}
                        {(item.caption || item.note) && (
                          <div style={{ marginTop: '6px', fontSize: '11px', color: '#111827' }}>
                            {item.caption && <div style={{ fontWeight: 600 }}>{item.caption}</div>}
                            {item.note && <div style={{ color: '#4b5563', marginTop: '2px' }}>{item.note}</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );

  return typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : content;
};
