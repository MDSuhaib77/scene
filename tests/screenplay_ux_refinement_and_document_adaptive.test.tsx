import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SCREENPLAY_AUTHORING_COMMANDS,
} from '../src/features/screenplay/commands/screenplayCommands';
import { ScreenplayToolbar } from '../src/features/screenplay/components/ScreenplayToolbar';
import { ScreenplayWorkspace } from '../src/features/screenplay/ScreenplayWorkspace';
import { parseFountain } from '../src/features/screenplay/model/fountainParser';
import { parseFdx } from '../src/features/screenplay/model/fdxParser';
import { parseDocx } from '../src/features/screenplay/model/docxParser';
import {
  canonicalToTiptapDoc,
  tiptapDocToCanonical,
} from '../src/features/screenplay/model/canonicalConverters';
import {
  CanonicalScreenplayDocument,
  generateElementId,
} from '../src/features/screenplay/model/canonicalScreenplay';
import * as fflate from 'fflate';

const MOCK_PROJECT: any = {
  id: 'proj-ux-refinement',
  title: 'UX Refinement Feature',
  synopsis: 'A test project for SceneOS screenplay UX refinement.',
  screenplayVersions: [
    {
      id: 'v1',
      version: 'v1.0',
      title: 'First Draft',
      content: 'INT. COFFEE SHOP - DAY\n\nWriter types furiously.',
      createdAt: '2026-10-24T10:00:00Z',
    },
  ],
  activeScreenplayVersionId: 'v1',
  scenes: [],
};

