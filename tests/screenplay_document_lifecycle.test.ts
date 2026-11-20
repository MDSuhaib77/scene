import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { SCREENPLAY_SCHEMA_EXTENSIONS } from '../src/features/screenplay/schema/screenplayExtensions';
import { ScreenplayNavigationPanel } from '../src/features/screenplay/components/ScreenplayNavigationPanel';
import { ScreenplayToolbar } from '../src/features/screenplay/components/ScreenplayToolbar';
import {
  EMPTY_SCREENPLAY_DOC,
  resolveScriptText,
  resolveScriptDoc,
  createEmptyScriptDocument,
  duplicateScriptDocument,
  renameScriptDocument,
  filterScriptLibrary,
  createScriptCheckpoint,
  restoreScriptRevision,
  computeRevisionDiff,
  parseFdxXmlToScreenplayDoc,
  parseFountainToScreenplayDoc,
  importScreenplayFile,
  buildScriptVersionFromImport,
  exportScreenplayToFountain,
  exportScreenplayToFdx,
  exportScreenplayToPlainText,
  formatScreenplayExportFilename,
} from '../src/features/screenplay/services/screenplayDocumentLifecycle';
import { computeScreenplayPagination } from '../src/features/screenplay/layout/screenplayPaginationEngine';

function createEditorWithDoc(content: any) {
  return new Editor({
    extensions: [
      StarterKit.configure({
        paragraph: false,
        heading: false,
        blockquote: false,
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
        bold: false,
        italic: false,
        strike: false,
        code: false,
      }),
      ...SCREENPLAY_SCHEMA_EXTENSIONS,
    ],
    content,
  });
}

