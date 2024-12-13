"use client";

import { useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// Configure Monaco loader
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
}

const CodeEditor = ({ value, onChange, language, readOnly = false }: CodeEditorProps) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const initialValueRef = useRef(value);

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.getValue()) {
      const editor = editorRef.current;
      const model = editor.getModel();
      if (model) {
        // Create an editor operation that preserves undo stack
        model.pushEditOperations(
          [],
          [{
            range: model.getFullModelRange(),
            text: value
          }],
          () => null
        );
      }
    }
  }, [value]);

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.layout();
    
    // Set initial value properly
    editor.setValue(initialValueRef.current);
    
    const resizeObserver = new ResizeObserver(() => {
      editor.layout();
    });
    
    resizeObserver.observe(editor.getContainerDomNode());
    
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