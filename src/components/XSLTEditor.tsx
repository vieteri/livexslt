"use client";

import { useState, useEffect } from 'react';
import CodeEditor from '@/components/CodeEditor';
import xsltTransform from '@/utils/xsltTransform';

const initialXslContent = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <html>
      <body>
        <h2>My CD Collection</h2>
        <table border="1">
          <tr bgcolor="#9acd32">
            <th>Title</th>
            <th>Artist</th>
          </tr>
          <xsl:for-each select="catalog/cd">
            <tr>
              <td><xsl:value-of select="title"/></td>
              <td><xsl:value-of select="artist"/></td>
            </tr>
          </xsl:for-each>
        </table>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>`;

const initialXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<catalog>
  <cd>
    <title>Empire Burlesque</title>
    <artist>Bob Dylan</artist>
  </cd>
  <cd>
    <title>Hide your heart</title>
    <artist>Bonnie Tyler</artist>
  </cd>
  <cd>
    <title>Greatest Hits</title>
    <artist>Dolly Parton</artist>
  </cd>
</catalog>`;


const XSLTEditor = () => {
  const [xslContent, setXslContent] = useState(initialXslContent);
  const [xmlContent, setXmlContent] = useState(initialXmlContent);
  const [output, setOutput] = useState('');
  const [lastSuccessfulOutput, setLastSuccessfulOutput] = useState('');
  const [error, setError] = useState<{ line?: number; column?: number; message: string } | null>(null);

  useEffect(() => {
    if (xslContent && xmlContent) {
      try {
        const { result, error } = xsltTransform(xslContent, xmlContent);
        if (error) {
          setError(error);
          setOutput(lastSuccessfulOutput);
        } else {
          setOutput(result);
          setLastSuccessfulOutput(result);
          setError(null);
        }
      } catch (e) {
        setError({ message: e instanceof Error ? e.message : String(e) });
        setOutput(lastSuccessfulOutput);
      }
    }
  }, [xslContent, xmlContent, lastSuccessfulOutput]);


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
          <h2 className="text-xl font-bold text-white text-center">XSLT</h2>
          <div className="h-[calc(100%-40px)]">
            <CodeEditor
              value={xslContent}
              onChange={(value) => setXslContent(value || '')}
              language="xml"
              id="xsl-content"
              name="xslContent"
            />
          </div>
        </div>
        <div className="space-y-2 h-full">
          <h2 className="text-xl font-bold text-white text-center">XML</h2>
          <div className="h-[calc(100%-40px)]">
            <CodeEditor
              value={xmlContent}
              onChange={(value) => setXmlContent(value || '')}
              language="xml"
              id="xml-content"
              name="xmlContent"
            />
          </div>
        </div>
        <div className="space-y-2 h-full">
          <div className="flex justify-start items-center">
            <h2 className="text-xl font-bold text-white flex-grow text-center">Output</h2>
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
              value={error ? lastSuccessfulOutput : output}
              language="xml"
              readOnly={true}
              id="output-content"
              name="outputContent"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default XSLTEditor;
