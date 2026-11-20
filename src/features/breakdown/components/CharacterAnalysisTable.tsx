import React from 'react';
import {
  ConfirmedCharacterRecord,
  CharacterInteractionEdge,
} from '../services/characterAnalysisService';
import {
  Users,
  MessageSquare,
  FileText,
  Clock,
  ArrowUpDown,
  ChevronRight,
  ShieldCheck,
  Tag,
} from 'lucide-react';

interface CharacterAnalysisTableProps {
  characters: ConfirmedCharacterRecord[];
  selectedCharacterId: string | null;
  onSelectCharacter: (characterId: string) => void;
  searchQuery?: string;
  className?: string;
}

export const CharacterAnalysisTable: React.FC<CharacterAnalysisTableProps> = ({
  characters,
  selectedCharacterId,
  onSelectCharacter,
  searchQuery = '',
  className = '',
}) => {
  const [sortField, setSortField] = React.useState<
    'name' | 'blocks' | 'words' | 'scenes' | 'interactions'
  >('blocks');
  const [sortAsc, setSortAsc] = React.useState<boolean>(false);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredCharacters = React.useMemo(() => {
    let result = characters;
    if (normalizedQuery) {
      result = result.filter(
        (c) =>
          c.canonicalName.toLowerCase().includes(normalizedQuery) ||
          c.aliases.some((a) => a.toLowerCase().includes(normalizedQuery))
      );
    }

    return [...result].sort((a, b) => {
      let comp = 0;
      if (sortField === 'name') {
        comp = a.canonicalName.localeCompare(b.canonicalName);
      } else if (sortField === 'blocks') {
        comp = a.totalDialogueBlocks - b.totalDialogueBlocks;
      } else if (sortField === 'words') {
        comp = a.totalDialogueWords - b.totalDialogueWords;
      } else if (sortField === 'scenes') {
        comp = a.speakingScenesCount - b.speakingScenesCount;
      } else if (sortField === 'interactions') {
        comp = a.totalInteractionCount - b.totalInteractionCount;
      }
      return sortAsc ? comp : -comp;
    });
  }, [characters, normalizedQuery, sortField, sortAsc]);

  const handleToggleSort = (
    field: 'name' | 'blocks' | 'words' | 'scenes' | 'interactions'
  ) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div
      data-testid="character-analysis-table"
      className={`w-full h-full flex flex-col bg-[#0b0e14] overflow-hidden select-none ${className}`}
    >
      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          {/* Table Header */}
          <thead className="sticky top-0 z-10 bg-[#121620] border-b border-white/[0.08] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
            <tr>
              <th
                onClick={() => handleToggleSort('name')}
                className="py-3 px-4 font-semibold cursor-pointer hover:text-white transition w-1/4"
              >
                <div className="flex items-center gap-1.5">
                  <span>Character</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th className="py-3 px-4 font-semibold w-1/3">
                <span>Top Interaction Partners</span>
              </th>
              <th
                onClick={() => handleToggleSort('interactions')}
                className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-white transition"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Interactions</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th
                onClick={() => handleToggleSort('blocks')}
                className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-white transition"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Dialogue Blocks</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th
                onClick={() => handleToggleSort('words')}
                className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-white transition hidden md:table-cell"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Words (Avg)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th
                onClick={() => handleToggleSort('scenes')}
                className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-white transition"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Speaking Scenes</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th className="py-3 px-3 w-10"></th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-white/[0.04]">
            {filteredCharacters.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-500 text-xs">
                  {normalizedQuery
                    ? `No characters matching "${searchQuery}"`
                    : 'No confirmed speaking characters found.'}
                </td>
              </tr>
            ) : (
              filteredCharacters.map((char) => {
                const isSelected = selectedCharacterId === char.canonicalName;
                return (
                  <tr
                    key={char.canonicalName}
                    onClick={() => onSelectCharacter(char.canonicalName)}
                    className={`cursor-pointer transition-colors group ${
                      isSelected
                        ? 'bg-emerald-500/15 text-white'
                        : 'hover:bg-white/[0.03] text-slate-200'
                    }`}
                  >
                    {/* Character Column */}
                    <td className="py-3 px-4 font-medium">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isSelected ? 'bg-emerald-400' : 'bg-slate-600 group-hover:bg-emerald-400'
                          } transition-colors`}
                        />
                        <div className="min-w-0">
                          <span className="font-bold tracking-tight block truncate group-hover:text-emerald-300">
                            {char.canonicalName}
                          </span>
                          {char.aliases.length > 0 && (
                            <span className="text-[10px] font-mono text-slate-400 truncate block">
                              aka {char.aliases.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Top Partners Column */}
                    <td className="py-3 px-4">
                      {char.interactions.length === 0 ? (
                        <span className="text-[11px] text-slate-500 italic">None</span>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {char.interactions.slice(0, 3).map((partner) => (
                            <span
                              key={partner.partnerId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/5 text-[10px] font-medium text-slate-300"
                            >
                              <span className="truncate max-w-[90px]">
                                {partner.partnerName}
                              </span>
                              <span className="font-mono text-emerald-400 font-bold">
                                {partner.exchangeCount}
                              </span>
                            </span>
                          ))}
                          {char.interactions.length > 3 && (
                            <span className="text-[10px] font-mono text-slate-500">
                              +{char.interactions.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Total Dialogue Interactions */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      {char.totalInteractionCount}
                    </td>

                    {/* Total Dialogue Blocks */}
                    <td className="py-3 px-4 text-right font-mono text-slate-200 font-medium">
                      {char.totalDialogueBlocks}
                    </td>

                    {/* Total Words & Avg Turn Length */}
                    <td className="py-3 px-4 text-right font-mono text-slate-300 hidden md:table-cell">
                      <span>{char.totalDialogueWords}</span>{' '}
                      <span className="text-slate-500 text-[10px]">
                        ({char.averageDialogueLength}w/blk)
                      </span>
                    </td>

                    {/* Speaking Scenes Count */}
                    <td className="py-3 px-4 text-right font-mono font-medium text-amber-400">
                      {char.speakingScenesCount}
                    </td>

                    {/* Caret Action */}
                    <td className="py-3 px-3 text-slate-500 group-hover:text-white transition">
                      <ChevronRight className="w-4 h-4" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
