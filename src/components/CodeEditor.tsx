import { useEffect, useRef } from 'react';
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
  const initialValueRef = useRef(value);


  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.layout();
    editor.setValue(initialValueRef.current);
    
    const resizeObserver = new ResizeObserver(() => {
      editor.layout();
    });
    
    resizeObserver.observe(editor.getContainerDomNode());
    
    setTimeout(() => {
      const container = editor.getContainerDomNode();
      if (container) {
        const textarea = container.querySelector('textarea');
        if (textarea) {
          if (id) {
            textarea.setAttribute('id', id);
          }
          if (name) {
            textarea.setAttribute('name', name);
          }
        }
      }
    }, 0);
    
    return () => {
      resizeObserver.disconnect();
    };
  };


  return (
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
        fontSize: 14,
        readOnly,
        theme: 'vs-dark',
        automaticLayout: true,
        copyWithSyntaxHighlighting: true,
        bracketPairColorization: {
          enabled: true
        },
      }}
      loading={<div>Loading editor...</div>}
    />
  );
};

export default CodeEditor;
