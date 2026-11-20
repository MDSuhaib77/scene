import { JSONContent } from '@tiptap/react';
import {
  ScreenplayVersion,
  ScreenplayRevisionSnapshot,
  ScreenplayTitlePageMetadata,
  ScreenplayFormat,
  ParsingWarning,
  ParsedScene,
} from '../../../types';
import { validateScreenplayFileIntegrity } from '../../../services/screenplay/validation';
import { screenplayParserService } from '../../../services/screenplay/screenplayParserService';
import {
  deserializeScreenplayDocument,
  parsePlainTextToScreenplayDoc,
} from '../commands/screenplayCommands';
import { ScreenplayElementType } from '../schema/screenplayExtensions';
import { extractScriptIntelligenceFromDoc } from './scriptIntelligenceService';
import { parseFountain } from '../model/fountainParser';
import { parseFdx } from '../model/fdxParser';
import {
  canonicalToTiptapDoc,
  canonicalToPlainText,
  canonicalToParsedScenes,
} from '../model/canonicalConverters';
import { processScreenplayImportFile } from './screenplayImportService';

export type ScreenplaySaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

export type ScreenplayExportFormat = 'fountain' | 'fdx' | 'pdf';

export { exportScreenplayToPdf } from './pdfExportService';
export { deserializeScreenplayDocument };

export interface RevisionDiffLine {
  type: 'unchanged' | 'added' | 'removed';
  text: string;
  lineNumberOld?: number;
  lineNumberNew?: number;
}

export interface RevisionDiffSummary {
  lines: RevisionDiffLine[];
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
  isIdentical: boolean;
}

export interface ScreenplayImportPreview {
  title: string;
  fileName: string;
  fileSize: number;
  sourceFormat: ScreenplayFormat;
  rawText: string;
  documentJson: string;
  doc: JSONContent;
  scenes: ParsedScene[];
  characters: string[];
  locations: string[];
  totalScenes: number;
  totalPageEighths: number;
  totalPageCountDisplay: string;
  warnings: ParsingWarning[];
  titlePageMetadata?: ScreenplayTitlePageMetadata;
  sourcePdfDataUrl?: string;
  pdfLayout?: any;
}

export const EMPTY_SCREENPLAY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'action' }],
};

/**
 * Resolves the editable plain text for a ScreenplayVersion.
 * Preserves genuinely blank documents (`rawText === ''`) when `documentJson` is present
 * rather than injecting fake sample text.
 */
export function resolveScriptText(
  ver: ScreenplayVersion | null | undefined,
  fallbackSampleText = ''
): string {
  if (!ver) return fallbackSampleText;
  if (typeof ver.rawText === 'string') {
    if (ver.rawText.length > 0 || ver.documentJson) {
      return ver.rawText;
    }
  }
  if (typeof ver.contentSnippet === 'string' && ver.contentSnippet.trim().length > 0) {
    return ver.contentSnippet;
  }
  if (ver.documentJson) {
    return '';
  }
  return fallbackSampleText;
}

/**
 * Resolves the Tiptap JSONContent document for a ScreenplayVersion.
 */
export function resolveScriptDoc(
  ver: ScreenplayVersion | null | undefined,
  fallbackSampleText = ''
): JSONContent {
  if (!ver) {
    return deserializeScreenplayDocument(null, fallbackSampleText);
  }
  const text = resolveScriptText(ver, fallbackSampleText);
  if (ver.documentJson) {
    return deserializeScreenplayDocument(ver.documentJson, text);
  }
  if (text.trim().length === 0) {
    return {
      type: 'doc',
      content: [{ type: 'action' }],
    };
  }
  return deserializeScreenplayDocument(null, text);
}

/**
 * Extracts a concise first-line snippet from plain text for library cards.
 */
export function extractScriptSnippet(rawText: string): string {
  if (!rawText) return '';
  const firstLine = rawText
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine ? firstLine.slice(0, 120) : '';
}

/**
 * Counts words and scene headings from a JSONContent document or plain text.
 */
export function computeDocumentQuickStats(
  docOrJson?: JSONContent | string | null,
  rawText = ''
): { wordCount: number; sceneCount: number } {
  const words = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;
  let sceneCount = 0;

  try {
    const parsed: JSONContent | null =
      typeof docOrJson === 'string'
        ? (JSON.parse(docOrJson) as JSONContent)
        : docOrJson || null;
    if (parsed && Array.isArray(parsed.content)) {
      for (const node of parsed.content) {
        if (node.type === 'sceneHeading') {
          sceneCount += 1;
        }
      }
      return { wordCount: words, sceneCount };
    }
  } catch {
    // Fallback to regex count on plain text
  }

  const lines = rawText.split('\n');
  for (const line of lines) {
    if (/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s*/i.test(line.trim())) {
      sceneCount += 1;
    }
  }
  return { wordCount: words, sceneCount };
}

/**
 * Creates a genuinely empty screenplay document record for the Script Library.
 */
