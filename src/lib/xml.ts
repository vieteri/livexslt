import { checkSize, XSL_NS, type Namespace, type Parameter, type Override, type OutputMethod, type SourceRange, paramKey } from './model';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';

export function parseDocument(source: string, label = 'XML'): Document {
  checkSize(source, label);
  if (!source.trim()) throw new Error(`Add ${label} to get started.`);
  const declarations = source.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  if (/<!DOCTYPE|<!ENTITY/i.test(declarations)) throw new Error(`${label}: DTDs and entity declarations are disabled. Use a self-contained XML document.`);
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  const error = Array.from(doc.getElementsByTagName('parsererror')).find(n =>
    n.namespaceURI === 'http://www.mozilla.org/newlayout/xml/parsererror.xml' ||
    (n.namespaceURI === 'http://www.w3.org/1999/xhtml' && /(?:error on line|This page contains the following errors)/i.test(n.textContent || ''))
  );
  if (error) throw new Error(`${label}: ${(error.textContent || 'Invalid XML.').replace(/Below is a rendering[\s\S]*/i, '').replace(/\s+/g, ' ').trim().slice(0, 450)}`);
  if (!doc.documentElement) throw new Error(`${label}: a root element is required.`);
  const pending: Array<[Element, number]> = [[doc.documentElement, 1]];
  let count = 0;
  while (pending.length) {
    const [node, depth] = pending.pop()!;
    if (++count > 20000) throw new Error(`${label}: this preview supports up to 20,000 elements.`);
    if (depth > 128) throw new Error(`${label}: the nesting limit is 128 levels.`);
    for (const child of Array.from(node.children)) pending.push([child, depth + 1]);
  }
  return doc;
}
export function stylesheetInfo(source: string) {
  const doc = parseDocument(source, 'XSLT');
  const root = doc.documentElement;
  if (root.namespaceURI !== XSL_NS || !['stylesheet', 'transform'].includes(root.localName)) throw new Error('XSLT: use an xsl:stylesheet or xsl:transform root with the XSLT namespace.');
  if (root.getAttribute('version') !== '1.0') throw new Error('This workspace supports self-contained XSLT 1.0 stylesheets. XSLT 2.0/3.0 and processor extensions are not supported here.');
  const top = Array.from(root.children).filter(n => n.namespaceURI === XSL_NS);
  if (top.some(n => ['include', 'import'].includes(n.localName))) throw new Error('External stylesheets are disabled. Combine xsl:include / xsl:import into one self-contained stylesheet.');
  const output = top.find(n => n.localName === 'output');
  const declaredMethod = output?.getAttribute('method') || '';
  if (declaredMethod && !['xml', 'html', 'text'].includes(declaredMethod)) throw new Error('Supported output methods are XML, HTML and text.');
  const encoding = output?.getAttribute('encoding');
  if (encoding && !/^utf-?8$/i.test(encoding)) throw new Error('Downloads use UTF-8. Set xsl:output encoding="UTF-8" or leave encoding unset.');
  const parameters: Parameter[] = top.filter(n => n.localName === 'param').map(n => {
    const qname = n.getAttribute('name') || '';
    if (!qname || qname.split(':').length > 2) throw new Error('Each top-level xsl:param needs a valid name.');
    const [prefix, local] = qname.includes(':') ? qname.split(':') : ['', qname];
    const namespaceUri = prefix ? n.lookupNamespaceURI(prefix) || undefined : undefined;
    if (prefix && !namespaceUri) throw new Error(`Parameter ${qname} uses an undeclared namespace prefix.`);
    return { name: local, namespaceUri, defaultDescription: n.hasAttribute('select') ? `XPath: ${n.getAttribute('select')}` : (n.textContent || '').trim() || '(empty string)' };
  });
  const keys = parameters.map(paramKey);
  if (new Set(keys).size !== keys.length) throw new Error('A top-level parameter is declared more than once.');
  if (parameters.length > 100) throw new Error('This workspace supports up to 100 parameters.');
  return { doc, parameters, method: (declaredMethod || 'xml') as OutputMethod, hasOutputMethod: !!declaredMethod };
}
export function effectiveParameters(parameters: Parameter[], overrides: Override[]) {
  return parameters.flatMap(p => {
    const o = overrides.find(v => v.key === paramKey(p));
    if (!o?.enabled) return [];
    let value: string | number | boolean = o.value;
    if (o.type === 'number') {
      if (!o.value.trim() || !Number.isFinite(Number(o.value))) throw new Error(`Parameter ${p.name} needs a finite number.`);
      value = Number(o.value);
    }
    if (o.type === 'boolean') {
      if (!['true', 'false'].includes(o.value)) throw new Error(`Parameter ${p.name} must be true or false.`);
      value = o.value === 'true';
    }
    return [{ name: p.name, namespaceUri: p.namespaceUri, value }];
  });
}
export function prettyXml(source: string): string {
  const doc = parseDocument(source, 'Result');
  const serializer = new XMLSerializer();
  function print(node: Node, level: number, preserve: boolean): string {
    if (node.nodeType !== 1) return '  '.repeat(level) + serializer.serializeToString(node);
    const el = node as Element;
    const space = el.getAttributeNS(XML_NS, 'space');
    const keep = space === 'preserve' || (preserve && space !== 'default');
    const children = Array.from(el.childNodes);
    const mixed = children.some(n => n.nodeType === 4 || (n.nodeType === 3 && !!n.textContent?.trim()));
    if (keep || mixed || !el.children.length) return '  '.repeat(level) + serializer.serializeToString(el);
    const shallow = serializer.serializeToString(el.cloneNode(false));
    const opening = shallow.replace(/\s*\/>$/, '>').replace(new RegExp(`</${el.tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}>$`), '');
    return '  '.repeat(level) + opening + '\n' + children.filter(n => n.nodeType !== 3 || !!n.textContent?.trim()).map(n => print(n, level + 1, keep)).join('\n') + '\n' + '  '.repeat(level) + `</${el.tagName}>`;
  }
  const declaration = source.match(/^\s*(<\?xml[^?]*\?>)/)?.[1];
  return (declaration ? declaration + '\n' : '') + Array.from(doc.childNodes).filter(n => n.nodeType !== 3 || !!n.textContent?.trim()).map(n => print(n, 0, false)).join('\n');
}
export function detectNamespaces(doc: Document): Namespace[] {
  const entries: Namespace[] = [];
  const byUri = new Map<string, string>();
  const prefixes = new Set(['xml', 'xmlns']);
  const add = (suggested: string, uri: string) => {
    if (!uri || byUri.has(uri) || uri === XMLNS_NS) return;
    let prefix = uri === XML_NS ? 'xml' : suggested || 'ns';
    if (uri !== XML_NS) { const base = prefix; let suffix = 2; while (prefixes.has(prefix)) prefix = `${base}${suffix++}`; }
    byUri.set(uri, prefix); prefixes.add(prefix); entries.push({ prefix, uri });
  };
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    if (el.namespaceURI) add(el.prefix || '', el.namespaceURI);
    for (const attr of Array.from(el.attributes)) {
      if (attr.namespaceURI === XMLNS_NS) add(attr.localName === 'xmlns' ? '' : attr.localName, attr.value);
      else if (attr.namespaceURI) add(attr.prefix || '', attr.namespaceURI);
    }
  }
  return entries;
}
export function validateNamespaces(entries: Namespace[]) {
  const map = new Map<string, string>();
  for (const n of entries) {
    if (!n.prefix && !n.uri) continue;
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(n.prefix) || n.prefix === 'xmlns') throw new Error('Namespace prefixes must start with a letter or underscore, and cannot contain a colon.');
    if (!n.uri.trim()) throw new Error(`Namespace ${n.prefix} needs a URI.`);
    if (map.has(n.prefix)) throw new Error(`Namespace prefix ${n.prefix} is duplicated.`);
    if (n.prefix === 'xml' && n.uri !== XML_NS) throw new Error('The xml prefix has a fixed namespace URI.');
    map.set(n.prefix, n.uri);
  }
  map.set('xml', XML_NS);
  return map;
}
function xpathString(s: string) {
  if (!s.includes("'")) return `'${s}'`;
  if (!s.includes('"')) return `"${s}"`;
  return `concat(${s.split("'").map(x => `'${x}'`).join(', "\'", ')})`;
}
function nodeName(node: Element | Attr, namespaces: Namespace[]) {
  if (!node.namespaceURI) return node.localName;
  const prefix = namespaces.find(n => n.uri === node.namespaceURI && /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(n.prefix))?.prefix;
  return prefix ? `${prefix}:${node.localName}` : `*[local-name()=${xpathString(node.localName)} and namespace-uri()=${xpathString(node.namespaceURI)}]`;
}
export function nodePath(node: Node, namespaces: Namespace[], siblings = false): string {
  if (node.nodeType === 9) return '/';
  if (node.nodeType === 2) return `${nodePath((node as Attr).ownerElement!, namespaces)}/@${nodeName(node as Attr, namespaces)}`;
  if (node.nodeType !== 1) {
    const name = node.nodeType === 3 || node.nodeType === 4 ? 'text()' : node.nodeType === 8 ? 'comment()' : 'processing-instruction()';
    const peers = Array.from(node.parentNode?.childNodes || []).filter(n => name === 'text()' ? [3, 4].includes(n.nodeType) : n.nodeType === node.nodeType);
    return `${nodePath(node.parentNode!, namespaces)}/${name}[${peers.indexOf(node as ChildNode) + 1}]`;
  }
  const el = node as Element;
  const parts: string[] = [];
  let current: Element | null = el;
  while (current) {
    const item: Element = current;
    const peers: Element[] = Array.from(item.parentElement?.children || [item]).filter(n => n.localName === item.localName && n.namespaceURI === item.namespaceURI);
    const position = siblings && item === el ? '' : `[${peers.indexOf(item) + 1}]`;
    parts.unshift(nodeName(item, namespaces) + position); current = item.parentElement;
  }
  return '/' + parts.join('/');
}
export type XPathValue = { type: 'nodes'; nodes: Node[] } | { type: 'string' | 'number' | 'boolean'; value: string };
export function evaluateXPath(doc: Document, expression: string, namespaces: Namespace[]): XPathValue {
  if (!expression.trim()) throw new Error('Enter an XPath or select an XML node.');
  if (expression.length > 8000) throw new Error('XPath expressions are limited to 8,000 characters.');
  const ns = validateNamespaces(namespaces);
  const r = doc.evaluate(expression, doc, prefix => prefix ? ns.get(prefix) || null : null, XPathResult.ANY_TYPE, null);
  if (r.resultType === XPathResult.STRING_TYPE) return { type: 'string', value: r.stringValue };
  if (r.resultType === XPathResult.NUMBER_TYPE) return { type: 'number', value: String(r.numberValue) };
  if (r.resultType === XPathResult.BOOLEAN_TYPE) return { type: 'boolean', value: String(r.booleanValue) };
  const nodes: Node[] = []; let item = r.iterateNext();
  while (item) { nodes.push(item); item = r.iterateNext(); }
  return { type: 'nodes', nodes };
}
/** Locate nodes in the original input without reformatting it. */
export function sourceRanges(doc: Document, source: string): WeakMap<Node, SourceRange> {
  const ranges = new WeakMap<Node, SourceRange>();
  const elements = Array.from(doc.getElementsByTagName('*'));
  const stack: Array<{ node: Element; from: number }> = [];
  const tokens = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/?(?:[^"'<>]|"[^"]*"|'[^']*')+>/g;
  let index = 0;
  for (const m of source.matchAll(tokens)) {
    const token = m[0], from = m.index!, to = from + token.length;
    if (token.startsWith('<?') || token.startsWith('<!')) continue;
    if (token.startsWith('</')) { const start = stack.pop(); if (start) ranges.set(start.node, { from: start.from, to }); }
    else {
      const node = elements[index++]; if (!node) break;
      for (const attr of Array.from(node.attributes)) {
        const escaped = attr.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const a = new RegExp(`\\s(${escaped}\\s*=\\s*(?:"[^"]*"|'[^']*'))`).exec(token);
        if (a) ranges.set(attr, { from: from + a.index + a[0].length - a[1].length, to: from + a.index + a[0].length });
      }
      ranges.set(node, { from, to }); if (!/\/\s*>$/.test(token)) stack.push({ node, from });
    }
  }
  return ranges;
}
export function rangeFor(node: Node, ranges: WeakMap<Node, SourceRange>) { return ranges.get(node) || (node.parentNode ? ranges.get(node.parentNode) : undefined); }
export function errorHelp(message: string): string {
  if (/prefix|namespace/i.test(message)) return 'Check the namespace bindings. XPath 1.0 needs a prefix even when the XML uses a default namespace.';
  if (/mismatch|closing|Opening and ending|Premature|tag/i.test(message)) return 'Check the opening and closing tags near the reported line. XML names are case-sensitive.';
  if (/DTD|entity|external|include|import|document\(/i.test(message)) return 'Only self-contained documents are allowed. No files or URLs are fetched by the transformation.';
  if (/timeout|too long|time limit/i.test(message)) return 'Try a smaller document or check for a recursive template. Your inputs have been kept.';
  return 'Your inputs have been kept. Review the message, correct the document and run again.';
}
