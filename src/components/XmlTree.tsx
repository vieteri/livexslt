'use client';
import { useMemo, useState } from 'react';
import { Icon } from './Icons';
import type { Namespace } from '@/lib/model';
import { nodePath } from '@/lib/xml';
export default function XmlTree({ doc, namespaces, matches, onSelect }: {
  doc: Document; namespaces: Namespace[]; matches: Node[]; onSelect: (node: Node) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<Node>>(new Set());
  const [limit, setLimit] = useState(400);
  const matchSet = useMemo(() => new Set(matches), [matches]);
  const rows = useMemo(() => {
    const out: Array<{ node: Element | Attr; depth: number }> = [];
    const stack: Array<{ node: Element | Attr; depth: number }> = [{ node: doc.documentElement, depth: 0 }];
    while (stack.length) {
      const row = stack.pop()!; out.push(row);
      if (row.node.nodeType === 1 && !collapsed.has(row.node)) {
        const el = row.node as Element;
        const children: Array<Element | Attr> = [...Array.from(el.attributes).filter(a => a.namespaceURI !== 'http://www.w3.org/2000/xmlns/'), ...Array.from(el.children)];
        for (let i = children.length - 1; i >= 0; i--) stack.push({ node: children[i], depth: row.depth + 1 });
      }
    }
    return out;
  }, [doc, collapsed]);
  return <div className="tree" aria-label="XML structure">
    <div className="tree-help">Select a node to get its XPath. Green rows match your query.</div>
    {rows.slice(0, limit).map(({ node, depth }, i) => {
      const element = node.nodeType === 1 ? node as Element : null;
      const hasChildren = !!element && (!!element.children.length || Array.from(element.attributes).some(a => a.namespaceURI !== 'http://www.w3.org/2000/xmlns/'));
      const preview = element ? (element.children.length ? `${element.children.length} ${element.children.length === 1 ? 'element' : 'elements'}` : (element.textContent || '').trim() || 'empty') : (node as Attr).value || 'empty';
      return <div className={`tree-row ${matchSet.has(node) ? 'matched' : ''}`} key={`${i}-${node.nodeName}`} style={{ paddingLeft: Math.min(depth, 10) * 16 + 8 }}>
        {hasChildren ? <button className="tree-fold" aria-label={`${collapsed.has(node) ? 'Expand' : 'Collapse'} ${node.nodeName}`} aria-expanded={!collapsed.has(node)} onClick={() => setCollapsed(old => {
          const next = new Set(old); if (next.has(node)) next.delete(node); else next.add(node); return next;
        })}><Icon name="chevron" size={13} style={{ transform: collapsed.has(node) ? undefined : 'rotate(90deg)' }} /></button> : <span className="tree-spacer" />}
        <button className="tree-node" onClick={() => onSelect(node)} title={nodePath(node, namespaces)}>
          <span className={element ? 'node-element' : 'node-attribute'}>{element ? '<' + node.nodeName + '>' : '@' + node.nodeName}</span>
          <span className="node-value">{preview.slice(0, 100)}</span>
        </button>
      </div>;
    })}
    {rows.length > limit && <button className="text-button tree-more" onClick={() => setLimit(n => n + 400)}>Show next {Math.min(400, rows.length - limit)} of {rows.length} visible nodes</button>}
  </div>;
}