export function createEmptyScriptDocument(params: {
  title: string;
  author?: string;
  owner?: string;
  existingCount?: number;
}): ScreenplayVersion {
  const nowIso = new Date().toISOString();
  const id = `scr-doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const cleanTitle = params.title.trim() || 'Untitled Screenplay';
  const docJsonStr = JSON.stringify(EMPTY_SCREENPLAY_DOC);
  const author = params.author ?? '';

  const initialRevision: ScreenplayRevisionSnapshot = {
    id: `rev-${Date.now()}-init`,
    versionLabel: 'v1.0',
    title: cleanTitle,
    author,
    createdAt: nowIso,
    changeDescription: 'Created blank screenplay document',
    rawText: '',
    documentJson: docJsonStr,
    wordCount: 0,
    sceneCount: 0,
  };

  return {
    id,
    version: 'v1.0',
    title: cleanTitle,
    author,
    owner: params.owner,
    createdAt: nowIso,
    updatedAt: nowIso,
    lastSavedAt: nowIso,
    changeDescription: 'Created blank screenplay document',
    contentSnippet: '',
    status: 'Draft',
    sourceFormat: 'fountain',
    totalScenes: 0,
    content: EMPTY_SCREENPLAY_DOC,
    rawText: '',
    documentJson: docJsonStr,
    scenes: [],
    revisions: [initialRevision],
    titlePageMetadata: {
      title: cleanTitle,
      author,
      credit: 'written by',
      draftDate: '',
      contact: '',
      notes: '',
    },
  };
}

/**
 * Creates an independent duplicate of an existing screenplay document with its own ID and history.
 */
export function duplicateScriptDocument(
  source: ScreenplayVersion,
  customTitle?: string
): ScreenplayVersion {
  const nowIso = new Date().toISOString();
  const newId = `scr-doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newTitle = (customTitle || `${source.title} (Copy)`).trim();
  const rawText = resolveScriptText(source, '');
  const resolvedDoc = resolveScriptDoc(source, '');
  const docJson = JSON.stringify(resolvedDoc);
  const stats = computeDocumentQuickStats(resolvedDoc, rawText);

  const initialRevision: ScreenplayRevisionSnapshot = {
    id: `rev-${Date.now()}-dup`,
    versionLabel: 'v1.0',
    title: newTitle,
    author: source.author || 'Screenwriter',
    createdAt: nowIso,
    changeDescription: `Duplicated from "${source.title}"`,
    rawText,
    documentJson: docJson,
    wordCount: stats.wordCount,
    sceneCount: stats.sceneCount,
  };

  return {
    ...source,
    id: newId,
    version: 'v1.0',
    title: newTitle,
    createdAt: nowIso,
    updatedAt: nowIso,
    lastSavedAt: nowIso,
    changeDescription: `Duplicated from "${source.title}"`,
    status: 'Draft',
    isLocked: false,
    rawText,
    documentJson: docJson,
    revisions: [initialRevision],
  };
}

/**
 * Renames a screenplay document without changing its identity or content.
 */
export function renameScriptDocument(
  source: ScreenplayVersion,
  nextTitle: string
): ScreenplayVersion {
  const trimmed = nextTitle.trim();
  if (!trimmed) return source;
  const nowIso = new Date().toISOString();
  return {
    ...source,
    title: trimmed,
    updatedAt: nowIso,
  };
}

/**
 * Filters the Script Library by search query across title, version, author, snippet, and filename.
 */
