import { useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';

loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.43.0/min/vs'
  }
});

interface CodeEditorProps {
  value: string;
  onChange?: (value: string | undefined) => void;
  language: string;
  readOnly?: boolean;
  id?: string;
  name?: string;
}

const CodeEditor = ({ value, onChange, language, readOnly = false, id, name }: CodeEditorProps) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
    
    // Initial layout
    setTimeout(() => {
      editor.layout();
    }, 100);
    
    const resizeObserver = new ResizeObserver(() => {
      editor.layout();
    });
    
    resizeObserver.observe(editor.getContainerDomNode());
    
    // Add accessibility attributes for testing
    const container = editor.getContainerDomNode();
    if (container) {
      const textarea = container.querySelector('textarea');
      if (textarea) {
        if (id) textarea.setAttribute('id', id);
        if (name) textarea.setAttribute('name', name);
      }
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  };

  return (
    <div className="w-full h-full border border-gray-700 rounded-md overflow-hidden bg-[#1e1e1e]">
      <Editor
        height="100%"
        width="100%"
        language={language}
        value={value}
        onChange={onChange}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          fontFamily: 'var(--font-geist-mono)',
          readOnly,
          theme: 'vs-dark',
          automaticLayout: true,
          padding: { top: 10, bottom: 10 },
          lineNumbersMinChars: 3,
          glyphMargin: false,
          folding: true,
          lineDecorationsWidth: 10,
          wordWrap: 'on',
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
            useShadows: false,
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          bracketPairColorization: {
            enabled: true
          },
        }}
        loading={<div className="flex items-center justify-center h-full text-gray-500">Loading editor...</div>}
      />
    </div>
  );
};

export default CodeEditor;
