import React, { useMemo, useState } from 'react';
import {
  ScriptBreakdownDataset,
  ScriptBlockCategoryStat,
} from '../services/scriptBreakdownService';
import {
  ArrowUpDown,
  ChevronRight,
  X,
  FileText,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface ScriptBreakdownTableProps {
  dataset: ScriptBreakdownDataset;
  searchQuery?: string;
  onJumpToScene?: (sceneId: string) => void;
  className?: string;
}

const CATEGORY_DOT_CLASS: Record<string, string> = {
  scene_heading: 'bg-emerald-400',
  action: 'bg-slate-400',
  character: 'bg-teal-400',
  dialogue: 'bg-emerald-400',
  parenthetical: 'bg-indigo-400',
  transition: 'bg-rose-400',
  lyrics: 'bg-teal-400',
  section_heading: 'bg-sky-400',
  centered_text: 'bg-slate-300',
  note: 'bg-lime-400',
  synopsis: 'bg-slate-500',
  page_break: 'bg-zinc-500',
  unclassified: 'bg-lime-500',
};

export const ScriptBreakdownTable: React.FC<ScriptBreakdownTableProps> = ({
  dataset,
  searchQuery = '',
  onJumpToScene,
  className = '',
}) => {
  const [sortField, setSortField] = useState<
    'label' | 'instances' | 'percentage' | 'wordCount' | 'sceneCoverage'
  >('instances');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const [occurrenceFilter, setOccurrenceFilter] = useState<string>('');

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const sortedCategories = useMemo(() => {
    let list = dataset.categories;
    if (normalizedQuery) {
      list = list.filter(
        (c) =>
          c.label.toLowerCase().includes(normalizedQuery) ||
          c.description.toLowerCase().includes(normalizedQuery) ||
          c.occurrences.some((occ) => occ.text.toLowerCase().includes(normalizedQuery))
      );
    }

    return [...list].sort((a, b) => {
      let comp = 0;
      if (sortField === 'label') comp = a.label.localeCompare(b.label);
      else if (sortField === 'instances') comp = a.instances - b.instances;
      else if (sortField === 'percentage') comp = a.percentage - b.percentage;
      else if (sortField === 'wordCount') comp = a.wordCount - b.wordCount;
      else if (sortField === 'sceneCoverage') comp = a.sceneCoverage - b.sceneCoverage;
      return sortAsc ? comp : -comp;
    });
  }, [dataset.categories, normalizedQuery, sortField, sortAsc]);

  const selectedCategory: ScriptBlockCategoryStat | null = useMemo(() => {
    if (!selectedCategoryKey) return null;
    if (selectedCategoryKey === 'unclassified') return dataset.unclassifiedCategory;
    return dataset.categories.find((c) => c.key === selectedCategoryKey) || null;
  }, [selectedCategoryKey, dataset]);

  const visibleOccurrences = useMemo(() => {
    if (!selectedCategory) return [];
    const q = occurrenceFilter.trim().toLowerCase() || normalizedQuery;
    if (!q) return selectedCategory.occurrences;
    return selectedCategory.occurrences.filter(
      (occ) =>
        occ.text.toLowerCase().includes(q) ||
        occ.sceneHeading.toLowerCase().includes(q) ||
        occ.sceneNumber.toLowerCase().includes(q)
    );
  }, [selectedCategory, occurrenceFilter, normalizedQuery]);

  const handleToggleSort = (
    field: 'label' | 'instances' | 'percentage' | 'wordCount' | 'sceneCoverage'
  ) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'label');
    }
  };

  const reconciledSum = useMemo(() => {
    return dataset.categories.reduce((acc, c) => acc + c.instances, 0);
  }, [dataset.categories]);

  return (
    <div
      data-testid="script-breakdown-table"
      className={`flex-1 min-h-0 w-full h-full flex bg-transparent overflow-hidden select-none ${className}`}
    >
      {/* Left: Main Analytical Composition Table */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-[#04160f]/90 backdrop-blur-xl border-b border-emerald-500/20 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th
                  onClick={() => handleToggleSort('label')}
                  className="py-3 px-5 font-semibold cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Block Type</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort('instances')}
                  className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Instances</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort('percentage')}
                  className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-white transition w-44"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Percentage</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort('wordCount')}
                  className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Word Count</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort('sceneCoverage')}
                  className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Scene Coverage</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-3 w-10" />
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.05]">
              {sortedCategories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500 text-xs">
                    {normalizedQuery
                      ? `No screenplay block categories matching "${searchQuery}".`
                      : 'No classified screenplay blocks detected in the active canonical script.'}
                  </td>
                </tr>
              ) : (
                sortedCategories.map((cat) => {
                  const isSelected = selectedCategoryKey === cat.key;
                  const dotClass = CATEGORY_DOT_CLASS[cat.key] || 'bg-slate-400';
                  return (
                    <tr
                      key={cat.key}
                      data-testid={`script-breakdown-row-${cat.key}`}
                      onClick={() => {
                        setSelectedCategoryKey(isSelected ? null : cat.key);
                        setOccurrenceFilter('');
                      }}
                      className={`cursor-pointer transition-colors group ${
                        isSelected
                          ? 'bg-emerald-500/15 text-white'
                          : 'hover:bg-white/[0.03] text-slate-200'
                      }`}
                    >
                      <td className="py-3 px-5">
                        <div className="flex items-start gap-2.5">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotClass}`} />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-100 group-hover:text-emerald-300 transition-colors">
                              {cat.label}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-md">
                              {cat.description}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-100">
                        {cat.instances.toLocaleString()}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <div className="w-20 h-1.5 rounded-full bg-white/[0.06] overflow-hidden hidden sm:block">
                            <div
                              className={`h-full rounded-full ${dotClass} opacity-80`}
                              style={{ width: `${Math.min(100, Math.max(2, cat.percentage))}%` }}
                            />
                          </div>
                          <span className="font-mono text-emerald-400 font-semibold w-12 text-right">
                            {cat.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        {cat.wordCount.toLocaleString()}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        {dataset.totalScenes > 0 ? (
                          <span>
                            <span className="text-emerald-300 font-semibold">{cat.sceneCoverage}</span>
                            <span className="text-slate-500"> / {dataset.totalScenes}</span>
                          </span>
                        ) : (
                          <span>{cat.sceneCoverage}</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-slate-500 group-hover:text-white transition">
                        <ChevronRight className="w-4 h-4" />
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Unclassified Blocks Row (if any present — accounted for separately) */}
              {dataset.unclassifiedCategory && dataset.unclassifiedCategory.instances > 0 && (
                <tr
                  data-testid="script-breakdown-row-unclassified"
                  onClick={() => {
                    setSelectedCategoryKey(
                      selectedCategoryKey === 'unclassified' ? null : 'unclassified'
                    );
                    setOccurrenceFilter('');
                  }}
                  className={`cursor-pointer transition-colors group ${
                    selectedCategoryKey === 'unclassified'
                      ? 'bg-emerald-500/15 text-emerald-100'
                      : 'bg-emerald-500/[0.04] hover:bg-emerald-500/10 text-emerald-200'
                  }`}
                >
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-2.5">
                      <AlertCircle className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                      <div>
                        <div className="font-semibold">
                          {dataset.unclassifiedCategory.label}
                        </div>
                        <div className="text-[11px] text-emerald-300/70">
                          {dataset.unclassifiedCategory.description}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold">
                    {dataset.unclassifiedCategory.instances.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-300">
                    {dataset.unclassifiedCategory.percentage.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {dataset.unclassifiedCategory.wordCount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {dataset.unclassifiedCategory.sceneCoverage}
                  </td>
                  <td className="py-3 px-3">
                    <ChevronRight className="w-4 h-4" />
                  </td>
                </tr>
              )}
            </tbody>

            {/* Reconciled Totals Footer */}
            <tfoot className="sticky bottom-0 bg-[#03120c]/95 border-t border-emerald-500/20 text-xs font-mono">
              <tr data-testid="script-breakdown-totals-row">
                <td className="py-3 px-5 font-semibold text-slate-300 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Total Classified Blocks</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    ({dataset.sourceKind === 'canonical_document'
                      ? 'Canonical Document'
                      : dataset.sourceKind === 'fountain_text'
                      ? 'Parsed Screenplay Text'
                      : 'Parsed Scenes'})
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-bold text-white">
                  {reconciledSum.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right font-bold text-emerald-400">
                  {dataset.totalClassifiedInstances > 0 ? '100.0%' : '0.0%'}
                </td>
                <td className="py-3 px-4 text-right font-bold text-slate-200">
                  {dataset.totalWords.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right font-bold text-emerald-300">
                  {dataset.totalScenes} scenes
                </td>
                <td className="py-3 px-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Right Slide-Over: Selected Block Type Occurrences Inspector */}
      {selectedCategory && (
        <div
          data-testid="script-breakdown-occurrences-drawer"
          className="w-96 border-l border-emerald-500/20 bg-[#03150e]/95 backdrop-blur-2xl flex flex-col h-full shrink-0 overflow-hidden shadow-2xl"
        >
          <div className="p-4 border-b border-white/[0.08] bg-[#041c13] flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold block mb-0.5">
                Block Occurrences ({selectedCategory.instances.toLocaleString()})
              </span>
              <h3 className="text-sm font-bold text-white truncate">
                {selectedCategory.label}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selectedCategory.wordCount.toLocaleString()} words across {selectedCategory.sceneCoverage}{' '}
                {selectedCategory.sceneCoverage === 1 ? 'scene' : 'scenes'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCategoryKey(null)}
              aria-label="Close block occurrences"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 border-b border-white/[0.06] bg-black/20">
            <input
              type="text"
              value={occurrenceFilter}
              onChange={(e) => setOccurrenceFilter(e.target.value)}
              placeholder={`Filter ${selectedCategory.label.toLowerCase()} occurrences...`}
              className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:border-emerald-400 outline-none"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {visibleOccurrences.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No matching occurrences found.
              </div>
            ) : (
              visibleOccurrences.slice(0, 250).map((occ) => (
                <button
                  key={occ.id}
                  type="button"
                  onClick={() => occ.sceneId && onJumpToScene?.(occ.sceneId)}
                  className="w-full text-left p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition group cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                    <span className="text-emerald-400 font-bold truncate">
                      Sc. {occ.sceneNumber} · {occ.sceneHeading}
                    </span>
                    <span className="text-slate-500 shrink-0 flex items-center gap-1">
                      <span>{occ.wordCount}w</span>
                      {occ.sceneId && onJumpToScene && (
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-emerald-400 transition" />
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 line-clamp-3 leading-relaxed">
                    {occ.text}
                  </p>
                </button>
              ))
            )}
            {visibleOccurrences.length > 250 && (
              <div className="text-center py-2 text-[11px] font-mono text-slate-500">
                Showing first 250 of {visibleOccurrences.length.toLocaleString()} occurrences
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