export function filterScriptLibrary(
  scripts: ScreenplayVersion[],
  query: string
): ScreenplayVersion[] {
  const q = query.trim().toLowerCase();
  if (!q) return scripts;
  return scripts.filter((s) => {
    const haystack = [
      s.title,
      s.version,
      s.author,
      s.changeDescription,
      s.contentSnippet,
      s.fileName,
      s.status,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

/**
 * Computes the next semantic version label (e.g. v1.0 -> v1.1 -> v1.2).
 */
export function computeNextVersionLabel(
  currentVersion?: string,
  revisionCount = 0
): string {
  if (currentVersion) {
    const match = currentVersion.match(/^v?(\d+)\.(\d+)$/i);
    if (match) {
      const major = Number(match[1]);
      const minor = Number(match[2]) + 1;
      return `v${major}.${minor}`;
    }
  }
  return `v1.${revisionCount + 1}`;
}

/**
 * Creates an explicit version checkpoint snapshot inside the script's revision history.
 */
export function createScriptCheckpoint(params: {
  script: ScreenplayVersion;
  liveText: string;
  liveDocJson: string;
  changeDescription?: string;
  author?: string;
  titleOverride?: string;
}): ScreenplayVersion {
  const { script, liveText, liveDocJson } = params;
  const nowIso = new Date().toISOString();
  const existingRevisions = script.revisions ?? [];
  const nextLabel = computeNextVersionLabel(script.version, existingRevisions.length);
  const effectiveTitle = (params.titleOverride || script.title).trim() || script.title;
  const description =
    params.changeDescription?.trim() || `Checkpoint ${nextLabel}`;
  const stats = computeDocumentQuickStats(liveDocJson, liveText);

  const snapshot: ScreenplayRevisionSnapshot = {
    id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    versionLabel: nextLabel,
    title: effectiveTitle,
    author: params.author || script.author || 'Screenwriter',
    createdAt: nowIso,
    changeDescription: description,
    rawText: liveText,
    documentJson: liveDocJson,
    wordCount: stats.wordCount,
    sceneCount: stats.sceneCount,
  };

  return {
    ...script,
    version: nextLabel,
    title: effectiveTitle,
    updatedAt: nowIso,
    lastSavedAt: nowIso,
    changeDescription: description,
    contentSnippet: extractScriptSnippet(liveText) || script.contentSnippet,
    totalScenes: stats.sceneCount,
    rawText: liveText,
    documentJson: liveDocJson,
    revisions: [...existingRevisions, snapshot],
  };
}

/**
 * Restores a previous revision snapshot safely while preserving all newer history
 * (and recording a pre-restore backup if the live document had uncheckpointed changes).
 */
export function restoreScriptRevision(params: {
  script: ScreenplayVersion;
  revisionId: string;
  currentLiveText?: string;
  currentLiveDocJson?: string;
}): { updatedScript: ScreenplayVersion; restoredRevision: ScreenplayRevisionSnapshot } | null {
  const { script, revisionId, currentLiveText, currentLiveDocJson } = params;
  const existingRevisions = script.revisions ?? [];
  const targetRev = existingRevisions.find((r) => r.id === revisionId);
  if (!targetRev) return null;

  const nowIso = new Date().toISOString();
  const nextRevisions = [...existingRevisions];

  // If the current state differs from the latest revision, preserve it as a pre-restore snapshot
  const latestRev =
    existingRevisions.length > 0
      ? existingRevisions[existingRevisions.length - 1]
      : null;
  const activeText =
    typeof currentLiveText === 'string' ? currentLiveText : script.rawText ?? '';
  const activeDocJson =
    typeof currentLiveDocJson === 'string'
      ? currentLiveDocJson
      : script.documentJson ?? '';

  if (
    activeText.trim().length > 0 &&
    (!latestRev || latestRev.rawText !== activeText)
  ) {
    const backupStats = computeDocumentQuickStats(activeDocJson, activeText);
    nextRevisions.push({
      id: `rev-${Date.now()}-backup`,
      versionLabel: `${script.version || 'v1.0'}-pre-restore`,
      title: script.title,
      author: script.author || 'Screenwriter',
      createdAt: nowIso,
      changeDescription: `Auto-saved state before restoring ${targetRev.versionLabel}`,
      rawText: activeText,
      documentJson: activeDocJson,
      wordCount: backupStats.wordCount,
      sceneCount: backupStats.sceneCount,
    });
  }

  const nextLabel = computeNextVersionLabel(script.version, nextRevisions.length);
  const restoredStats = computeDocumentQuickStats(
    targetRev.documentJson,
    targetRev.rawText
  );

  const restoreSnapshot: ScreenplayRevisionSnapshot = {
    id: `rev-${Date.now()}-restored`,
    versionLabel: nextLabel,
    title: script.title,
    author: script.author || 'Screenwriter',
    createdAt: nowIso,
    changeDescription: `Restored from ${targetRev.versionLabel} (${targetRev.changeDescription})`,
    rawText: targetRev.rawText,
    documentJson: targetRev.documentJson,
    wordCount: restoredStats.wordCount,
    sceneCount: restoredStats.sceneCount,
  };

  nextRevisions.push(restoreSnapshot);

  const updatedScript: ScreenplayVersion = {
    ...script,
    version: nextLabel,
    updatedAt: nowIso,
    lastSavedAt: nowIso,
    changeDescription: restoreSnapshot.changeDescription,
    contentSnippet: extractScriptSnippet(targetRev.rawText),
    totalScenes: restoredStats.sceneCount,
    rawText: targetRev.rawText,
    documentJson: targetRev.documentJson,
    revisions: nextRevisions,
  };

  return { updatedScript, restoredRevision: targetRev };
}

/**
 * Computes a line-level diff between two screenplay revisions for comparison in the UI.
 */
export function computeRevisionDiff(
  olderText: string,
  newerText: string
): RevisionDiffSummary {
  const oldLines = (olderText || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l, idx, arr) => l.trim().length > 0 || (arr.length === 1 && idx === 0));
  const newLines = (newerText || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l, idx, arr) => l.trim().length > 0 || (arr.length === 1 && idx === 0));

  // LCS matrix for accurate line comparison (capped for performance)
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i].trim() === newLines[j].trim()) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const lines: RevisionDiffLine[] = [];
  let i = 0;
  let j = 0;
  let addedCount = 0;
  let removedCount = 0;
  let unchangedCount = 0;

  while (i < m && j < n) {
    if (oldLines[i].trim() === newLines[j].trim()) {
      if (oldLines[i].trim().length > 0) {
        lines.push({
          type: 'unchanged',
          text: newLines[j],
          lineNumberOld: i + 1,
          lineNumberNew: j + 1,
        });
        unchangedCount += 1;
      }
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      if (oldLines[i].trim().length > 0) {
        lines.push({
          type: 'removed',
          text: oldLines[i],
          lineNumberOld: i + 1,
        });
        removedCount += 1;
      }
      i++;
    } else {
      if (newLines[j].trim().length > 0) {
        lines.push({
          type: 'added',
          text: newLines[j],
          lineNumberNew: j + 1,
        });
        addedCount += 1;
      }
      j++;
    }
  }

  while (i < m) {
    if (oldLines[i].trim().length > 0) {
      lines.push({
        type: 'removed',
        text: oldLines[i],
        lineNumberOld: i + 1,
      });
      removedCount += 1;
    }
    i++;
  }

  while (j < n) {
    if (newLines[j].trim().length > 0) {
      lines.push({
        type: 'added',
        text: newLines[j],
        lineNumberNew: j + 1,
      });
      addedCount += 1;
    }
    j++;
  }

  return {
    lines,
    addedCount,
    removedCount,
    unchangedCount,
    isIdentical: addedCount === 0 && removedCount === 0,
  };
}