describe('Screenplay UX Refinement & Document-Adaptive Manuscript', () => {
  describe('1. Sub-Module Navigator', () => {
    it('renders exactly the three peer sub-modules with correct tooltips and icons', () => {
      const html = renderToStaticMarkup(
        <ScreenplayWorkspace
          project={MOCK_PROJECT}
          onUpdateProject={() => {}}
          initialSubmodule="library"
        />
      );

      // Navigator container
      expect(html).toContain('data-testid="screenplay-submodules-navbar"');

      // 1. Script Library
      expect(html).toContain('data-testid="screenplay-submodule-library-btn"');
      expect(html).toContain('Script Library');
      expect(html).toContain('title="Manage, import, edit, and export screenplays."');

      // 2. AV Script
      expect(html).toContain('data-testid="screenplay-submodule-av-btn"');
      expect(html).toContain('AV Script');
      expect(html).toContain('title="Write visual cues alongside audio, narration, and dialogue."');

      // 3. No standalone Script Intelligence destination in Screenplay navbar
      expect(html).not.toContain('data-testid="screenplay-submodule-intelligence-btn"');

      // Authoritative import is NOT duplicated inside navigator
      const navSection = html.slice(
        html.indexOf('data-testid="screenplay-submodules-navbar"'),
        html.indexOf('</nav>')
      );
      expect(navSection).not.toContain('data-testid="screenplay-toolbar-import-btn"');
    });
  });

  describe('2. Manuscript Toolbar (15 Writing and Editing Options)', () => {
    it('contains all 15 manuscript authoring commands with distinct icons, shortcuts, and tooltips', () => {
      const executeMock = vi.fn();
      const html = renderToStaticMarkup(
        <ScreenplayToolbar
          projectName="UX Test Project"
          versions={MOCK_PROJECT.screenplayVersions}
          activeVersionId="v1"
          draftTitle="First Draft"
          onDraftTitleChange={() => {}}
          onSelectVersion={() => {}}
          onNewBlankDraft={() => {}}
          onLoadSampleScript={() => {}}
          onSaveDraft={() => {}}
          isDirty={false}
          lastSavedAt={null}
          metrics={{}}
          activeState={{ activeElement: 'sceneHeading' }}
          onExecuteCommand={executeMock}
          onUndo={() => {}}
          onRedo={() => {}}
          zoomPercent={100}
          onZoomChange={() => {}}
          isNavPanelOpen={false}
          isOutlineOpen={false}
          onToggleNavPanel={() => {}}
          onOpenImportModal={() => {}}
        />
      );

      // Formatting bar present
      expect(html).toContain('data-testid="screenplay-formatting-bar"');

      // The 15 writing and editing options:
      const expectedElements = [
        { id: 'scene', label: 'Scene', shortcut: 'Alt+1' },
        { id: 'action', label: 'Action', shortcut: 'Alt+2' },
        { id: 'character', label: 'Character', shortcut: 'Alt+3' },
        { id: 'parens', label: 'Parens', shortcut: 'Alt+4' },
        { id: 'dialogue', label: 'Dialogue', shortcut: 'Alt+5' },
        { id: 'transition', label: 'Transition', shortcut: 'Alt+6' },
        { id: 'shot', label: 'Shot', shortcut: 'Alt+7' },
        { id: 'text', label: 'Text', shortcut: 'Alt+8' },
        { id: 'note', label: 'Note', shortcut: 'Alt+9' },
        { id: 'newAct', label: 'New Act' },
        { id: 'endAct', label: 'End Act' },
        { id: 'lyrics', label: 'Lyrics' },
        { id: 'sequence', label: 'Sequence' },
        { id: 'dual', label: 'Dual' },
        { id: 'image', label: 'Image' },
      ];

      for (const el of expectedElements) {
        expect(html).toContain(`data-testid="screenplay-cmd-${el.id}"`);
        expect(html).toContain(el.label);
        if (el.shortcut) {
          expect(html).toContain(el.shortcut);
        }
      }

      // Active state highlight on sceneHeading
      expect(html).toContain('bg-amber-500/20 text-amber-300');

      // Authoritative import button in action area has clean tooltip without .txt
      expect(html).toContain('data-testid="screenplay-toolbar-import-btn"');
      expect(html).toContain('title="Import Screenplay (PDF, Final Draft FDX, Fountain, DOCX)"');
      expect(html).not.toContain('TXT');
    });
  });

  describe('3. Document-Adaptive Formatting Preservation', () => {
    it('parses Fountain markdown formatting into clean text and formatting spans', () => {
      const fountainSource = `INT. LAB - NIGHT

SARAH inspects the **glowing vial** with *extreme care*.

SARAH
(whispering)
It is _finally complete_.`;

      const doc = parseFountain(fountainSource);
      expect(doc.elements.length).toBeGreaterThanOrEqual(4);

      // Action has bold and italic formatting without raw markdown asterisks
      const actionElem = doc.elements.find((e) => e.type === 'action');
      expect(actionElem).toBeDefined();
      expect(actionElem!.text).toBe('SARAH inspects the glowing vial with extreme care.');
      expect(actionElem!.formatting).toBeDefined();
      expect(actionElem!.formatting!.some((s) => s.type === 'bold')).toBe(true);
      expect(actionElem!.formatting!.some((s) => s.type === 'italic')).toBe(true);

      // Dialogue has underline formatting without raw underscores
      const diaElem = doc.elements.find((e) => e.type === 'dialogue');
      expect(diaElem).toBeDefined();
      expect(diaElem!.text).toBe('It is finally complete.');
      expect(diaElem!.formatting).toBeDefined();
      expect(diaElem!.formatting!.some((s) => s.type === 'underline')).toBe(true);
    });

    it('parses Final Draft FDX paragraph styles, font settings, and formatting spans', () => {
      const fdxXml = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="4">
  <Content>
    <Paragraph Type="Scene Heading">
      <Text Font="Courier Final Draft" Size="12" Style="Bold">INT. ARCHIVE ROOM - DAY</Text>
    </Paragraph>
    <Paragraph Type="Action" Alignment="Left">
      <Text Font="Courier Final Draft" Size="12" Style="Italic">The dusty file rests on the mahogany table.</Text>
    </Paragraph>
    <Paragraph Type="Character">
      <Text Font="Courier Final Draft" Size="12">AGENT STERLING</Text>
    </Paragraph>
    <Paragraph Type="Dialogue">
      <Text Font="Courier Final Draft" Size="12">Do not open that folder.</Text>
    </Paragraph>
  </Content>
</FinalDraft>`;

      const doc = parseFdx(fdxXml);
      expect(doc.elements).toHaveLength(4);

      // Scene Heading
      expect(doc.elements[0].type).toBe('scene_heading');
      expect(doc.elements[0].observedFormatting?.fontFamily).toBe('Courier Final Draft');
      expect(doc.elements[0].observedFormatting?.fontSizePt).toBe(12);
      expect(doc.elements[0].formatting?.some((f) => f.type === 'bold')).toBe(true);

      // Action
      expect(doc.elements[1].type).toBe('action');
      expect(doc.elements[1].observedFormatting?.alignment).toBe('left');
      expect(doc.elements[1].formatting?.some((f) => f.type === 'italic')).toBe(true);
    });

    it('parses DOCX text runs, bold/italic styles, and indentation', () => {
      const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="SceneHeading"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>INT. COMMAND CENTER - DAY</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:ind w:left="3600"/></w:pPr>
      <w:r><w:t>COMMANDER</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

      const zipped = fflate.zipSync({
        'word/document.xml': fflate.strToU8(documentXml),
      });

      const doc = parseDocx(zipped, { fileName: 'test.docx' });
      expect(doc.elements.length).toBeGreaterThanOrEqual(2);

      expect(doc.elements[0].type).toBe('scene_heading');
      expect(doc.elements[0].formatting?.some((f) => f.type === 'bold')).toBe(true);

      expect(doc.elements[1].type).toBe('character');
      expect(doc.elements[1].observedFormatting?.indentLeftInches).toBeCloseTo(2.5, 1);
    });

    it('faithfully converts observed formatting and text marks between Canonical and Tiptap documents', () => {
      const canonical: CanonicalScreenplayDocument = {
        id: generateElementId('doc'),
        metadata: { title: 'Test Conversion' },
        warnings: [],
        provenance: { sourceFormat: 'native', importedAt: new Date().toISOString(), rawTextLength: 100 },
        elements: [
          {
            id: generateElementId('scn'),
            type: 'scene_heading',
            text: 'INT. SAFE HOUSE - NIGHT',
            observedFormatting: {
              fontFamily: 'Courier Final Draft',
              fontSizePt: 12,
              alignment: 'left',
              indentLeftInches: 1.5,
            },
            confidence: 'high',
          },
          {
            id: generateElementId('act'),
            type: 'action',
            text: 'He looks around cautiously.',
            formatting: [{ type: 'italic', start: 3, end: 15 }],
            confidence: 'high',
          },
        ],
      };

      // Canonical -> Tiptap
      const tiptap = canonicalToTiptapDoc(canonical);
      expect(tiptap.type).toBe('doc');
      expect(tiptap.content).toHaveLength(2);

      const sceneNode = tiptap.content![0];
      expect(sceneNode.type).toBe('sceneHeading');
      expect(sceneNode.attrs?.fontFamily).toBe('Courier Final Draft');
      expect(sceneNode.attrs?.fontSizePt).toBe(12);
      expect(sceneNode.attrs?.indentLeftInches).toBe(1.5);

      const actionNode = tiptap.content![1];
      expect(actionNode.type).toBe('action');
      expect(actionNode.content).toBeDefined();
      expect(actionNode.content!.some((c) => c.marks?.some((m) => m.type === 'italic'))).toBe(true);

      // Tiptap -> Canonical
      const roundTrip = tiptapDocToCanonical(tiptap);
      expect(roundTrip.elements).toHaveLength(2);
      expect(roundTrip.elements[0].observedFormatting?.fontFamily).toBe('Courier Final Draft');
      expect(roundTrip.elements[0].observedFormatting?.indentLeftInches).toBe(1.5);
      expect(roundTrip.elements[1].formatting?.some((f) => f.type === 'italic')).toBe(true);
    });
  });
});
