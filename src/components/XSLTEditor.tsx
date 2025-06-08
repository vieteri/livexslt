"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import CodeEditor from '@/components/CodeEditor';
import xsltTransform, { XSLTParameter } from '@/utils/xsltTransform';

const initialXslContent = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" 
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  
  <!-- Output method declaration -->
  <xsl:output method="html" 
              encoding="UTF-8" 
              indent="yes" 
              doctype-public="-//W3C//DTD HTML 4.01//EN"
              doctype-system="http://www.w3.org/TR/html4/strict.dtd"/>
  
  <!-- Parameters with proper defaults -->
  <xsl:param name="title">My CD Collection</xsl:param>
  <xsl:param name="headerColor">#9acd32</xsl:param>
  <xsl:param name="showBorder">1</xsl:param>
  <xsl:param name="tableWidth">auto</xsl:param>
  <xsl:param name="textAlign">left</xsl:param>
  
  <!-- Main template -->
  <xsl:template match="/">
    <html>
      <xsl:call-template name="html-head"/>
      <body>
        <xsl:call-template name="page-header"/>
        <xsl:call-template name="catalog-table"/>
        <xsl:call-template name="page-footer"/>
      </body>
    </html>
  </xsl:template>
  
  <!-- HTML Head template -->
  <xsl:template name="html-head">
    <head>
      <title><xsl:value-of select="$title"/></title>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
      <xsl:call-template name="page-styles"/>
    </head>
  </xsl:template>
  
  <!-- Page header template -->
  <xsl:template name="page-header">
    <h2><xsl:value-of select="$title"/></h2>
  </xsl:template>
  
  <!-- Main catalog table template -->
  <xsl:template name="catalog-table">
    <table>
      <xsl:call-template name="table-header"/>
      <tbody>
        <xsl:apply-templates select="catalog/cd"/>
      </tbody>
    </table>
  </xsl:template>
  
  <!-- Table header template -->
  <xsl:template name="table-header">
    <thead>
      <tr>
        <th>Title</th>
        <th>Artist</th>
      </tr>
    </thead>
  </xsl:template>
  
  <!-- CD row template -->
  <xsl:template match="cd">
    <tr>
      <td><xsl:value-of select="title"/></td>
      <td><xsl:value-of select="artist"/></td>
    </tr>
  </xsl:template>
  
  <!-- Page footer template -->
  <xsl:template name="page-footer">
    <div class="footer">
      <p>
        Generated with parameters: Title="<xsl:value-of select="$title"/>", 
        HeaderColor="<xsl:value-of select="$headerColor"/>", 
        Border="<xsl:value-of select="$showBorder"/>", 
        Width="<xsl:value-of select="$tableWidth"/>", 
        Align="<xsl:value-of select="$textAlign"/>"
      </p>
    </div>
  </xsl:template>
  
  <!-- CSS Styles template -->
  <xsl:template name="page-styles">
    <style type="text/css">
      body { 
        font-family: Arial, sans-serif; 
        margin: 20px; 
      }
      h2 { 
        text-align: <xsl:value-of select="$textAlign"/>; 
        color: <xsl:value-of select="$headerColor"/>; 
        margin-bottom: 20px;
      }
      table { 
        border-collapse: collapse; 
        margin: 0 auto; 
        width: <xsl:value-of select="$tableWidth"/>;
        <xsl:choose>
          <xsl:when test="$showBorder = '0'">border: none;</xsl:when>
          <xsl:otherwise>border: <xsl:value-of select="$showBorder"/>px solid #333;</xsl:otherwise>
        </xsl:choose>
      }
      th { 
        background-color: <xsl:value-of select="$headerColor"/>; 
        color: white; 
        padding: 12px; 
        text-align: <xsl:value-of select="$textAlign"/>; 
        font-weight: bold;
        <xsl:if test="$showBorder != '0'">border: <xsl:value-of select="$showBorder"/>px solid #333;</xsl:if>
      }
      td { 
        padding: 10px; 
        text-align: <xsl:value-of select="$textAlign"/>; 
        <xsl:if test="$showBorder != '0'">border: <xsl:value-of select="$showBorder"/>px solid #ccc;</xsl:if>
      }
      tr:nth-child(even) { background-color: #f9f9f9; }
      tr:hover { background-color: #f5f5f5; }
      .footer { 
        text-align: center; 
        margin-top: 20px; 
        color: #666; 
        font-size: 12px; 
      }
    </style>
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
  
  // XSLT Parameters state
  const [parameters, setParameters] = useState<XSLTParameter[]>([]);
  const [showParameters, setShowParameters] = useState(false);
  
  // Panel width state (in percentages)
  const [panelWidths, setPanelWidths] = useState([33.33, 33.33, 33.34]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthsRef = useRef<number[]>([]);

  // Reset to equal widths function
  const resetPanelWidths = () => {
    setPanelWidths([33.33, 33.33, 33.34]);
  };

  // Parameter management functions
  const addParameter = () => {
    setParameters([...parameters, { name: '', value: '' }]);
  };

  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const updateParameter = (index: number, field: 'name' | 'value', value: string) => {
    const newParameters = [...parameters];
    newParameters[index][field] = value;
    setParameters(newParameters);
  };

  const clearAllParameters = () => {
    setParameters([]);
  };

  const loadSampleParameters = () => {
    const sampleParams: XSLTParameter[] = [
      { name: 'title', value: 'Viet\'s Music Collection 🎵' },
      { name: 'headerColor', value: '#ff6b6b' },
      { name: 'showBorder', value: '2' },
      { name: 'tableWidth', value: '100%' },
      { name: 'textAlign', value: 'center' }
    ];
    setParameters(sampleParams);
    setShowParameters(true); // Show parameters section when loading samples
  };

  const loadMinimalSample = () => {
    const minimalParams: XSLTParameter[] = [
      { name: 'title', value: 'Simple List' },
      { name: 'showBorder', value: '0' }
    ];
    setParameters(minimalParams);
    setShowParameters(true);
  };

  const loadColorfulSample = () => {
    const colorfulParams: XSLTParameter[] = [
      { name: 'title', value: '🌈 Colorful Music Database 🌈' },
      { name: 'headerColor', value: '#4ecdc4' },
      { name: 'showBorder', value: '3' },
      { name: 'tableWidth', value: '80%' },
      { name: 'textAlign', value: 'center' }
    ];
    setParameters(colorfulParams);
    setShowParameters(true);
  };

  // Perform transformation on initial load and whenever XSL, XML, or parameters change
  useEffect(() => {
    if (xslContent && xmlContent) {
      try {
        const { result, error } = xsltTransform(xslContent, xmlContent, parameters);
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
  }, [xslContent, xmlContent, parameters, isInitialLoad, lastSuccessfulOutput]);

  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    setIsDragging(true);
    setDragIndex(index);
    startXRef.current = e.clientX;
    startWidthsRef.current = [...panelWidths];
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || dragIndex === -1 || !containerRef.current) return;
    
    const containerWidth = containerRef.current.offsetWidth;
    const deltaX = e.clientX - startXRef.current;
    const deltaPercent = (deltaX / containerWidth) * 100;
    
    const newWidths = [...startWidthsRef.current];
    
    // Adjust the widths based on which resize handle is being dragged
    if (dragIndex === 0) {
      // Dragging between XSLT and XML
      const change = deltaPercent;
      const targetXsltWidth = Math.max(1, Math.min(95, newWidths[0] + change));
      const actualChange = targetXsltWidth - newWidths[0];
      
      if (actualChange > 0) {
        // XSLT wants to grow - take space from XML first, then from Output if needed
        const spaceNeeded = actualChange;
        const spaceFromXml = Math.max(0, Math.min(spaceNeeded, newWidths[1] - 1));
        let spaceFromOutput = 0;
        
        if (spaceNeeded > spaceFromXml) {
          // Need more space, take from Output too
          spaceFromOutput = Math.max(0, Math.min(spaceNeeded - spaceFromXml, newWidths[2] - 1));
        }
        
        const totalSpaceAvailable = spaceFromXml + spaceFromOutput;
        if (totalSpaceAvailable > 0) {
          newWidths[0] = newWidths[0] + totalSpaceAvailable;
          newWidths[1] = newWidths[1] - spaceFromXml;
          newWidths[2] = newWidths[2] - spaceFromOutput;
        }
      } else if (actualChange < 0) {
        // XSLT wants to shrink - give space to XML first, then to Output
        const spaceToGive = Math.abs(actualChange);
        const spaceToXml = spaceToGive * 0.7; // Give 70% to XML
        const spaceToOutput = spaceToGive * 0.3; // Give 30% to Output
        
        newWidths[0] = targetXsltWidth;
        newWidths[1] = newWidths[1] + spaceToXml;
        newWidths[2] = newWidths[2] + spaceToOutput;
      }
    } else if (dragIndex === 1) {
      // Dragging between XML and Output
      const change = deltaPercent;
      const targetXmlWidth = Math.max(1, Math.min(95, newWidths[1] + change));
      const actualChange = targetXmlWidth - newWidths[1];
      
      if (actualChange > 0) {
        // XML wants to grow - take space from Output first, then from XSLT if needed
        const spaceNeeded = actualChange;
        const spaceFromOutput = Math.max(0, Math.min(spaceNeeded, newWidths[2] - 1));
        let spaceFromXslt = 0;
        
        if (spaceNeeded > spaceFromOutput) {
          // Need more space, take from XSLT too
          spaceFromXslt = Math.max(0, Math.min(spaceNeeded - spaceFromOutput, newWidths[0] - 1));
        }
        
        const totalSpaceAvailable = spaceFromOutput + spaceFromXslt;
        if (totalSpaceAvailable > 0) {
          newWidths[1] = newWidths[1] + totalSpaceAvailable;
          newWidths[2] = newWidths[2] - spaceFromOutput;
          newWidths[0] = newWidths[0] - spaceFromXslt;
        }
      } else if (actualChange < 0) {
        // XML wants to shrink - give space to Output first, then to XSLT
        const spaceToGive = Math.abs(actualChange);
        const spaceToOutput = spaceToGive * 0.7; // Give 70% to Output
        const spaceToXslt = spaceToGive * 0.3; // Give 30% to XSLT
        
        newWidths[1] = targetXmlWidth;
        newWidths[2] = newWidths[2] + spaceToOutput;
        newWidths[0] = newWidths[0] + spaceToXslt;
      }
    }
    
    setPanelWidths(newWidths);
  }, [isDragging, dragIndex]);

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragIndex(-1);
  };

  // Use useEffect to manage global event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, dragIndex, handleMouseMove]);

  // Double-click to minimize/restore panel
  const handlePanelDoubleClick = (panelIndex: number) => {
    const newWidths = [...panelWidths];
    const currentWidth = newWidths[panelIndex];
    
    if (currentWidth < 10) {
      // Restore to reasonable size
      if (panelIndex === 0) {
        // Restore XSLT, take from others proportionally
        const available = newWidths[1] + newWidths[2];
        newWidths[0] = 33;
        newWidths[1] = available * 0.5;
        newWidths[2] = available * 0.5;
      } else if (panelIndex === 1) {
        // Restore XML, take from others proportionally  
        const available = newWidths[0] + newWidths[2];
        newWidths[1] = 33;
        newWidths[0] = available * 0.5;
        newWidths[2] = available * 0.5;
      } else {
        // Restore Output, take from others proportionally
        const available = newWidths[0] + newWidths[1];
        newWidths[2] = 33;
        newWidths[0] = available * 0.5;
        newWidths[1] = available * 0.5;
      }
    } else {
      // Minimize this panel, distribute its space to others
      const spaceToDistribute = currentWidth - 2;
      newWidths[panelIndex] = 2;
      
      if (panelIndex === 0) {
        // Minimize XSLT, give space to XML and Output
        newWidths[1] += spaceToDistribute * 0.5;
        newWidths[2] += spaceToDistribute * 0.5;
      } else if (panelIndex === 1) {
        // Minimize XML, give space to XSLT and Output
        newWidths[0] += spaceToDistribute * 0.5;
        newWidths[2] += spaceToDistribute * 0.5;
      } else {
        // Minimize Output, give space to XSLT and XML
        newWidths[0] += spaceToDistribute * 0.5;
        newWidths[1] += spaceToDistribute * 0.5;
      }
    }
    
    setPanelWidths(newWidths);
  };

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
      
      {/* Control Bar */}
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm text-gray-400">
          <div>Panel widths: {panelWidths.map(w => w.toFixed(1)).join('% | ')}%</div>
          <div className="text-xs">Drag handles to resize • Double-click headers to minimize/restore</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowParameters(!showParameters)}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              showParameters 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-600 text-white hover:bg-gray-500'
            }`}
          >
            Parameters {parameters.length > 0 && `(${parameters.length})`}
          </button>
          <button
            onClick={loadSampleParameters}
            className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
          >
            Load Sample
          </button>
          <button
            onClick={loadMinimalSample}
            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
          >
            Load Minimal
          </button>
          <button
            onClick={loadColorfulSample}
            className="px-3 py-1 bg-teal-600 text-white rounded hover:bg-teal-700 text-sm"
          >
            Load Colorful
          </button>
          <button
            onClick={resetPanelWidths}
            className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-500 text-sm"
          >
            Reset Layout
          </button>
        </div>
      </div>

      {/* Parameters Section */}
      {showParameters && (
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-white">XSLT Parameters</h3>
            <div className="flex gap-2">
              <button
                onClick={addParameter}
                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
              >
                Add Parameter
              </button>
              {parameters.length > 0 && (
                <button
                  onClick={clearAllParameters}
                  className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
          
          {parameters.length === 0 ? (
            <div className="text-gray-400 text-center py-4">
              No parameters defined. Click &quot;Add Parameter&quot; to add XSLT parameters.
            </div>
          ) : (
            <div className="space-y-2">
              {parameters.map((param, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Parameter name"
                    value={param.name}
                    onChange={(e) => updateParameter(index, 'name', e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                  <span className="text-gray-400">=</span>
                  <input
                    type="text"
                    placeholder="Parameter value"
                    value={param.value}
                    onChange={(e) => updateParameter(index, 'value', e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={() => removeParameter(index)}
                    className="px-2 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    title="Remove parameter"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-3 text-xs text-gray-400">
            <div>• Parameters are passed to your XSLT stylesheet during transformation</div>
            <div>• Use &lt;xsl:param name=&quot;parameterName&quot;/&gt; in your XSLT to receive parameters</div>
            <div>• Example: &lt;xsl:value-of select=&quot;$parameterName&quot;/&gt; to use the parameter value</div>
          </div>
        </div>
      )}
      
              <div 
          ref={containerRef}
          className={`flex flex-grow gap-1 relative transition-all ${isDragging ? 'bg-gray-800' : ''}`}
          style={{ cursor: isDragging ? 'col-resize' : 'default' }}
        >
        {/* XSLT Panel */}
        <div 
          className="flex flex-col h-full"
          style={{ width: `${panelWidths[0]}%` }}
        >
          <h2 
            className="text-xl font-bold text-white text-center mb-2 cursor-pointer hover:text-blue-300 transition-colors"
            onDoubleClick={() => handlePanelDoubleClick(0)}
            title="Double-click to minimize/restore"
          >
            XSLT {panelWidths[0] < 5 && '(minimized)'}
          </h2>
          <div className="flex-grow">
            <CodeEditor
              value={xslContent}
              onChange={(value) => setXslContent(value || initialXslContent)}
              language="xml"
              id="xsl-content"
              name="xslContent"
            />
          </div>
        </div>

        {/* Resize Handle 1 */}
        <div
          className="w-1 bg-gray-600 hover:bg-blue-400 cursor-col-resize flex-shrink-0 relative group transition-colors"
          onMouseDown={(e) => handleMouseDown(e, 0)}
        >
          <div className="absolute inset-0 w-4 -ml-1.5 group-hover:bg-blue-500/20"></div>
        </div>

        {/* XML Panel */}
        <div 
          className="flex flex-col h-full"
          style={{ width: `${panelWidths[1]}%` }}
        >
          <h2 
            className="text-xl font-bold text-white text-center mb-2 cursor-pointer hover:text-blue-300 transition-colors"
            onDoubleClick={() => handlePanelDoubleClick(1)}
            title="Double-click to minimize/restore"
          >
            XML {panelWidths[1] < 5 && '(minimized)'}
          </h2>
          <div className="flex-grow">
            <CodeEditor
              value={xmlContent}
              onChange={(value) => setXmlContent(value || initialXmlContent)}
              language="xml"
              id="xml-content"
              name="xmlContent"
            />
          </div>
        </div>

        {/* Resize Handle 2 */}
        <div
          className="w-1 bg-gray-600 hover:bg-blue-400 cursor-col-resize flex-shrink-0 relative group transition-colors"
          onMouseDown={(e) => handleMouseDown(e, 1)}
        >
          <div className="absolute inset-0 w-4 -ml-1.5 group-hover:bg-blue-500/20"></div>
        </div>

        {/* Output Panel */}
        <div 
          className="flex flex-col h-full"
          style={{ width: `${panelWidths[2]}%` }}
        >
          <div className="flex justify-start items-center mb-2">
            <h2 
              className="text-xl font-bold text-white flex-grow text-center cursor-pointer hover:text-blue-300 transition-colors"
              onDoubleClick={() => handlePanelDoubleClick(2)}
              title="Double-click to minimize/restore"
            >
              Output {panelWidths[2] < 5 && '(minimized)'}
            </h2>
            {output && (
              <button
                onClick={handleSaveOutput}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Save Output
              </button>
            )}
          </div>
          <div className="flex-grow">
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