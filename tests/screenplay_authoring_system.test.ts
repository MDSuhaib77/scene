import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  SCREENPLAY_SCHEMA_EXTENSIONS,
  ENTER_PROGRESSION_MAP,
} from '../src/features/screenplay/schema/screenplayExtensions';
import {
  SCREENPLAY_AUTHORING_COMMANDS,
  setScreenplayElement,
  executeSceneCommand,
  applySceneHeadingAssist,
  executeNoteCommand,
  executeNewActCommand,
  executeEndActCommand,
  executeSequenceCommand,
  executeDualDialogueCommand,
  insertScreenplayImage,
  extractScreenplayOutline,
  extractScreenplayPlainText,
  deserializeScreenplayDocument,
  getActiveScreenplayState,
} from '../src/features/screenplay/commands/screenplayCommands';

function createHeadlessScreenplayEditor(initialText = '') {
  const initialDoc = deserializeScreenplayDocument(null, initialText);
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
    content: initialDoc,
  });
}

describe('Screenplay Authoring System (Prompt 02)', () => {
  it('defines all sixteen required toolbar authoring commands in SCREENPLAY_AUTHORING_COMMANDS', () => {
    const commandIds = SCREENPLAY_AUTHORING_COMMANDS.map((c) => c.id);
    expect(commandIds).toEqual([
      'scene',
      'action',
      'character',
      'parens',
      'dialogue',
      'transition',
      'shot',
      'text',
      'note',
      'outline',
      'newAct',
      'endAct',
      'lyrics',
      'image',
      'sequence',
      'dual',
    ]);
    expect(SCREENPLAY_AUTHORING_COMMANDS).toHaveLength(16);
  });

  it('defines the required Enter key progression rules for screenplay elements', () => {
    expect(ENTER_PROGRESSION_MAP).toMatchObject({
      sceneHeading: 'action',
      action: 'action',
      character: 'dialogue',
      parenthetical: 'dialogue',
      dialogue: 'dialogue',
      transition: 'action',
      shot: 'action',
      sequenceHeading: 'action',
      actHeading: 'action',
      lyrics: 'lyrics',
      generalText: 'generalText',
    });
  });

  it('preserves text when converting between core screenplay elements and reflects active state', () => {
    const editor = createHeadlessScreenplayEditor('A quiet corridor.');
    expect(getActiveScreenplayState(editor).activeElement).toBe('action');

    const coreTypes = [
      'sceneHeading',
      'character',
      'parenthetical',
      'dialogue',
      'transition',
      'shot',
      'generalText',
      'lyrics',
      'action',
    ] as const;

    for (const elType of coreTypes) {
      setScreenplayElement(editor as any, elType);
      expect(getActiveScreenplayState(editor as any).activeElement).toBe(elType);
      expect(editor.state.doc.firstChild?.textContent).toBe('A quiet corridor.');
    }

    editor.destroy();
  });

  it('implements Scene command and optional INT./EXT. and time-of-day assistance', () => {
    const editor = createHeadlessScreenplayEditor('SOUNDSTAGE 4');
    executeSceneCommand(editor as any);
    expect(getActiveScreenplayState(editor as any).activeElement).toBe('sceneHeading');
    expect(editor.state.doc.firstChild?.textContent).toBe('SOUNDSTAGE 4');

    applySceneHeadingAssist(editor as any, 'INT. ');
    expect(editor.state.doc.firstChild?.textContent).toBe('INT. SOUNDSTAGE 4');

    applySceneHeadingAssist(editor as any, ' - NIGHT');
    expect(editor.state.doc.firstChild?.textContent).toBe('INT. SOUNDSTAGE 4 - NIGHT');

    // Invoking Scene command at the end of a non-empty Scene Heading inserts a new empty Scene Heading below
    executeSceneCommand(editor as any);
    expect(editor.state.doc.childCount).toBe(2);
    expect(editor.state.doc.child(1).type.name).toBe('sceneHeading');
    expect(editor.state.doc.child(1).textContent).toBe('');

    editor.destroy();
  });

  it('inserts Act, Sequence, and End Act structural nodes and extracts them in the Outline', () => {
    const editor = createHeadlessScreenplayEditor('');
    executeNewActCommand(editor as any);
    expect(editor.state.doc.child(0).type.name).toBe('actHeading');
    expect(editor.state.doc.child(0).textContent).toBe('ACT I');

    executeSequenceCommand(editor as any);
    executeSceneCommand(editor as any);
    editor.view.dispatch(editor.state.tr.insertText('INT. CONTROL ROOM - NIGHT'));
    executeEndActCommand(editor as any);

    const outline = extractScreenplayOutline(editor.state.doc);
    expect(outline.map((e) => e.type)).toEqual([
      'actHeading',
      'sequenceHeading',
      'sceneHeading',
      'endAct',
    ]);
    expect(outline[2].sceneNumber).toBe(1);
    expect(outline[2].text).toBe('INT. CONTROL ROOM - NIGHT');
    expect(outline[3].text).toBe('END OF ACT I');

    editor.destroy();
  });

  it('keeps screenplay notes distinct from exported screenplay manuscript text while persisting in JSON', () => {
    const editor = createHeadlessScreenplayEditor('INT. LAB - NIGHT\n\nDr. Rao checks the gauge.');
    executeNoteCommand(editor as any);
    editor.view.dispatch(
      editor.state.tr.insertText('Verify prop gauge clearance with art department.')
    );

    const plainText = extractScreenplayPlainText(editor.state.doc);
    expect(plainText).toContain('INT. LAB - NIGHT');
    expect(plainText).toContain('Dr. Rao checks the gauge.');
    expect(plainText).not.toContain('Verify prop gauge clearance');

    const jsonStr = JSON.stringify(editor.getJSON());
    const restored = deserializeScreenplayDocument(jsonStr, plainText);
    const noteNode = restored.content?.find((n) => n.type === 'screenplayNote');
    expect(noteNode).toBeDefined();

    editor.destroy();
  });

  it('creates and unwraps structural Dual Dialogue preserving both dialogue columns', () => {
    const editor = createHeadlessScreenplayEditor('MARA\nRoll sound.\n\nJULIAN\nFrame is set.');
    // Move selection to the last block (JULIAN's dialogue)
    const endPos = editor.state.doc.content.size - 1;
    editor.commands.setTextSelection(endPos);

    executeDualDialogueCommand(editor as any);
    expect(editor.state.doc.firstChild?.type.name).toBe('dualDialogue');
    expect(editor.state.doc.firstChild?.childCount).toBe(2);

    const leftCol = editor.state.doc.firstChild?.child(0);
    const rightCol = editor.state.doc.firstChild?.child(1);
    expect(leftCol?.type.name).toBe('dualDialogueColumn');
    expect(rightCol?.type.name).toBe('dualDialogueColumn');
    expect(leftCol?.textContent).toContain('MARA');
    expect(leftCol?.textContent).toContain('Roll sound.');
    expect(rightCol?.textContent).toContain('JULIAN');
    expect(rightCol?.textContent).toContain('Frame is set.');

    // Unwrap back to sequential blocks when Dual is executed inside Dual Dialogue
    executeDualDialogueCommand(editor as any);
    expect(editor.state.doc.firstChild?.type.name).toBe('character');
    expect(editor.state.doc.textContent).toContain('Roll sound.');
    expect(editor.state.doc.textContent).toContain('Frame is set.');

    editor.destroy();
  });

  it('validates and inserts screenplayImage nodes and preserves them through serialization', () => {
    const editor = createHeadlessScreenplayEditor('INT. GALLERY - DAY');
    const invalidResult = insertScreenplayImage(editor as any, {
      src: 'javascript:alert(1)',
      alt: 'bad',
      caption: 'bad',
    });
    expect(invalidResult).toBe(false);

    const validDataUri =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const validResult = insertScreenplayImage(editor as any, {
      src: validDataUri,
      alt: 'Stage Blueprint',
      caption: 'Stage Blueprint',
    });
    expect(validResult).toBe(true);

    const jsonStr = JSON.stringify(editor.getJSON());
    const restored = deserializeScreenplayDocument(jsonStr, '');
    const imgNode = restored.content?.find((n) => n.type === 'screenplayImage');
    expect(imgNode).toBeDefined();
    expect(imgNode?.attrs?.src).toBe(validDataUri);
    expect(imgNode?.attrs?.caption).toBe('Stage Blueprint');

    editor.destroy();
  });
});
