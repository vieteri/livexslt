"use client";

const prettyPrint = (xml: string): string => {
  const PADDING = ' '.repeat(2); // 2 spaces for indentation
  let formatted = '';
  let indent = 0;
  
  xml.split(/>\s*</).forEach((node, index) => {
    if (node.match(/^\/\w/)) indent -= 1; // Decrease indent for closing tag
    formatted += index ? '\n' + PADDING.repeat(indent) + '<' : '';
    formatted += node;
    if (node.match(/^<?\w[^>]*[^\/]$/)) indent += 1; // Increase indent for opening tag
    formatted += index < xml.split(/>\s*</).length - 1 ? '>' : '';
  });
  
  return formatted;
};

interface XSLTParameter {
  name: string;
  value: string;
}

interface XSLTError {
  line?: number;
  column?: number;
  message: string;
}

const parseXSLTError = (error: Error): XSLTError => {
  const match = error.message.match(/at line (\d+), column (\d+)/);
  if (match) {
    return {
      line: parseInt(match[1], 10),
      column: parseInt(match[2], 10),
      message: error.message
    };
  }
  return { message: error.message };
};

const xsltTransform = (
  xsltString: string, 
  xmlString: string, 
  parameters: XSLTParameter[] = []
): { result: string; error?: XSLTError } => {
  try {
    const parser = new window.DOMParser();
    const xsltDoc = parser.parseFromString(xsltString, 'text/xml');
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Check for XML parsing errors
    const xsltParseError = xsltDoc.getElementsByTagName('parsererror')[0];
    if (xsltParseError) {
      throw new Error(`XSLT Parse Error: ${xsltParseError.textContent}`);
    }

    const xmlParseError = xmlDoc.getElementsByTagName('parsererror')[0];
    if (xmlParseError) {
      throw new Error(`XML Parse Error: ${xmlParseError.textContent}`);
    }

    const processor = new XSLTProcessor();
    processor.importStylesheet(xsltDoc);
    
    // Set parameters
    parameters.forEach(param => {
      if (param.name && param.value) {
        processor.setParameter(null, param.name, param.value);
      }
    });
    
    const resultDoc = processor.transformToDocument(xmlDoc);

    const result = '<?xml version="1.0" encoding="UTF-8"?>\n' + 
                  new XMLSerializer().serializeToString(resultDoc);
    
    return { result: prettyPrint(result) };
  } catch (error) {
    return { 
      result: '',
      error: parseXSLTError(error instanceof Error ? error : new Error(String(error)))
    };
  }
};

export default xsltTransform;
export type { XSLTParameter };