/**
 * Maps Final Draft XML (<FinalDraft><Content><Paragraph Type="...">) into semantic
 * ProseMirror JSONContent AND extracts clean readable plain text (never dumping raw XML tags).
 */
export function parseFdxXmlToScreenplayDoc(rawXml: string): {
  doc: JSONContent;
  cleanText: string;
} {
  if (!rawXml || rawXml.trim().length === 0) {
    return {
      doc: { type: 'doc', content: [{ type: 'action' }] },
      cleanText: '',
    };
  }
  const canonical = parseFdx(rawXml);
  const doc = canonicalToTiptapDoc(canonical);
  const cleanText = canonicalToPlainText(canonical);
  return { doc, cleanText };
}

/**
 * Enhanced Fountain-to-ProseMirror converter supporting Fountain syntax constructs
 * (Title Page stripping, .SCENE, @CHARACTER, ^ Dual Dialogue, ~Lyrics, >CENTER<, [[Note]]).
 */
export function parseFountainToScreenplayDoc(rawFountain: string): {
  doc: JSONContent;
  cleanText: string;
} {
  if (!rawFountain || rawFountain.trim().length === 0) {
    return {
      doc: { type: 'doc', content: [{ type: 'action' }] },
      cleanText: '',
    };
  }
  const canonical = parseFountain(rawFountain);
  const doc = canonicalToTiptapDoc(canonical);
  const cleanText = canonicalToPlainText(canonical);
  return { doc, cleanText };
}

function _legacyParseFountain(body: string) {
  const lines = body.split('\n');
  const blocks: JSONContent[] = [];
  const plainLines: string[] = [];
  let prevType: ScreenplayElementType | null = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      prevType = null;
      continue;
    }

    // Inline Fountain Note [[...]]
    if (trimmed.startsWith('[[') && trimmed.endsWith(']]')) {
      const noteText = trimmed.slice(2, -2).trim();
      if (noteText) {
        blocks.push({
          type: 'screenplayNote',
          content: [{ type: 'text', text: noteText }],
        });
      }
      continue;
    }

    // Centered Fountain text >...<
    if (trimmed.startsWith('>') && trimmed.endsWith('<') && trimmed.length > 2) {
      const inner = trimmed.slice(1, -1).trim();
      let type: ScreenplayElementType = 'generalText';
      if (/^ACT\s+[IVX0-9]+/i.test(inner)) type = 'actHeading';
      else if (/^END\s+OF\s+ACT/i.test(inner)) type = 'endAct';
      blocks.push({
        type,
        content: [{ type: 'text', text: inner }],
      });
      plainLines.push(inner);
      prevType = type;
      continue;
    }

    // Forced Fountain Transition >...
    if (trimmed.startsWith('>') && !trimmed.endsWith('<')) {
      const transText = trimmed.slice(1).trim().toUpperCase();
      blocks.push({
        type: 'transition',
        content: [{ type: 'text', text: transText }],
      });
      plainLines.push(transText);
      prevType = 'transition';
      continue;
    }

    // Lyrics ~...
    if (trimmed.startsWith('~')) {
      const lyricText = trimmed.slice(1).trim();
      blocks.push({
        type: 'lyrics',
        content: [{ type: 'text', text: lyricText }],
      });
      plainLines.push(lyricText);
      prevType = 'lyrics';
      continue;
    }

    // Forced Scene Heading .HEADING
    if (trimmed.startsWith('.') && !trimmed.startsWith('..') && trimmed.length > 1) {
      const headingText = trimmed.slice(1).trim().toUpperCase();
      blocks.push({
        type: 'sceneHeading',
        content: [{ type: 'text', text: headingText }],
      });
      plainLines.push(headingText);
      prevType = 'sceneHeading';
      continue;
    }

    // Forced Action !Action
    if (trimmed.startsWith('!') && trimmed.length > 1) {
      const actText = trimmed.slice(1).trim();
      blocks.push({
        type: 'action',
        content: [{ type: 'text', text: actText }],
      });
      plainLines.push(actText);
      prevType = 'action';
      continue;
    }

    // Forced Character @CHARACTER or Dual Dialogue CHARACTER ^
    const isDualRight = trimmed.endsWith('^') && trimmed.length > 1;
    const isForcedChar = trimmed.startsWith('@') && trimmed.length > 1;
    if (isForcedChar || isDualRight) {
      const charName = (isForcedChar ? trimmed.slice(1) : trimmed)
        .replace(/\^\s*$/, '')
        .trim()
        .toUpperCase();

      if (isDualRight) {
        // Collect the right-side dialogue lines that follow this character
        const rightColNodes: JSONContent[] = [
          { type: 'character', content: [{ type: 'text', text: charName }] },
        ];
        plainLines.push(`${charName} ^`);

        while (i + 1 < lines.length && lines[i + 1].trim().length > 0) {
          i += 1;
          const nextTrimmed = lines[i].trim();
          const subType: ScreenplayElementType =
            nextTrimmed.startsWith('(') && nextTrimmed.endsWith(')')
              ? 'parenthetical'
              : 'dialogue';
          rightColNodes.push({
            type: subType,
            content: [{ type: 'text', text: nextTrimmed }],
          });
          plainLines.push(nextTrimmed);
        }

        // Group with preceding character + dialogue blocks into a dualDialogue container
        const leftColNodes: JSONContent[] = [];
        while (
          blocks.length > 0 &&
          (blocks[blocks.length - 1].type === 'dialogue' ||
            blocks[blocks.length - 1].type === 'parenthetical' ||
            blocks[blocks.length - 1].type === 'character')
        ) {
          const popped = blocks.pop()!;
          leftColNodes.unshift(popped);
          if (popped.type === 'character') break;
        }

        if (leftColNodes.length > 0) {
          blocks.push({
            type: 'dualDialogue',
            content: [
              {
                type: 'dualDialogueColumn',
                attrs: { side: 'left' },
                content: leftColNodes,
              },
              {
                type: 'dualDialogueColumn',
                attrs: { side: 'right' },
                content: rightColNodes,
              },
            ],
          });
          prevType = null;
          continue;
        }
      }

      blocks.push({
        type: 'character',
        content: [{ type: 'text', text: charName }],
      });
      plainLines.push(charName);
      prevType = 'character';
      continue;
    }

    // Standard Fountain / Plain Text element classification
    let type: ScreenplayElementType = 'action';
    if (/^(ACT\s+[IVX0-9]+|ACT\s+ONE|ACT\s+TWO|ACT\s+THREE)\b/i.test(trimmed)) {
      type = 'actHeading';
    } else if (/^END\s+OF\s+ACT\b/i.test(trimmed)) {
      type = 'endAct';
    } else if (/^SEQUENCE\s+[A-Z0-9]+\b/i.test(trimmed)) {
      type = 'sequenceHeading';
    } else if (/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s*/i.test(trimmed)) {
      type = 'sceneHeading';
    } else if (
      /^(FADE IN:|FADE OUT\.|CUT TO:|SMASH CUT TO:|DISSOLVE TO:|MATCH CUT TO:)$/i.test(
        trimmed
      ) ||
      (/^[A-Z0-9\s]+TO:$/.test(trimmed) && trimmed.length < 30)
    ) {
      type = 'transition';
    } else if (
      /^(ANGLE ON|CLOSE ON|WIDE SHOT|POV|INSERT|BACK TO SCENE|ACROSS THE STAGE)\b/i.test(
        trimmed
      ) &&
      trimmed === trimmed.toUpperCase()
    ) {
      type = 'shot';
    } else if (
      trimmed.startsWith('(') &&
      trimmed.endsWith(')') &&
      (prevType === 'character' || prevType === 'dialogue')
    ) {
      type = 'parenthetical';
    } else if (prevType === 'character' || prevType === 'parenthetical') {
      type = 'dialogue';
    } else if (
      trimmed === trimmed.toUpperCase() &&
      /[A-Z]/.test(trimmed) &&
      trimmed.length <= 38 &&
      !trimmed.endsWith('.') &&
      i + 1 < lines.length &&
      lines[i + 1].trim().length > 0
    ) {
      type = 'character';
    }

    blocks.push({
      type,
      content: [{ type: 'text', text: trimmed }],
    });
    plainLines.push(trimmed);
    prevType = type;
  }

  if (blocks.length === 0) {
    blocks.push({ type: 'action' });
  }

  return {
    doc: { type: 'doc', content: blocks },
    cleanText: plainLines.join('\n\n'),
  };
}

