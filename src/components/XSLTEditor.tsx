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

  const handleSaveOutput = () => {
    const blob = new Blob([output], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transformed-output.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
              onChange={(value) => setXslContent(value || '')}
              language="xml"
            />
          </div>
        </div>
        <div className="space-y-2 h-full">
          <h2 className="text-xl font-bold text-white">XML</h2>
          <div className="h-[calc(100%-40px)]">
            <CodeEditor
              value={xmlContent}
              onChange={(value) => setXmlContent(value || '')}
              language="xml"
            />
          </div>
        </div>
        <div className="space-y-2 h-full">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Output</h2>
            {output && (
              <button
                onClick={handleSaveOutput}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Save Output
              </button>
            )}
          </div>
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