import { Xslt, XmlParser } from 'xslt-processor';
import { MAX_INPUT, MAX_OUTPUT, utf8Size } from '../lib/model';

type Request = { xml: string; xslt: string; parameters: Array<{ name: string; namespaceUri?: string; value: string | number | boolean }> };
const blockedMessage = 'External document loading is disabled. Use self-contained XML and XSLT.';
let externalLoadAttempted = false;
// The engine catches document() loader errors and returns an empty node set.
// Record denied attempts independently so a partial result cannot appear successful.
const denyExternal = (): never => {
  externalLoadAttempted = true;
  throw new Error(blockedMessage);
};
globalThis.fetch = denyExternal;

self.onmessage = async (event: MessageEvent<Request>) => {
  externalLoadAttempted = false;
  try {
    const { xml, xslt, parameters } = event.data;
    if (utf8Size(xml) > MAX_INPUT || utf8Size(xslt) > MAX_INPUT) throw new Error('Inputs must be smaller than 1 MiB each.');
    const parser = new XmlParser();
    const processor = new Xslt({ parameters, fetchFunction: denyExternal, documentLoader: denyExternal });
    const start = performance.now();
    const result = await processor.xsltProcess(parser.xmlParse(xml), parser.xmlParse(xslt));
    if (externalLoadAttempted) throw new Error(blockedMessage);
    if (utf8Size(result) > MAX_OUTPUT) throw new Error('The result exceeds the 4 MiB output limit. Narrow the transformation.');
    self.postMessage({ result, duration: Math.round(performance.now() - start) });
  } catch (error) {
    self.postMessage({ error: externalLoadAttempted ? blockedMessage : error instanceof Error ? error.message : String(error) });
  }
};