/**
 * Validates and parses an uploaded screenplay file (.fountain, .fdx, .txt) using
 * the existing SceneOS screenplay validation and parser services.
 */
export async function importScreenplayFile(
  file: File
): Promise<ScreenplayImportPreview> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';
  if (ext === 'pdf' || ext === 'docx') {
    const canonicalPreview = await processScreenplayImportFile(file);
    const tiptapDoc = canonicalToTiptapDoc(canonicalPreview.canonical);
    const fullText = canonicalToPlainText(canonicalPreview.canonical);
    const parsedScenes = canonicalToParsedScenes(canonicalPreview.canonical);
    const intelligence = extractScriptIntelligenceFromDoc({
      doc: tiptapDoc,
      sourceDocumentId: 'import-preview',
      format: ext as ScreenplayFormat,
    });
    return {
      title: canonicalPreview.title,
      fileName: canonicalPreview.fileName,
      fileSize: canonicalPreview.fileSize,
      sourceFormat: ext as ScreenplayFormat,
      rawText: fullText,
      documentJson: JSON.stringify(tiptapDoc),
      doc: tiptapDoc,
      scenes: parsedScenes,
      characters: canonicalPreview.characterNames,
      locations: intelligence.locations,
      totalScenes: canonicalPreview.totalScenes,
      totalPageEighths: intelligence.totalPageEighths,
      totalPageCountDisplay: String(canonicalPreview.estimatedPages),
      warnings: (canonicalPreview.warnings || []).map((w) => ({
        type: 'warning' as const,
        message: w.message,
      })),
      sourcePdfDataUrl: canonicalPreview.sourcePdfDataUrl,
      pdfLayout: canonicalPreview.canonical.pdfLayout,
      titlePageMetadata: {
        title: canonicalPreview.title,
        author: canonicalPreview.authors[0] || '',
      },
    };
  }

  const integrity = await validateScreenplayFileIntegrity(file);
  if (!integrity.isValid) {
    throw new Error(integrity.error || 'Invalid screenplay file.');
  }

  const parsedPreview = await screenplayParserService.generatePreview(file);
  const rawFileText = await file.text();
  const sourceFormat = parsedPreview.documentSummary.sourceFormat;

  let doc: JSONContent;
  let cleanText: string;

  if (ext === 'fdx' || sourceFormat === 'fdx') {
    const fdxConverted = parseFdxXmlToScreenplayDoc(rawFileText);
    doc = fdxConverted.doc;
    cleanText = fdxConverted.cleanText;
  } else if (ext === 'fountain' || sourceFormat === 'fountain') {
    const fountainConverted = parseFountainToScreenplayDoc(rawFileText);
    doc = fountainConverted.doc;
    cleanText = fountainConverted.cleanText;
  } else {
    doc = parsePlainTextToScreenplayDoc(rawFileText);
    cleanText = rawFileText.replace(/\r\n/g, '\n').trim();
  }

  const fallbackTitle =
    file.name.replace(/\.(fountain|fdx|txt|md)$/i, '').trim() || 'Imported Screenplay';
  const resolvedTitle =
    parsedPreview.documentSummary.title?.trim() || fallbackTitle;

  const intelligence = extractScriptIntelligenceFromDoc({
    doc,
    sourceDocumentId: 'import-preview',
    format: sourceFormat,
  });

  const detectedScenes =
    intelligence.scenes.length > 0
      ? intelligence.scenes
      : parsedPreview.detectedScenes || [];
  const totalEighths =
    intelligence.scenes.length > 0
      ? intelligence.totalPageEighths
      : detectedScenes.reduce((sum, s) => sum + (s.pageLengthEighths || 0), 0);
  const characters =
    intelligence.scenes.length > 0
      ? intelligence.characters
      : Array.from(new Set(detectedScenes.flatMap((s) => s.characters || [])));
  const locations =
    intelligence.scenes.length > 0
      ? intelligence.locations
      : Array.from(new Set(detectedScenes.map((s) => s.location).filter(Boolean)));
  const mergedWarnings = [
    ...(parsedPreview.warnings || []),
    ...intelligence.warnings.filter(
      (w) =>
        !(parsedPreview.warnings || []).some(
          (pw) => pw.message === w.message && pw.sceneNumber === w.sceneNumber
        )
    ),
  ];

  return {
    title: resolvedTitle,
    fileName: file.name,
    fileSize: file.size,
    sourceFormat,
    rawText: cleanText,
    documentJson: JSON.stringify(doc),
    doc,
    scenes: detectedScenes,
    characters,
    locations,
    totalScenes: detectedScenes.length,
    totalPageEighths: totalEighths,
    totalPageCountDisplay:
      intelligence.scenes.length > 0
        ? intelligence.totalPageCountDisplay
        : parsedPreview.documentSummary.pageCountDisplay || '1',
    warnings: mergedWarnings,
    titlePageMetadata: {
      title: resolvedTitle,
      author: parsedPreview.documentSummary.author,
    },
  };
}

