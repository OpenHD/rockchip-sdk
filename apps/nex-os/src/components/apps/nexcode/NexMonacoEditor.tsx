import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Editor, { loader, type OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditorNS, IDisposable } from 'monaco-editor';

// Use CDN assets so Vite doesn't have to bundle Monaco workers (huge + fragile on Windows).
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs',
  },
});

export type NexPalette = Record<string, string>;

export type NexMonacoHandle = {
  getSelectionText: () => string;
  getSelectionOffsets: () => { start: number; end: number; text: string };
  replaceRange: (start: number, end: number, text: string) => void;
  revealMatch: (line: number, column: number, endLine?: number, endColumn?: number) => void;
  focus: () => void;
  getEditor: () => MonacoEditorNS.IStandaloneCodeEditor | null;
};

export function langFromPath(path: string): string {
  const ext = (path.split('.').pop() || '').toLowerCase();
  if (ext === 'tsx' || ext === 'ts') return 'typescript';
  if (ext === 'jsx' || ext === 'js' || ext === 'mjs' || ext === 'cjs') return 'javascript';
  if (ext === 'css') return 'css';
  if (ext === 'scss' || ext === 'less') return 'scss';
  if (ext === 'json') return 'json';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'xml') return 'xml';
  if (ext === 'yml' || ext === 'yaml') return 'yaml';
  if (ext === 'py') return 'python';
  if (ext === 'rs') return 'rust';
  if (ext === 'go') return 'go';
  if (ext === 'sql') return 'sql';
  return 'plaintext';
}

function applyMonacoTheme(monaco: typeof import('monaco-editor'), themeId: string, p: NexPalette) {
  const isLight = Boolean(p.bg && /^#(f|e|d)/i.test(p.bg));
  monaco.editor.defineTheme(themeId, {
    base: isLight ? 'vs' : 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: (p.com || '#6a9955').replace('#', '') },
      { token: 'string', foreground: (p.str || '#ce9178').replace('#', '') },
      { token: 'keyword', foreground: (p.kw || '#569cd6').replace('#', '') },
      { token: 'number', foreground: (p.num || '#b5cea8').replace('#', '') },
      { token: 'type', foreground: (p.type || '#4ec9b0').replace('#', '') },
      { token: 'function', foreground: (p.fn || '#dcdcaa').replace('#', '') },
      { token: 'variable', foreground: (p.prop || '#9cdcfe').replace('#', '') },
      { token: 'tag', foreground: (p.tag || '#569cd6').replace('#', '') },
    ],
    colors: {
      'editor.background': p.bg || '#1e1e1e',
      'editor.foreground': p.text || '#cccccc',
      'editor.selectionBackground': p.selection || '#264f7880',
      'editor.lineHighlightBackground': p.lineHL || '#ffffff0a',
      'editorLineNumber.foreground': p.textDim || '#858585',
      'editorLineNumber.activeForeground': p.text || '#cccccc',
      'editorCursor.foreground': p.text || '#cccccc',
      'editorWidget.background': p.bgAlt || p.sidebar || '#252526',
      'editorWidget.border': p.border || '#2b2b2b',
      'editorSuggestWidget.background': p.bgAlt || '#252526',
      'editorSuggestWidget.border': p.border || '#2b2b2b',
      'editorHoverWidget.background': p.bgAlt || '#252526',
      'editor.inactiveSelectionBackground': p.selection || '#264f7840',
      'minimap.background': p.bg || '#1e1e1e',
      'scrollbarSlider.background': p.scrollbar || '#79797966',
      'focusBorder': p.accent || '#007acc',
    },
  });
  monaco.editor.setTheme(themeId);
}

export type InlineCompleteFn = (args: {
  language: string;
  before: string;
  after: string;
  signal: AbortSignal;
}) => Promise<string | null>;

type Props = {
  path: string;
  language: string;
  value: string;
  palette: NexPalette;
  themeName: string;
  onChange: (value: string) => void;
  onCursorChange?: (line: number, col: number) => void;
  onInlineEditRequest?: () => void;
  requestInlineCompletion?: InlineCompleteFn;
  reveal?: { line: number; column: number; endLine?: number; endColumn?: number; nonce: number } | null;
};

