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

const initialOutput = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
  </head>
  <body>
    <h2>My CD Collection</h2>
    <table border="1">
      <tbody>
        <tr bgcolor="#9acd32">
          <th>Title</th>
          <th>Artist</th>
        </tr>
        <tr>
          <td>Empire Burlesque</td>
          <td>Bob Dylan</td>
        </tr>
        <tr>
          <td>Hide your heart</td>
          <td>Bonnie Tyler</td>
        </tr>
        <tr>
          <td>Greatest Hits</td>
          <td>Dolly Parton</td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`;

const XSLTEditor = () => {
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [xslContent, setXslContent] = useState(initialXslContent);
  const [xmlContent, setXmlContent] = useState(initialXmlContent);
  const [output, setOutput] = useState(initialOutput);
  const [lastSuccessfulOutput, setLastSuccessfulOutput] = useState(initialOutput);
  const [error, setError] = useState<{ line?: number; column?: number; message: string } | null>(null);

  // Perform transformation on initial load and whenever XSL or XML changes
  useEffect(() => {
    if (xslContent && xmlContent) {
      try {
        const { result, error } = xsltTransform(xslContent, xmlContent);
        if (error) {
          setError(error);
          // If there's an error, use the last successful output
          setOutput(lastSuccessfulOutput);
        } else {
          // Update output and last successful output
          setOutput(result);
          setLastSuccessfulOutput(result);
          setError(null);
        }
      } catch (e) {
        // Catch any unexpected errors during transformation
        setError({ 
          message: e instanceof Error ? e.message : String(e) 
        });
        // Fall back to last successful output
        setOutput(lastSuccessfulOutput);
      }

      // Mark initial load as complete
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    }
  }, [xslContent, xmlContent, isInitialLoad]);

  const handleSaveOutput = () => {
    const blob = new Blob([output], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transformed-output.html';
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
              onChange={(value) => setXslContent(value || initialXslContent)}
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
              onChange={(value) => setXmlContent(value || initialXmlContent)}
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