/**
 * Converts a ScreenplayImportPreview into a persisted ScreenplayVersion record.
 */
export function buildScriptVersionFromImport(
  preview: ScreenplayImportPreview,
  options?: {
    existingScript?: ScreenplayVersion | null;
    author?: string;
    owner?: string;
  }
): ScreenplayVersion {
  const nowIso = new Date().toISOString();
  const existing = options?.existingScript;
  const author =
    preview.titlePageMetadata?.author ||
    options?.author ||
    existing?.author ||
    'Screenwriter';

  const id =
    existing?.id ||
    `scr-doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const existingRevisions = existing?.revisions ?? [];
  const nextLabel = existing
    ? computeNextVersionLabel(existing.version, existingRevisions.length)
    : 'v1.0';
  const stats = computeDocumentQuickStats(preview.doc, preview.rawText);

  const reconciledIntelligence = extractScriptIntelligenceFromDoc({
    doc: preview.doc,
    sourceDocumentId: id,
    priorScenes: existing?.scenes ?? preview.scenes,
    format: preview.sourceFormat,
  });

  const finalScenes =
    reconciledIntelligence.scenes.length > 0
      ? reconciledIntelligence.scenes
      : preview.scenes;
  const finalCharacters =
    reconciledIntelligence.scenes.length > 0
      ? reconciledIntelligence.characters
      : preview.characters;
  const finalLocations =
    reconciledIntelligence.scenes.length > 0
      ? reconciledIntelligence.locations
      : preview.locations;

  const importRevision: ScreenplayRevisionSnapshot = {
    id: `rev-${Date.now()}-import`,
    versionLabel: nextLabel,
    title: preview.title,
    author,
    createdAt: nowIso,
    changeDescription: `Imported from ${preview.fileName} (${preview.sourceFormat.toUpperCase()})`,
    rawText: preview.rawText,
    documentJson: preview.documentJson,
    wordCount: stats.wordCount,
    sceneCount: finalScenes.length || preview.totalScenes || stats.sceneCount,
  };

  return {
    ...(existing || {}),
    id,
    version: nextLabel,
    title: preview.title,
    author,
    owner: options?.owner ?? existing?.owner,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
    lastSavedAt: nowIso,
    changeDescription: importRevision.changeDescription,
    contentSnippet: extractScriptSnippet(preview.rawText),
    status: existing?.status || 'Draft',
    fileName: preview.fileName,
    sourceFormat: preview.sourceFormat,
    fileSize: preview.fileSize,
    totalScenes: finalScenes.length || preview.totalScenes || stats.sceneCount,
    totalPageEighths:
      reconciledIntelligence.scenes.length > 0
        ? reconciledIntelligence.totalPageEighths
        : preview.totalPageEighths,
    totalPageCountDisplay:
      reconciledIntelligence.scenes.length > 0
        ? reconciledIntelligence.totalPageCountDisplay
        : preview.totalPageCountDisplay,
    characters: finalCharacters,
    locations: finalLocations,
    scenes: finalScenes,
    warnings: preview.warnings,
    rawText: preview.rawText,
    documentJson: preview.documentJson,
    content: preview.doc,
    sourcePdfDataUrl: preview.sourcePdfDataUrl,
    pdfLayout: preview.pdfLayout,
    titlePageMetadata: preview.titlePageMetadata,
    importMetadata: {
      originalFileName: preview.fileName,
      importedFormat: preview.sourceFormat,
      importedAt: nowIso,
      fileSize: preview.fileSize,
      warningCount: preview.warnings.length,
    },
    revisions: [...existingRevisions, importRevision],
  };
}

/**
 * Helper to extract text content from a JSONContent node.
 */
function getJsonNodeText(node: JSONContent): string {
  if (typeof node.text === 'string') return node.text;
  if (!Array.isArray(node.content)) return '';
  return node.content.map(getJsonNodeText).join('');
}

/**
 * Exports a ProseMirror JSONContent screenplay document to genuine Fountain (.fountain) format.
 * Internal `screenplayNote` and `screenplayImage` nodes are excluded from screenplay dialogue/action output.
 */
export function exportScreenplayToFountain(
  docOrJson: JSONContent | string,
  metadata?: { title?: string; author?: string }
): string {
  const doc: JSONContent =
    typeof docOrJson === 'string'
      ? deserializeScreenplayDocument(docOrJson, '')
      : docOrJson;

  const lines: string[] = [];

  if (metadata?.title) {
    lines.push(`Title: ${metadata.title}`);
    if (metadata.author) {
      lines.push(`Author: ${metadata.author}`);
    }
    lines.push(`Draft date: ${new Date().toISOString().slice(0, 10)}`);
    lines.push('');
  }

  const blocks = doc.content ?? [];

  for (const node of blocks) {
    const type = node.type;
    if (!type || type === 'screenplayNote' || type === 'screenplayImage') {
      continue;
    }

    if (type === 'dualDialogue' && Array.isArray(node.content)) {
      node.content.forEach((col, colIdx) => {
        const colChildren = col.content ?? [];
        colChildren.forEach((child) => {
          const text = getJsonNodeText(child).trim();
          if (!text) return;
          if (child.type === 'character') {
            lines.push('');
            lines.push(colIdx === 1 ? `${text.toUpperCase()} ^` : text.toUpperCase());
          } else if (child.type === 'parenthetical') {
            const wrapped =
              text.startsWith('(') && text.endsWith(')') ? text : `(${text})`;
            lines.push(wrapped);
          } else {
            lines.push(text);
          }
        });
      });
      continue;
    }

    const text = getJsonNodeText(node).trim();
    if (!text) continue;

    switch (type) {
      case 'actHeading':
      case 'endAct':
        lines.push('');
        lines.push(`>${text.toUpperCase()}<`);
        break;
      case 'sequenceHeading':
        lines.push('');
        lines.push(text.toUpperCase());
        break;
      case 'sceneHeading': {
        lines.push('');
        const upper = text.toUpperCase();
        const isStandardSlug = /^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s*/i.test(upper);
        lines.push(isStandardSlug ? upper : `.${upper}`);
        break;
      }
      case 'character':
        lines.push('');
        lines.push(text.toUpperCase());
        break;
      case 'parenthetical': {
        const wrapped =
          text.startsWith('(') && text.endsWith(')') ? text : `(${text})`;
        lines.push(wrapped);
        break;
      }
      case 'dialogue':
        lines.push(text);
        break;
      case 'transition': {
        lines.push('');
        const upper = text.toUpperCase();
        lines.push(upper.endsWith('TO:') || upper.startsWith('FADE') ? upper : `> ${upper}`);
        break;
      }
      case 'lyrics':
        lines.push('');
        lines.push(`~${text}`);
        break;
      case 'shot':
        lines.push('');
        lines.push(text.toUpperCase());
        break;
      default:
        lines.push('');
        lines.push(text);
        break;
    }
  }

  return lines.join('\n').replace(/^\n+/, '').trimEnd() + '\n';
}

/**
 * Exports a ProseMirror JSONContent screenplay document to genuine Final Draft XML (.fdx).
 * Excludes internal `screenplayNote` and pagination decorations.
 */
export function exportScreenplayToFdx(
  docOrJson: JSONContent | string,
  metadata?: { title?: string; author?: string }
): string {
  const doc: JSONContent =
    typeof docOrJson === 'string'
      ? deserializeScreenplayDocument(docOrJson, '')
      : docOrJson;

  const escapeXml = (str: string): string =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const mapTypeToFdx = (type?: string): string => {
    switch (type) {
      case 'sceneHeading':
        return 'Scene Heading';
      case 'action':
        return 'Action';
      case 'character':
        return 'Character';
      case 'parenthetical':
        return 'Parenthetical';
      case 'dialogue':
        return 'Dialogue';
      case 'transition':
        return 'Transition';
      case 'shot':
        return 'Shot';
      case 'actHeading':
        return 'New Act';
      case 'endAct':
        return 'End of Act';
      case 'sequenceHeading':
        return 'Sequence';
      case 'lyrics':
        return 'Lyrics';
      case 'generalText':
      default:
        return 'General';
    }
  };

  const paragraphXmlLines: string[] = [];
  const blocks = doc.content ?? [];

  for (const node of blocks) {
    const type = node.type;
    if (!type || type === 'screenplayNote' || type === 'screenplayImage') {
      continue;
    }

    if (type === 'dualDialogue' && Array.isArray(node.content)) {
      const innerParas: string[] = [];
      node.content.forEach((col) => {
        (col.content ?? []).forEach((child) => {
          const text = getJsonNodeText(child).trim();
          if (!text) return;
          const fdxType = mapTypeToFdx(child.type);
          innerParas.push(
            `        <Paragraph Type="${fdxType}"><Text>${escapeXml(text)}</Text></Paragraph>`
          );
        });
      });
      if (innerParas.length > 0) {
        paragraphXmlLines.push(
          `    <Paragraph>\n      <DualDialogue>\n${innerParas.join('\n')}\n      </DualDialogue>\n    </Paragraph>`
        );
      }
      continue;
    }

    const text = getJsonNodeText(node).trim();
    if (!text) continue;
    const fdxType = mapTypeToFdx(type);
    paragraphXmlLines.push(
      `    <Paragraph Type="${fdxType}"><Text>${escapeXml(text)}</Text></Paragraph>`
    );
  }

  const titleXml = metadata?.title
    ? `  <TitlePage>\n    <Content>\n      <Paragraph Type="Title"><Text>${escapeXml(metadata.title)}</Text></Paragraph>\n    </Content>\n  </TitlePage>\n`
    : '';

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>',
    '<FinalDraft DocumentType="Script" Template="No" Version="4">',
    '  <Content>',
    ...paragraphXmlLines,
    '  </Content>',
    titleXml.trimEnd(),
    '</FinalDraft>',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Exports a ProseMirror JSONContent screenplay document to traditionally indented Plain Text (.txt).
 * Excludes internal `screenplayNote` and pagination decorations.
 */
export function exportScreenplayToPlainText(
  docOrJson: JSONContent | string,
  metadata?: { title?: string; author?: string }
): string {
  const doc: JSONContent =
    typeof docOrJson === 'string'
      ? deserializeScreenplayDocument(docOrJson, '')
      : docOrJson;

  const lines: string[] = [];

  if (metadata?.title) {
    lines.push(metadata.title.toUpperCase());
    if (metadata.author) {
      lines.push(`by ${metadata.author}`);
    }
    lines.push('');
    lines.push('='.repeat(60));
    lines.push('');
  }

  const blocks = doc.content ?? [];

  for (const node of blocks) {
    const type = node.type;
    if (!type || type === 'screenplayNote' || type === 'screenplayImage') {
      continue;
    }

    if (type === 'dualDialogue' && Array.isArray(node.content)) {
      node.content.forEach((col, colIdx) => {
        (col.content ?? []).forEach((child) => {
          const text = getJsonNodeText(child).trim();
          if (!text) return;
          if (child.type === 'character') {
            lines.push('');
            lines.push(
              `                      ${text.toUpperCase()}${colIdx === 1 ? ' (DUAL)' : ''}`
            );
          } else if (child.type === 'parenthetical') {
            const wrapped =
              text.startsWith('(') && text.endsWith(')') ? text : `(${text})`;
            lines.push(`                ${wrapped}`);
          } else {
            lines.push(`          ${text}`);
          }
        });
      });
      continue;
    }

    const text = getJsonNodeText(node).trim();
    if (!text) continue;

    switch (type) {
      case 'actHeading':
      case 'endAct':
        lines.push('');
        lines.push(`                         ${text.toUpperCase()}`);
        break;
      case 'sequenceHeading':
      case 'sceneHeading':
      case 'shot':
        lines.push('');
        lines.push(text.toUpperCase());
        break;
      case 'character':
        lines.push('');
        lines.push(`                      ${text.toUpperCase()}`);
        break;
      case 'parenthetical': {
        const wrapped =
          text.startsWith('(') && text.endsWith(')') ? text : `(${text})`;
        lines.push(`                ${wrapped}`);
        break;
      }
      case 'dialogue':
        lines.push(`          ${text}`);
        break;
      case 'transition':
        lines.push('');
        lines.push(`                                             ${text.toUpperCase()}`);
        break;
      default:
        lines.push('');
        lines.push(text);
        break;
    }
  }

  return lines.join('\n').replace(/^\n+/, '').trimEnd() + '\n';
}

/**
 * Formats a clean download filename from the screenplay document title and target extension.
 */
export function formatScreenplayExportFilename(
  title: string,
  format: ScreenplayExportFormat
): string {
  const slug =
    (title || 'screenplay')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'screenplay';
  return `${slug}.${format}`;
}

/**
 * Triggers a browser file download for an exported screenplay.
 */
export function triggerScreenplayDownload(
  content: string | Uint8Array,
  filename: string,
  mimeType = 'text/plain;charset=utf-8'
): void {
  if (typeof document === 'undefined' || typeof Blob === 'undefined') return;
  const blob = new Blob([content as any], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