const NexMonacoEditor = forwardRef<NexMonacoHandle, Props>(function NexMonacoEditor(
  {
    path,
    language,
    value,
    palette,
    themeName,
    onChange,
    onCursorChange,
    onInlineEditRequest,
    requestInlineCompletion,
    reveal,
  },
  ref,
) {
  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const completionDisp = useRef<IDisposable | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestInlineCompletionRef = useRef(requestInlineCompletion);
  requestInlineCompletionRef.current = requestInlineCompletion;
  const languageRef = useRef(language);
  languageRef.current = language;
  const themeId = `nex-${themeName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)}`;

  useImperativeHandle(ref, () => ({
    getSelectionText: () => {
      const ed = editorRef.current;
      const model = ed?.getModel();
      if (!ed || !model) return '';
      const sel = ed.getSelection();
      if (!sel || sel.isEmpty()) return model.getValue();
      return model.getValueInRange(sel);
    },
    getSelectionOffsets: () => {
      const ed = editorRef.current;
      const model = ed?.getModel();
      if (!ed || !model) return { start: 0, end: 0, text: '' };
      const sel = ed.getSelection();
      if (!sel || sel.isEmpty()) {
        const text = model.getValue();
        return { start: 0, end: text.length, text };
      }
      const start = model.getOffsetAt(sel.getStartPosition());
      const end = model.getOffsetAt(sel.getEndPosition());
      return { start, end, text: model.getValueInRange(sel) };
    },
    replaceRange: (start, end, text) => {
      const ed = editorRef.current;
      const model = ed?.getModel();
      if (!ed || !model) return;
      const startPos = model.getPositionAt(start);
      const endPos = model.getPositionAt(end);
      ed.executeEdits('nex-ai', [
        {
          range: {
            startLineNumber: startPos.lineNumber,
            startColumn: startPos.column,
            endLineNumber: endPos.lineNumber,
            endColumn: endPos.column,
          },
          text,
        },
      ]);
    },
    revealMatch: (line, column, endLine, endColumn) => {
      const ed = editorRef.current;
      if (!ed) return;
      const range = {
        startLineNumber: line,
        startColumn: column,
        endLineNumber: endLine ?? line,
        endColumn: endColumn ?? column + 1,
      };
      ed.setSelection(range);
      ed.revealRangeInCenter(range);
      ed.focus();
    },
    focus: () => editorRef.current?.focus(),
    getEditor: () => editorRef.current,
  }));

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    applyMonacoTheme(monaco, themeId, palette);
  }, [palette, themeId]);

  useEffect(() => {
    if (!reveal || !editorRef.current) return;
    const ed = editorRef.current;
    const range = {
      startLineNumber: reveal.line,
      startColumn: reveal.column,
      endLineNumber: reveal.endLine ?? reveal.line,
      endColumn: reveal.endColumn ?? reveal.column + 1,
    };
    ed.setSelection(range);
    ed.revealRangeInCenter(range);
    ed.focus();
  }, [reveal]);

  useEffect(() => {
    return () => {
      completionDisp.current?.dispose();
      abortRef.current?.abort();
    };
  }, []);

  const handleMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;
    monacoRef.current = monaco;
    applyMonacoTheme(monaco, themeId, palette);

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      jsx: monaco.languages.typescript.JsxEmit.React,
      allowNonTsExtensions: true,
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      esModuleInterop: true,
    });
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });

    ed.onDidChangeCursorPosition((e) => {
      onCursorChange?.(e.position.lineNumber, e.position.column);
    });

    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      onInlineEditRequest?.();
    });

    completionDisp.current?.dispose();
    completionDisp.current = monaco.languages.registerInlineCompletionsProvider(
      { pattern: '**' },
      {
        provideInlineCompletions: async (
          model: MonacoEditorNS.ITextModel,
          position: import('monaco-editor').Position,
          _ctx: import('monaco-editor').languages.InlineCompletionContext,
          token: import('monaco-editor').CancellationToken,
        ) => {
          const fn = requestInlineCompletionRef.current;
          if (!fn) return { items: [] };
          abortRef.current?.abort();
          const ac = new AbortController();
          abortRef.current = ac;
          token.onCancellationRequested(() => ac.abort());

          const offset = model.getOffsetAt(position);
          const full = model.getValue();
          const before = full.slice(Math.max(0, offset - 1200), offset);
          const after = full.slice(offset, offset + 200);
          if (!before.trim()) return { items: [] };

          try {
            await new Promise((r) => setTimeout(r, 450));
            if (ac.signal.aborted || token.isCancellationRequested) return { items: [] };
            const text = await fn({
              language: languageRef.current,
              before,
              after,
              signal: ac.signal,
            });
            if (!text || ac.signal.aborted) return { items: [] };
            return {
              items: [
                {
                  insertText: text,
                  range: {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column,
                  },
                },
              ],
            };
          } catch {
            return { items: [] };
          }
        },
        freeInlineCompletions: () => {},
      },
    );

    ed.focus();
  };

  const monacoLang =
    language === 'tsx' || language === 'ts' || language === 'typescript'
      ? 'typescript'
      : language === 'jsx' || language === 'js'
        ? 'javascript'
        : language === 'md'
          ? 'markdown'
          : language || langFromPath(path);

  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <Editor
        height="100%"
        path={path}
        language={monacoLang}
        value={value}
        theme={themeId}
        onChange={(v) => onChange(v ?? '')}
        onMount={handleMount}
        loading={
          <div style={{ color: palette.textDim || '#858585', padding: 24, fontSize: 13 }}>
            Cargando Monaco…
          </div>
        }
        options={{
          fontFamily: "'Cascadia Code','Fira Code','JetBrains Mono','Consolas','Courier New',monospace",
          fontSize: 13,
          lineHeight: 20,
          fontLigatures: true,
          glyphMargin: true,
          renderWhitespace: 'selection',
          rulers: [80],
          cursorBlinking: 'smooth',
          matchBrackets: 'always',
          minimap: { enabled: true, scale: 1, showSlider: 'mouseover' },
          smoothScrolling: true,
          cursorSmoothCaretAnimation: 'on',
          bracketPairColorization: { enabled: true },
          stickyScroll: { enabled: true },
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          wordWrap: 'off',
          renderLineHighlight: 'all',
          scrollBeyondLastLine: false,
          padding: { top: 8, bottom: 8 },
          inlineSuggest: { enabled: true },
          quickSuggestions: true,
          suggestOnTriggerCharacters: true,
          folding: true,
          links: true,
          mouseWheelZoom: true,
          scrollbar: {
            verticalScrollbarSize: 14,
            horizontalScrollbarSize: 14,
            useShadows: false,
          },
        }}
      />
    </div>
  );
});

export default NexMonacoEditor;
