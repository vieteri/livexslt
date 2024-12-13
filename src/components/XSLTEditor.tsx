"use client";

import { useState, useEffect } from 'react';
import CodeEditor from './CodeEditor';
import xsltTransform from '../utils/xsltTransform';

const XSLTEditor = () => {
  const [xslContent, setXslContent] = useState('');
  const [xmlContent, setXmlContent] = useState('');
  const [output, setOutput] = useState('');
  const [lastValidOutput, setLastValidOutput] = useState('');
  const [error, setError] = useState<{ line?: number; column?: number; message: string } | null>(null);

  useEffect(() => {
    if (xslContent && xmlContent) {
      const { result, error } = xsltTransform(xslContent, xmlContent);
      if (error) {
        setError(error);
        setOutput(lastValidOutput);
      } else {
        setOutput(result);
        setLastValidOutput(result);
        setError(null);
      }
    }
  }, [xslContent, xmlContent]);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {error && (
        <div className="bg-red-500 text-white p-4 mb-4 rounded-md">
          <div className="font-bold">Transform Error:</div>
          <div>{error.message}</div>
          {error.line && error.column && (
            <div className="mt-1 text-sm">
              Location: Line {error.line}, Column {error.column}
            </div>
          )}
          <div className="mt-1 text-sm italic">
            Showing last successful transformation
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-grow">
        <div className="space-y-2 h-full">
          <h2 className="text-xl font-bold text-white">XSLT</h2>
          <div className="h-[calc(100%-40px)]">
            <CodeEditor
              value={xslContent}
              onChange={setXslContent}
              language="xml"
            />
          </div>
        </div>
        <div className="space-y-2 h-full">
          <h2 className="text-xl font-bold text-white">XML</h2>
          <div className="h-[calc(100%-40px)]">
            <CodeEditor
              value={xmlContent}
              onChange={setXmlContent}
              language="xml"
            />
          </div>
        </div>
        <div className="space-y-2 h-full">
          <h2 className="text-xl font-bold text-white">Output</h2>
          <div className="h-[calc(100%-40px)]">
            <CodeEditor
              value={output}
              language="xml"
              readOnly={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default XSLTEditor; 