'use client';
import { useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { xml } from '@codemirror/lang-xml';
import { EditorView, Decoration } from '@codemirror/view';
import type { SourceRange } from '@/lib/model';
interface Props {
  value: string; label: string; onChange?: (value: string) => void;
  readOnly?: boolean; plainText?: boolean; placeholder?: string; highlights?: SourceRange[];
}
const noRanges: SourceRange[] = [];
export default function CodeEditor({ value, label, onChange, readOnly = false, plainText = false, placeholder, highlights = noRanges }: Props) {
  const view = useRef<EditorView | null>(null);
  const extensions = useMemo(() => {
    const merged: SourceRange[] = [];
    for (const r of [...highlights].sort((a, b) => a.from - b.from)) {
      const current = { from: Math.max(0, r.from), to: Math.min(value.length, r.to) };
      if (current.to <= current.from) continue;
      const last = merged.at(-1);
      if (last && current.from <= last.to) last.to = Math.max(last.to, current.to);
      else merged.push(current);
    }
    return [
      ...(plainText ? [] : [xml()]), EditorView.lineWrapping,
      EditorView.contentAttributes.of({ 'aria-label': label, 'aria-multiline': 'true', spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' }),
      EditorView.theme({
        '&': { height: '100%', fontSize: '13px', backgroundColor: '#fff' },
        '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--mono)', lineHeight: '1.75' },
        '.cm-content': { padding: '18px 0', minHeight: '100%' },
        '.cm-line': { padding: '0 16px 0 12px' },
        '.cm-gutters': { backgroundColor: '#fbfcfd', color: '#91a0af', border: 'none', minWidth: '38px' },
        '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: '#f2f7f7' },
        '&.cm-focused': { outline: 'none' },
        '.cm-placeholder': { color: '#8493a2', fontFamily: 'var(--sans)', whiteSpace: 'pre-wrap' },
        '.cm-selectionBackground': { backgroundColor: '#cce9e4 !important' },
        '.xml-match': { backgroundColor: '#ccf1df', borderRadius: '2px' }
      }),
      EditorView.decorations.of(Decoration.set(merged.map(r => Decoration.mark({ class: 'xml-match' }).range(r.from, r.to))))
    ];
  }, [highlights, label, plainText, value.length]);
  useEffect(() => {
    if (view.current && highlights.length && highlights[0].from <= view.current.state.doc.length) {
      view.current.dispatch({ effects: EditorView.scrollIntoView(highlights[0].from, { y: 'center' }) });
    }
  }, [highlights]);
  return <CodeMirror value={value} height="100%" className="code-editor" extensions={extensions}
    onChange={onChange} editable={!readOnly} readOnly={readOnly} placeholder={placeholder}
    onCreateEditor={v => { view.current = v; }}
    basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: !readOnly, highlightActiveLineGutter: !readOnly, autocompletion: false, allowMultipleSelections: false }} />;
}
