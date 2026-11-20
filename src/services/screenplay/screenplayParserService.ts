/**
 * SceneOS — Screenplay Parser & Ingestion Service
 * Central coordinator for multi-format screenplay ingestion, validation, and breakdown extraction.
 */

import {
  FormatAdapter,
  ParsedScene,
  ParsingWarning,
  ScreenplayDocument,
  ScreenplayFormat,
  ScreenplayImportPreview,
  ScreenplayValidationResult,
} from './types';
import {
  validateScreenplayFile,
  validateScreenplayFileIntegrity,
  checkDuplicateScreenplay,
} from './validation';
import { formatEighths } from './eighthsHelper';
import { reconcileSceneRevisions } from './sceneIdentityService';
import { FdxAdapter } from './adapters/FdxAdapter';
import { FountainAdapter } from './adapters/FountainAdapter';
import { TextAdapter } from './adapters/TextAdapter';
import { PdfAdapter } from './adapters/PdfAdapter';
import { DocxAdapter } from './adapters/DocxAdapter';
import { RtfAdapter } from './adapters/RtfAdapter';
import { ScreenplayVersion } from '../../types';

export class ScreenplayParserService {
  private adapters: Map<ScreenplayFormat, FormatAdapter> = new Map();

  constructor() {
    this.registerAdapter(new FdxAdapter());
    this.registerAdapter(new FountainAdapter());
    this.registerAdapter(new TextAdapter());
    this.registerAdapter(new PdfAdapter());
    this.registerAdapter(new DocxAdapter());
    this.registerAdapter(new RtfAdapter());
  }

  registerAdapter(adapter: FormatAdapter) {
    this.adapters.set(adapter.format, adapter);
  }

  getAdapter(format: ScreenplayFormat): FormatAdapter | undefined {
    return this.adapters.get(format);
  }

  /**
   * Step 1: Pre-upload validation (basic sync)
   */
  validate(file: File): ScreenplayValidationResult {
    return validateScreenplayFile(file);
  }

  /**
   * Step 1b: Content-aware file integrity validation (checks magic bytes)
   */
  async validateIntegrity(file: File, buffer?: ArrayBuffer): Promise<ScreenplayValidationResult> {
    return validateScreenplayFileIntegrity(file, buffer);
  }

  /**
   * Step 2: Ingest file and generate pre-import human review preview
   */
  async generatePreview(
    file: File,
    existingVersions: ScreenplayVersion[] = []
  ): Promise<ScreenplayImportPreview> {
    // 1. Content-aware file validation (blocks misleading extensions and corrupted containers)
    const validation = await this.validateIntegrity(file);
    if (!validation.isValid) {
      throw new Error(`Screenplay validation failed: ${validation.error}`);
    }

    const format = validation.format;
    const adapter = this.adapters.get(format);
    if (!adapter) {
      throw new Error(`No parser adapter available for format: ${format}`);
    }

    // 2. Parse with designated adapter
    const parsed = await adapter.parse(file);

    // 3. Reconcile with prior draft scenes if this is a revision of an existing script
    const duplicateCheck = checkDuplicateScreenplay(file.name, existingVersions);
    const priorScenes: ParsedScene[] = duplicateCheck.matchedVersion?.scenes || (
      existingVersions.length > 0 && existingVersions[0].scenes ? existingVersions[0].scenes : []
    );

    const reconciliation = reconcileSceneRevisions(parsed.scenes, priorScenes, format);
    const finalizedScenes = reconciliation.reconciledScenes;

    // 4. Compute metrics
    const totalEighths = finalizedScenes.reduce((sum, s) => sum + s.pageLengthEighths, 0);
    const characters = Array.from(new Set(finalizedScenes.flatMap(s => s.characters)));
    const locations = Array.from(new Set(finalizedScenes.map(s => s.location).filter(Boolean)));
    const warnings: ParsingWarning[] = [...parsed.warnings, ...reconciliation.reconciliationWarnings];

    // If 0 scenes detected, warn user
    if (finalizedScenes.length === 0) {
      warnings.push({
        id: 'no-scenes-detected',
        severity: 'warning',
        message: 'No scene headings (INT/EXT) detected. You can review the raw text or adjust file formatting.',
      });
    }

    if (duplicateCheck.isDuplicate) {
      warnings.push({
        id: 'duplicate-detected',
        severity: 'info',
        message: `A screenplay with this name exists in project. Suggested revision tag: ${duplicateCheck.nextVersionTag}. (${reconciliation.matchedCount} scene(s) matched, ${reconciliation.ambiguousCount} ambiguous).`,
      });
    }

    const fileSizeFormatted = `${validation.fileSizeMB} MB`;
    const docTitle = parsed.title || file.name.replace(/\.[^/.]+$/, '');

    return {
      documentSummary: {
        title: docTitle,
        author: parsed.author || 'Screenplay Author',
        fileName: file.name,
        fileSizeFormatted,
        sourceFormat: format,
        sceneCount: finalizedScenes.length,
        pageCountDisplay: formatEighths(totalEighths),
        characterCount: characters.length,
        locationCount: locations.length,
        warningCount: warnings.length,
      },
      detectedScenes: finalizedScenes,
      warnings,
      duplicateDetected: duplicateCheck.isDuplicate,
      existingVersion: duplicateCheck.matchedVersion?.version,
      suggestedVersion: duplicateCheck.nextVersionTag,
      rawText: parsed.rawText,
    };
  }

  /**
   * Step 3: Human-confirmed persistence model creation
   */
  finalizeDocument(
    preview: ScreenplayImportPreview,
    options: {
      projectId: string;
      customTitle?: string;
      versionTag: string;
      approvedScenes: ParsedScene[];
    }
  ): ScreenplayDocument {
    const scenes = options.approvedScenes;
    const totalEighths = scenes.reduce((sum, s) => sum + s.pageLengthEighths, 0);
    const characters = Array.from(new Set(scenes.flatMap(s => s.characters)));
    const locations = Array.from(new Set(scenes.map(s => s.location).filter(Boolean)));

    return {
      id: `scr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      projectId: options.projectId,
      title: options.customTitle || preview.documentSummary.title,
      version: options.versionTag,
      author: preview.documentSummary.author,
      fileName: preview.documentSummary.fileName,
      fileSize: parseFloat(preview.documentSummary.fileSizeFormatted) * 1024 * 1024,
      sourceFormat: preview.documentSummary.sourceFormat,
      importedAt: new Date().toISOString(),
      totalScenes: scenes.length,
      totalPageEighths: totalEighths,
      totalPageCountDisplay: formatEighths(totalEighths),
      characters,
      locations,
      status: 'Draft',
      scenes,
      warnings: preview.warnings,
      rawText: preview.rawText,
    };
  }
}

export const screenplayParserService = new ScreenplayParserService();
