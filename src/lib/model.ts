export const MAX_INPUT = 1024 * 1024;
export const MAX_OUTPUT = 4 * 1024 * 1024;
export const STORAGE_KEY = 'xml-studio.workspace.v1';
export const XSL_NS = 'http://www.w3.org/1999/XSL/Transform';
export type Mode = 'transform' | 'inspect';
export type OutputMethod = 'xml' | 'html' | 'text';
export interface Parameter { name: string; namespaceUri?: string; defaultDescription: string }
export interface Override { key: string; enabled: boolean; value: string; type: 'string' | 'number' | 'boolean' }
export interface Namespace { prefix: string; uri: string }
export interface SourceRange { from: number; to: number }
export interface WorkspaceData { xml: string; xslt: string; xpath: string; mode: Mode; autoRun: boolean; overrides: Override[]; namespaces: Namespace[] }
export const emptyWorkspace = (): WorkspaceData => ({ xml: '', xslt: '', xpath: '', mode: 'transform', autoRun: false, overrides: [], namespaces: [] });
export const paramKey = (p: Parameter) => `${p.namespaceUri || ''}|${p.name}`;
export function utf8Size(value: string): number { return new TextEncoder().encode(value).length; }
export function checkSize(value: string, label: string) {
  if (utf8Size(value) > MAX_INPUT) throw new Error(`${label} is too large. Use a UTF-8 document smaller than 1 MiB.`);
}
export function decodeSaved(value: string): WorkspaceData {
  if (value.length > MAX_INPUT * 3) throw new Error('Saved workspace is too large.');
  const saved = JSON.parse(value);
  if (saved.version !== 1 || !saved.data || typeof saved.data !== 'object') throw new Error('This saved workspace is not supported.');
  const d = saved.data;
  if (typeof d.xml !== 'string' || typeof d.xslt !== 'string' || typeof d.xpath !== 'string') throw new Error('Saved documents are invalid.');
  checkSize(d.xml, 'Saved XML'); checkSize(d.xslt, 'Saved XSLT');
  if (d.xpath.length > 8000) throw new Error('Saved XPath is too long.');
  const overrides: Override[] = Array.isArray(d.overrides) ? d.overrides.filter((o: Override) => o && typeof o.key === 'string' && typeof o.value === 'string' && typeof o.enabled === 'boolean' && ['string', 'number', 'boolean'].includes(o.type)).slice(0, 100) : [];
  const namespaces: Namespace[] = Array.isArray(d.namespaces) ? d.namespaces.filter((n: Namespace) => n && typeof n.prefix === 'string' && typeof n.uri === 'string').slice(0, 100) : [];
  return { xml: d.xml, xslt: d.xslt, xpath: d.xpath, mode: d.mode === 'inspect' ? 'inspect' : 'transform', autoRun: false, overrides, namespaces };
}
