"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import CodeEditor from '@/components/CodeEditor';
import xsltTransform, { XSLTParameter } from '@/utils/xsltTransform';

const initialXslContent = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" 
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  
  <xsl:output method="html" 
              encoding="UTF-8" 
              indent="yes"/>
  
  <xsl:param name="title">My CD Collection</xsl:param>
  <xsl:param name="headerColor">#9acd32</xsl:param>
  
  <xsl:template match="/">
    <html>
      <head>
        <title><xsl:value-of select="$title"/></title>
        <style>
          body { font-family: sans-serif; padding: 20px; background: #f4f4f4; }
          h2 { color: <xsl:value-of select="$headerColor"/>; }
          table { width: 100%; border-collapse: collapse; background: white; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background: <xsl:value-of select="$headerColor"/>; color: white; }
        </style>
      </head>
      <body>
        <h2><xsl:value-of select="$title"/></h2>
        <table>
          <tr><th>Title</th><th>Artist</th></tr>
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
</catalog>`;

const XSLTEditor = () => {
  const [xslContent, setXslContent] = useState(initialXslContent);
  const [xmlContent, setXmlContent] = useState(initialXmlContent);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<{ line?: number; column?: number; message: string } | null>(null);
  const [parameters, setParameters] = useState<XSLTParameter[]>([]);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [viewMode, setViewMode] = useState<'source' | 'preview'>('source');
  const [activeTab, setActiveTab] = useState<'xslt' | 'xml' | 'output'>('xslt');

  const [panelWidths, setPanelWidths] = useState([33.33, 33.33, 33.33]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthsRef = useRef<number[]>([]);

  useEffect(() => {
    try {
      const { result, error } = xsltTransform(xslContent, xmlContent, parameters);
      if (error) {
        setError(error);
      } else {
        setOutput(result);
        setError(null);
      }
    } catch (e: any) {
      setError({ message: e.message || 'Unknown error' });
    }
  }, [xslContent, xmlContent, parameters]);

  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    setIsDragging(true);
    setDragIndex(index);
    startXRef.current = e.clientX;
    startWidthsRef.current = [...panelWidths];
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    const deltaX = e.clientX - startXRef.current;
    const deltaPercent = (deltaX / containerWidth) * 100;

    const newWidths = [...startWidthsRef.current];
    if (dragIndex === 0) {
      const move = Math.max(-newWidths[0] + 5, Math.min(deltaPercent, newWidths[1] - 5));
      newWidths[0] += move;
      newWidths[1] -= move;
    } else {
      const move = Math.max(-newWidths[1] + 5, Math.min(deltaPercent, newWidths[2] - 5));
      newWidths[1] += move;
      newWidths[2] -= move;
    }
    setPanelWidths(newWidths);
  }, [isDragging, dragIndex]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', () => setIsDragging(false));
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', () => setIsDragging(false));
      };
    }
  }, [isDragging, handleMouseMove]);

  const addParameter = () => setParameters([...parameters, { name: '', value: '' }]);
  const removeParameter = (i: number) => setParameters(parameters.filter((_, idx) => idx !== i));
  const updateParameter = (i: number, field: 'name' | 'value', val: string) => {
    const next = [...parameters];
    next[i][field] = val;
    setParameters(next);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div
      className="grid h-[calc(100vh-140px)] transition-all duration-300 overflow-hidden border border-gray-700 rounded-lg relative"
      style={{
        gridTemplateColumns: showSidePanel
          ? (typeof window !== 'undefined' && window.innerWidth < 768 ? '1fr 0px' : '320px 1fr')
          : '0px 1fr'
      }}
    >
      {/* Side Panel */}
      <div
        className={`side-panel overflow-hidden ${showSidePanel ? 'w-full md:w-80 border-r' : 'w-0 border-none'} z-50 absolute md:relative h-full bg-gray-950 md:bg-gray-900 transition-all duration-300`}
      >
        <div className="side-panel-header">
          <h3 className="text-white font-bold">XSLT Parameters</h3>
          <button onClick={() => setShowSidePanel(false)} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="side-panel-content">
          <button
            onClick={addParameter}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors mb-4"
          >
            + Add Parameter
          </button>

          <div className="space-y-3">
            {parameters.map((p, i) => (
              <div key={i} className="bg-gray-800 p-3 rounded border border-gray-700 space-y-2">
                <input
                  placeholder="Param Name"
                  value={p.name}
                  onChange={e => updateParameter(i, 'name', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                />
                <input
                  placeholder="Value"
                  value={p.value}
                  onChange={e => updateParameter(i, 'value', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                />
                <button onClick={() => removeParameter(i)} className="text-red-500 text-[10px] hover:underline">Remove</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Workspace Area */}
      <div className="flex flex-col min-w-0 h-full bg-gray-950 overflow-hidden">
        {/* Main Header / Control Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2 bg-gray-900 border-b border-gray-700 gap-2">
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
            <button
              onClick={() => setShowSidePanel(!showSidePanel)}
              className={`whitespace-nowrap px-3 py-1.5 rounded text-xs font-bold transition-all ${showSidePanel ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'} text-white shrink-0`}
            >
              {showSidePanel ? 'Hide Params' : 'Params'}
            </button>
            <div className="h-4 w-px bg-gray-700 mx-1 shrink-0 hidden sm:block" />
            <div className="flex bg-gray-800 p-0.5 rounded-md md:hidden">
              <button
                onClick={() => setActiveTab('xslt')}
                className={`px-2 py-1 text-[10px] rounded transition-all ${activeTab === 'xslt' ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-300'}`}
              >XSLT</button>
              <button
                onClick={() => setActiveTab('xml')}
                className={`px-2 py-1 text-[10px] rounded transition-all ${activeTab === 'xml' ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-300'}`}
              >XML</button>
              <button
                onClick={() => setActiveTab('output')}
                className={`px-2 py-1 text-[10px] rounded transition-all ${activeTab === 'output' ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-300'}`}
              >Out</button>
            </div>
            <div className="h-4 w-px bg-gray-700 mx-1 shrink-0 hidden sm:block" />
            <button
              onClick={() => setPanelWidths([33.33, 33.33, 33.33])}
              className="whitespace-nowrap px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300 font-medium shrink-0 hidden sm:block"
            >
              Reset
            </button>
          </div>

          {error && (
            <div className="text-red-400 text-xs font-medium animate-pulse">
              Error: {error.message}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                setParameters([
                  { name: 'title', value: 'Modern CD Store' },
                  { name: 'headerColor', value: '#3b82f6' }
                ]);
                setShowSidePanel(true);
              }}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300 font-medium"
            >
              Demo Params
            </button>
          </div>
        </div>

        {/* Editors Area */}
        <div ref={containerRef} className="flex flex-grow bg-gray-950 p-1 gap-0.5 md:gap-1 overflow-hidden">
          {/* XSLT Editor */}
          <div
            style={{ width: typeof window !== 'undefined' && window.innerWidth < 768 ? '100%' : `${panelWidths[0]}%` }}
            className={`flex-col min-w-[50px] ${activeTab === 'xslt' ? 'flex' : 'hidden md:flex'}`}
          >
            <div className="panel-header">
              <span className="panel-title">XSLT Stylesheet</span>
              <div className="panel-actions">
                <button onClick={() => copyToClipboard(xslContent)} className="action-btn">Copy</button>
              </div>
            </div>
            <div className="flex-grow">
              <CodeEditor language="xml" value={xslContent} onChange={v => setXslContent(v || '')} />
            </div>
          </div>

          <div
            onMouseDown={e => handleMouseDown(e, 0)}
            className={`w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors hidden md:block ${isDragging && dragIndex === 0 ? 'bg-blue-500' : 'bg-gray-800'}`}
          />

          {/* XML Editor */}
          <div style={{ width: typeof window !== 'undefined' && window.innerWidth < 768 ? '100% ' : `${panelWidths[1]}%` }} className={`flex-col min-w-[50px] ${activeTab === 'xml' ? 'flex' : 'hidden md:flex'}`}>
            <div className="panel-header">
              <span className="panel-title">XML Source</span>
              <div className="panel-actions">
                <button onClick={() => copyToClipboard(xmlContent)} className="action-btn">Copy</button>
              </div>
            </div>
            <div className="flex-grow">
              <CodeEditor language="xml" value={xmlContent} onChange={v => setXmlContent(v || '')} />
            </div>
          </div>

          <div
            onMouseDown={e => handleMouseDown(e, 1)}
            className={`w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors hidden md:block ${isDragging && dragIndex === 1 ? 'bg-blue-500' : 'bg-gray-800'}`}
          />

          {/* Output Panel */}
          <div style={{ width: typeof window !== 'undefined' && window.innerWidth < 768 ? '100% ' : `${panelWidths[2]}%` }} className={`flex-col min-w-[50px] ${activeTab === 'output' ? 'flex' : 'hidden md:flex'}`}>
            <div className="panel-header">
              <span className="panel-title">Transformation Output</span>
              <div className="panel-actions">
                <button
                  onClick={() => setViewMode('source')}
                  className={`action-btn ${viewMode === 'source' ? 'bg-blue-600 text-white' : ''}`}
                >
                  Source
                </button>
                <button
                  onClick={() => setViewMode('preview')}
                  className={`action-btn ${viewMode === 'preview' ? 'bg-blue-600 text-white' : ''}`}
                >
                  Preview
                </button>
                <div className="w-px h-3 bg-gray-700 mx-1" />
                <button onClick={() => copyToClipboard(output)} className="action-btn">Copy</button>
              </div>
            </div>
            <div className="flex-grow relative bg-[#1e1e1e] border border-gray-700 rounded-md overflow-hidden">
              {viewMode === 'source' ? (
                <CodeEditor language="xml" value={output} readOnly />
              ) : (
                <iframe
                  srcDoc={output}
                  className="w-full h-full bg-white"
                  title="Result Preview"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default XSLTEditor;