describe('SceneOS Prompt 04 — Script Library, Screenplay Documents, and Document Lifecycle', () => {
  it('creates a genuinely empty screenplay document without fake sample text and preserves blank state on reopen', () => {
    const blank = createEmptyScriptDocument({
      title: 'Pilot — Episode 101',
      author: 'Elena Rostova',
    });

    expect(blank.id).toMatch(/^scr-doc-/);
    expect(blank.title).toBe('Pilot — Episode 101');
    expect(blank.version).toBe('v1.0');
    expect(blank.rawText).toBe('');
    expect(JSON.parse(blank.documentJson!)).toEqual(EMPTY_SCREENPLAY_DOC);
    expect(blank.revisions).toHaveLength(1);

    // Must not inject fallback sample text when reopening an intentionally blank script
    expect(resolveScriptText(blank, 'FAKE SAMPLE FALLBACK')).toBe('');
    expect(resolveScriptDoc(blank, 'FAKE SAMPLE FALLBACK')).toEqual(
      EMPTY_SCREENPLAY_DOC
    );

    const editor = createEditorWithDoc(resolveScriptDoc(blank, 'FAKE SAMPLE FALLBACK'));
    expect(editor.state.doc.textContent).toBe('');
    expect(editor.state.doc.firstChild?.type.name).toBe('action');
    editor.destroy();
  });

  it('supports renaming, duplicating with independent ID and history, and searching scripts in the library', () => {
    const original = createEmptyScriptDocument({
      title: 'The Glass Harbor',
      author: 'Kira Vance',
    });
    const withContent = createScriptCheckpoint({
      script: original,
      liveText: 'INT. HARBOR DOCKS - NIGHT\n\nFog rolls across the pier.',
      liveDocJson: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'sceneHeading',
            content: [{ type: 'text', text: 'INT. HARBOR DOCKS - NIGHT' }],
          },
          {
            type: 'action',
            content: [{ type: 'text', text: 'Fog rolls across the pier.' }],
          },
        ],
      }),
      changeDescription: 'Added opening dock scene',
    });

    // Rename preserves ID, content, and revisions
    const renamed = renameScriptDocument(withContent, 'The Glass Harbor — Revised');
    expect(renamed.id).toBe(withContent.id);
    expect(renamed.title).toBe('The Glass Harbor — Revised');
    expect(renamed.rawText).toContain('INT. HARBOR DOCKS - NIGHT');

    // Duplicate produces a distinct ID and fresh revision history
    const duplicated = duplicateScriptDocument(renamed);
    expect(duplicated.id).not.toBe(renamed.id);
    expect(duplicated.title).toBe('The Glass Harbor — Revised (Copy)');
    expect(duplicated.rawText).toBe(renamed.rawText);
    expect(duplicated.revisions).toHaveLength(1);
    expect(duplicated.revisions![0].changeDescription).toContain(
      'Duplicated from "The Glass Harbor — Revised"'
    );

    // Search filter matches title, version, author, or snippet
    const library = [renamed, duplicated];
    expect(filterScriptLibrary(library, 'copy')).toHaveLength(1);
    expect(filterScriptLibrary(library, 'copy')[0].id).toBe(duplicated.id);
    expect(filterScriptLibrary(library, 'harbor')).toHaveLength(2);
    expect(filterScriptLibrary(library, 'nonexistent-query')).toHaveLength(0);
  });

  it('creates version checkpoints, computes line diffs, and restores previous revisions without losing newer history', () => {
    const base = createEmptyScriptDocument({
      title: 'Chronos Station',
      author: 'Elena Rostova',
    });

    const v11Text = 'INT. REACTOR CORE - NIGHT\n\nCOLE\nShut down the turbines.';
    const v11 = createScriptCheckpoint({
      script: base,
      liveText: v11Text,
      liveDocJson: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'sceneHeading',
            content: [{ type: 'text', text: 'INT. REACTOR CORE - NIGHT' }],
          },
          { type: 'character', content: [{ type: 'text', text: 'COLE' }] },
          {
            type: 'dialogue',
            content: [{ type: 'text', text: 'Shut down the turbines.' }],
          },
        ],
      }),
      changeDescription: 'Drafted reactor core confrontation',
    });

    expect(v11.version).toBe('v1.1');
    expect(v11.revisions).toHaveLength(2);

    const v12Text =
      'INT. REACTOR CORE - DAWN\n\nCOLE\nOverload the auxiliary conduit.\n\nMARA\nCopy that.';
    const v12 = createScriptCheckpoint({
      script: v11,
      liveText: v12Text,
      liveDocJson: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'sceneHeading',
            content: [{ type: 'text', text: 'INT. REACTOR CORE - DAWN' }],
          },
        ],
      }),
      changeDescription: 'Rewrote reactor scene for dawn',
    });

    expect(v12.version).toBe('v1.2');
    expect(v12.revisions).toHaveLength(3);

    // Diff between v1.1 and v1.2
    const diff = computeRevisionDiff(v11Text, v12Text);
    expect(diff.isIdentical).toBe(false);
    expect(diff.addedCount).toBeGreaterThan(0);
    expect(diff.removedCount).toBeGreaterThan(0);
    expect(diff.unchangedCount).toBeGreaterThanOrEqual(1); // COLE is unchanged

    // Restore v1.1 into v1.2 — must restore v1.1 content AND preserve v1.2 in revision history
    const targetRevId = v12.revisions![1].id;
    const restored = restoreScriptRevision({
      script: v12,
      revisionId: targetRevId,
      currentLiveText: v12Text,
      currentLiveDocJson: v12.documentJson,
    });

    expect(restored).not.toBeNull();
    expect(restored!.updatedScript.rawText).toBe(v11Text);
    expect(restored!.updatedScript.revisions!.length).toBeGreaterThanOrEqual(4);
    expect(
      restored!.updatedScript.revisions!.some((r) => r.versionLabel === 'v1.2')
    ).toBe(true);

    // Verify the restored document loads cleanly into Tiptap and paginates properly
    const editor = createEditorWithDoc(
      resolveScriptDoc(restored!.updatedScript, '')
    );
    const pagination = computeScreenplayPagination(editor.state.doc);
    expect(pagination.pageCount).toBe(1);
    expect(editor.state.doc.firstChild?.type.name).toBe('sceneHeading');
    editor.destroy();
  });

  it('parses Final Draft (.fdx) XML and Fountain (.fountain) into semantic screenplay elements without leaking XML tags', () => {
    const sampleFdx = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="4">
  <Content>
    <Paragraph Type="New Act"><Text>ACT I</Text></Paragraph>
    <Paragraph Type="Scene Heading"><Text>INT. OBSERVATORY DOME - NIGHT</Text></Paragraph>
    <Paragraph Type="Action"><Text>Telemetry screens flicker across the dark room.</Text></Paragraph>
    <Paragraph Type="Character"><Text>DR. ARIS</Text></Paragraph>
    <Paragraph Type="Parenthetical"><Text>(adjusting lens)</Text></Paragraph>
    <Paragraph Type="Dialogue"><Text>The signal is originating from Jupiter orbit.</Text></Paragraph>
    <Paragraph>
      <DualDialogue>
        <Paragraph Type="Character"><Text>ARIS</Text></Paragraph>
        <Paragraph Type="Dialogue"><Text>Lock the array!</Text></Paragraph>
        <Paragraph Type="Character"><Text>KIRA</Text></Paragraph>
        <Paragraph Type="Dialogue"><Text>Already locked!</Text></Paragraph>
      </DualDialogue>
    </Paragraph>
    <Paragraph Type="Transition"><Text>SMASH CUT TO:</Text></Paragraph>
  </Content>
</FinalDraft>`;

    const fdxParsed = parseFdxXmlToScreenplayDoc(sampleFdx);
    expect(fdxParsed.cleanText).toContain('INT. OBSERVATORY DOME - NIGHT');
    expect(fdxParsed.cleanText).not.toContain('<Paragraph');
    const nodeTypes = fdxParsed.doc.content!.map((n) => n.type);
    expect(nodeTypes).toEqual([
      'actHeading',
      'sceneHeading',
      'action',
      'character',
      'parenthetical',
      'dialogue',
      'dualDialogue',
      'transition',
    ]);

    const sampleFountain = `Title: Starlight Run
Author: Kira Vance

>ACT I<

.INT. CARGO HOLD - NIGHT

[[Internal pacing note: keep this tense]]

~Fly me to the stars

@CAPTAIN VANCE
(into comm)
 Seal the bulkhead!

LIEUTENANT REID ^
Holding pressure!

>CUT TO:`;

    const fountainParsed = parseFountainToScreenplayDoc(sampleFountain);
    const fTypes = fountainParsed.doc.content!.map((n) => n.type);
    expect(fTypes).toEqual([
      'actHeading',
      'sceneHeading',
      'screenplayNote',
      'lyrics',
      'dualDialogue',
      'transition',
    ]);
  });

  it('validates imported screenplay files and exports live documents to .fountain, .fdx, and .txt excluding internal notes', async () => {
    const fountainContent = `INT. ARCHIVE VAULT - NIGHT\n\nMARA\nOpen the ledger.\n`;
    const validFile = new File([fountainContent], 'archive-vault.fountain', {
      type: 'text/plain',
    });

    const preview = await importScreenplayFile(validFile);
    expect(preview.title).toBe('archive-vault');
    expect(preview.sourceFormat).toBe('fountain');
    expect(preview.totalScenes).toBe(1);

    const builtVersion = buildScriptVersionFromImport(preview, {
      author: 'Elena Rostova',
    });
    expect(builtVersion.importMetadata?.originalFileName).toBe(
      'archive-vault.fountain'
    );
    expect(builtVersion.revisions).toHaveLength(1);

    // Export with an internal screenplayNote — note must be excluded from exported files
    const docWithNote = {
      type: 'doc',
      content: [
        {
          type: 'sceneHeading',
          content: [{ type: 'text', text: 'INT. ARCHIVE VAULT - NIGHT' }],
        },
        {
          type: 'screenplayNote',
          content: [{ type: 'text', text: 'SECRET WRITER NOTE DO NOT EXPORT' }],
        },
        { type: 'character', content: [{ type: 'text', text: 'MARA' }] },
        {
          type: 'parenthetical',
          content: [{ type: 'text', text: '(whispering)' }],
        },
        {
          type: 'dialogue',
          content: [{ type: 'text', text: 'Open the ledger.' }],
        },
        { type: 'transition', content: [{ type: 'text', text: 'CUT TO:' }] },
      ],
    };

    const exportedFountain = exportScreenplayToFountain(docWithNote, {
      title: 'Archive Vault',
      author: 'Elena Rostova',
    });
    expect(exportedFountain).toContain('Title: Archive Vault');
    expect(exportedFountain).toContain('INT. ARCHIVE VAULT - NIGHT');
    expect(exportedFountain).toContain('MARA');
    expect(exportedFountain).toContain('Open the ledger.');
    expect(exportedFountain).not.toContain('SECRET WRITER NOTE DO NOT EXPORT');

    const exportedFdx = exportScreenplayToFdx(docWithNote, {
      title: 'Archive Vault',
    });
    expect(exportedFdx).toContain('<FinalDraft DocumentType="Script"');
    expect(exportedFdx).toContain(
      '<Paragraph Type="Scene Heading"><Text>INT. ARCHIVE VAULT - NIGHT</Text></Paragraph>'
    );
    expect(exportedFdx).toContain(
      '<Paragraph Type="Character"><Text>MARA</Text></Paragraph>'
    );
    expect(exportedFdx).not.toContain('SECRET WRITER NOTE DO NOT EXPORT');

    const exportedTxt = exportScreenplayToPlainText(docWithNote, {
      title: 'Archive Vault',
    });
    expect(exportedTxt).toContain('ARCHIVE VAULT');
    expect(exportedTxt).toContain('INT. ARCHIVE VAULT - NIGHT');
    expect(exportedTxt).not.toContain('SECRET WRITER NOTE DO NOT EXPORT');

    expect(formatScreenplayExportFilename('Archive Vault: Act I', 'fountain')).toBe(
      'archive-vault-act-i.fountain'
    );
    expect(formatScreenplayExportFilename('Archive Vault: Act I', 'fdx')).toBe(
      'archive-vault-act-i.fdx'
    );
  });

  it('renders the Bookshelf Script Library, Revision History, and Save Status indicators in the UI components', () => {
    const scriptA = createEmptyScriptDocument({
      title: 'Script Alpha',
      author: 'Kira Vance',
    });
    const scriptB = createScriptCheckpoint({
      script: createEmptyScriptDocument({
        title: 'Script Beta',
        author: 'Kira Vance',
      }),
      liveText: 'INT. SUBWAY PLATFORM - NIGHT\n\nSparks shower from the third rail.',
      liveDocJson: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'sceneHeading',
            content: [{ type: 'text', text: 'INT. SUBWAY PLATFORM - NIGHT' }],
          },
        ],
      }),
      changeDescription: 'Subway scene',
    });

    const libraryHtml = renderToStaticMarkup(
      React.createElement(ScreenplayNavigationPanel, {
        isOpen: true,
        activeSection: 'drafts',
        onSelectSection: vi.fn(),
        onClose: vi.fn(),
        projectName: 'Night Courier',
        versions: [scriptA, scriptB],
        activeVersionId: scriptB.id,
        currentLiveText: scriptB.rawText,
        onSelectVersion: vi.fn(),
        onNewBlankDraft: vi.fn(),
        onLoadSampleScript: vi.fn(),
        onImportScriptFile: vi.fn(),
        onRenameScript: vi.fn(),
        onDuplicateScript: vi.fn(),
        onDeleteScript: vi.fn(),
        onCreateCheckpoint: vi.fn(),
        onRestoreRevision: vi.fn(),
        onExportScript: vi.fn(),
        outlineEntries: [],
        onNavigateOutlineEntry: vi.fn(),
      })
    );

    expect(libraryHtml).toContain('screenplay-library-view');
    expect(libraryHtml).toContain('Script Alpha');
    expect(libraryHtml).toContain('Script Beta');
    expect(libraryHtml).toContain('screenplay-export-pdf-btn');
    expect(libraryHtml).toContain('screenplay-export-fountain-btn');
    expect(libraryHtml).toContain('screenplay-export-fdx-btn');
    expect(libraryHtml).not.toContain('screenplay-export-txt-btn');

    const revisionsHtml = renderToStaticMarkup(
      React.createElement(ScreenplayNavigationPanel, {
        isOpen: true,
        activeSection: 'revisions',
        onSelectSection: vi.fn(),
        onClose: vi.fn(),
        projectName: 'Night Courier',
        versions: [scriptA, scriptB],
        activeVersionId: scriptB.id,
        currentLiveText: scriptB.rawText,
        onSelectVersion: vi.fn(),
        onNewBlankDraft: vi.fn(),
        onLoadSampleScript: vi.fn(),
        onImportScriptFile: vi.fn(),
        onCreateCheckpoint: vi.fn(),
        onRestoreRevision: vi.fn(),
        outlineEntries: [],
        onNavigateOutlineEntry: vi.fn(),
      })
    );

    expect(revisionsHtml).toContain('screenplay-revisions-view');
    expect(revisionsHtml).toContain('Subway scene');
    expect(revisionsHtml).toContain('screenplay-create-checkpoint-btn');

    const toolbarSavingHtml = renderToStaticMarkup(
      React.createElement(ScreenplayToolbar, {
        projectName: 'Night Courier',
        versions: [scriptA, scriptB],
        activeVersionId: scriptB.id,
        draftTitle: scriptB.title,
        onDraftTitleChange: vi.fn(),
        onSelectVersion: vi.fn(),
        onNewBlankDraft: vi.fn(),
        onLoadSampleScript: vi.fn(),
        onSaveDraft: vi.fn(),
        isDirty: true,
        saveStatus: 'saving',
        lastSavedAt: null,
        metrics: {
          wordCount: 12,
          characterCount: 64,
          paragraphCount: 2,
          pageCount: 1,
          activePageNumber: 1,
          canUndo: false,
          canRedo: false,
          activeElement: 'action',
          isInsideDualDialogue: false,
        },
        activeState: { activeElement: 'action', isInsideDualDialogue: false },
        onExecuteCommand: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        zoomPercent: 100,
        onZoomChange: vi.fn(),
        isNavPanelOpen: false,
        isOutlineOpen: false,
        onToggleNavPanel: vi.fn(),
        onOpenLibraryPanel: vi.fn(),
        onOpenRevisionsPanel: vi.fn(),
        onExportScript: vi.fn(),
      })
    );

    expect(toolbarSavingHtml).toContain('data-save-status="saving"');
    expect(toolbarSavingHtml).toContain('Saving...');
    expect(toolbarSavingHtml).toContain('screenplay-open-library-btn');
    expect(toolbarSavingHtml).toContain('screenplay-toolbar-export-btn');
  });
});
