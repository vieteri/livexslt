'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent } from 'react';
import { Icon } from './Icons';
import Dialog from './Dialog';
import XmlTree from './XmlTree';
import { examples } from '@/lib/examples';
import { checkSize, decodeSaved, emptyWorkspace, MAX_INPUT, paramKey, STORAGE_KEY, utf8Size, type OutputMethod, type Override, type SourceRange, type WorkspaceData } from '@/lib/model';
import { detectNamespaces, effectiveParameters, errorHelp, evaluateXPath, nodePath, parseDocument, prettyXml, rangeFor, sourceRanges, stylesheetInfo, type XPathValue } from '@/lib/xml';
import { previewDocument } from '@/lib/preview';
const CodeEditor = dynamic(() => import('./CodeEditor'), { ssr: false, loading: () => <div className="editor-loading">Opening editor…</div> });
type Result = { raw: string; signature: string; method: OutputMethod; duration: number };
type Query = { signature: string; result?: XPathValue; error?: string };
const signatureOf = (d: WorkspaceData) => JSON.stringify([d.xml, d.xslt, d.overrides]);
const messageOf = (e: unknown) => e instanceof Error ? e.message : String(e);
const initialWidths = [1, 1, 1];

export default function Workspace() {
  const [data, setData] = useState<WorkspaceData>(emptyWorkspace);
  const [remember, setRemember] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [query, setQuery] = useState<Query | null>(null);
  const [xmlView, setXmlView] = useState<'code' | 'tree'>('code');
  const [resultView, setResultView] = useState<'raw' | 'formatted' | 'preview'>('raw');
  const [activePanel, setActivePanel] = useState('xml');
  const [dialog, setDialog] = useState<'examples' | 'help' | null>(null);
  const [toast, setToast] = useState('');
  const [focusRange, setFocusRange] = useState<SourceRange | null>(null);
  const [widths, setWidths] = useState(initialWidths);
  const [nsOpen, setNsOpen] = useState(false);
  const xmlFile = useRef<HTMLInputElement>(null);
  const xslFile = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ index: number; x: number; width: number; widths: number[] } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const job = useRef<{ worker: Worker; timeout: ReturnType<typeof setTimeout>; signature: string } | null>(null);
  const latest = useRef(data);
  useEffect(() => { latest.current = data; }, [data]);
  const notify = useCallback((text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(text); toastTimer.current = setTimeout(() => setToast(''), 4500);
  }, []);
  const dispose = useCallback(() => {
    if (job.current) { clearTimeout(job.current.timeout); job.current.worker.terminate(); job.current = null; }
  }, []);
  useEffect(() => () => { dispose(); if (toastTimer.current) clearTimeout(toastTimer.current); }, [dispose]);
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) { setData(decodeSaved(savedData)); setRemember(true); setSaved(true); notify('Your saved workspace is restored. Auto-run stays off until you enable it.'); }
    } catch { notify('The saved workspace could not be restored. Start fresh or clear saved data in Help.'); }
    setHydrated(true);
  }, [notify]);
  useEffect(() => {
    if (!hydrated || !remember) return;
    setSaved(false);
    const timer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, data })); setSaved(true); }
      catch { setRemember(false); notify('This device could not save the workspace. Your open documents are still here; export them before leaving.'); }
    }, 450);
    return () => clearTimeout(timer);
  }, [data, remember, hydrated, notify]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!data.xml && !data.xslt) return;
      if (remember) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, data })); return; } catch { /* Warn rather than lose edits. */ }
      }
      event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [data, remember]);
  const xmlInfo = useMemo(() => {
    if (!data.xml.trim()) return { doc: null, error: '' };
    try { return { doc: parseDocument(data.xml), error: '' }; } catch (e) { return { doc: null, error: messageOf(e) }; }
  }, [data.xml]);
  const styleInfo = useMemo(() => {
    if (!data.xslt.trim()) return { info: null, error: '' };
    try { return { info: stylesheetInfo(data.xslt), error: '' }; } catch (e) { return { info: null, error: messageOf(e) }; }
  }, [data.xslt]);
  const detectedNamespaces = useMemo(() => xmlInfo.doc ? detectNamespaces(xmlInfo.doc) : [], [xmlInfo.doc]);
  const namespaces = data.namespaces.length ? data.namespaces : detectedNamespaces;
  const ranges = useMemo(() => xmlInfo.doc ? sourceRanges(xmlInfo.doc, data.xml) : new WeakMap<Node, SourceRange>(), [xmlInfo.doc, data.xml]);
  const signature = useMemo(() => signatureOf(data), [data]);
  const querySignature = JSON.stringify([data.xml, data.xpath, namespaces]);
  const queryIsCurrent = query?.signature === querySignature;
  const matches = useMemo(() => queryIsCurrent && query?.result?.type === 'nodes' ? query.result.nodes : [], [queryIsCurrent, query]);
  const highlights = useMemo(() => focusRange ? [focusRange] : matches.map(n => rangeFor(n, ranges)).filter((r): r is SourceRange => !!r), [focusRange, matches, ranges]);
  const resultIsCurrent = result?.signature === signature;
  const parameters = styleInfo.info?.parameters || [];
  const overrideCount = parameters.filter(p => data.overrides.some(o => o.key === paramKey(p) && o.enabled)).length;
  useEffect(() => {
    if (job.current && job.current.signature !== signature) { dispose(); setRunning(false); }
    setError('');
  }, [signature, dispose]);
  useEffect(() => { setFocusRange(null); }, [data.xml, data.xpath]);
  const runTransform = useCallback((snapshot: WorkspaceData) => {
    dispose(); setError('');
    let info: ReturnType<typeof stylesheetInfo>;
    let supplied: ReturnType<typeof effectiveParameters>;
    try {
      parseDocument(snapshot.xml); info = stylesheetInfo(snapshot.xslt);
      supplied = effectiveParameters(info.parameters, snapshot.overrides);
    } catch (e) { setError(messageOf(e)); setRunning(false); setActivePanel('result'); return; }
    const runSignature = signatureOf(snapshot);
    setRunning(true); setActivePanel('result');
    let worker: Worker;
    try { worker = new Worker(new URL('../workers/transform.worker.ts', import.meta.url)); }
    catch (e) { setRunning(false); setError(`The local transformation worker could not start: ${messageOf(e)}`); return; }
    const timeout = setTimeout(() => {
      if (job.current?.worker !== worker) return;
      dispose(); setRunning(false); setError('Transformation reached the 10-second time limit. Your inputs have been kept.');
    }, 10000);
    job.current = { worker, timeout, signature: runSignature };
    worker.onmessage = (event: MessageEvent<{ result?: string; error?: string; duration?: number }>) => {
      if (job.current?.worker !== worker || signatureOf(latest.current) !== runSignature) return;
      const reply = event.data; dispose(); setRunning(false);
      if (reply.error) { setError(reply.error.slice(0, 500)); return; }
      const raw = reply.result ?? '';
      const method = !info.hasOutputMethod && /^\s*(?:<!doctype[^>]*>\s*)?<html[\s>]/i.test(raw) ? 'html' : info.method;
      setResult({ raw, method, signature: runSignature, duration: reply.duration || 0 }); setResultView('raw');
    };
    worker.onerror = () => { if (job.current?.worker === worker) { dispose(); setRunning(false); setError('The transformation worker stopped unexpectedly. Try a smaller or simpler stylesheet.'); } };
    worker.postMessage({ xml: snapshot.xml, xslt: snapshot.xslt, parameters: supplied });
  }, [dispose]);
  useEffect(() => {
    if (!data.autoRun || data.mode !== 'transform' || !data.xml.trim() || !data.xslt.trim() || xmlInfo.error || styleInfo.error || resultIsCurrent) return;
    const timer = setTimeout(() => runTransform(data), 650);
    return () => clearTimeout(timer);
  }, [data, xmlInfo.error, styleInfo.error, resultIsCurrent, runTransform]);
  const runQuery = useCallback((expression = data.xpath) => {
    setFocusRange(null);
    const querySig = JSON.stringify([data.xml, expression, namespaces]);
    try { const doc = xmlInfo.doc || parseDocument(data.xml); const value = evaluateXPath(doc, expression, namespaces); setQuery({ signature: querySig, result: value }); }
    catch (e) { setQuery({ signature: querySig, error: messageOf(e) }); }
  }, [data.xml, data.xpath, namespaces, xmlInfo.doc]);
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !dialog) {
        e.preventDefault();
        if (data.mode === 'transform' && data.xml.trim() && data.xslt.trim()) runTransform(data);
        else if (data.mode === 'inspect' && data.xml.trim() && data.xpath.trim()) runQuery();
      }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [data, dialog, runTransform, runQuery]);
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); notify('Copied to clipboard.'); }
    catch { notify('Clipboard access was blocked. Select the text and copy it, or download the file.'); }
  };
  const download = (value: string, filename: string, mime = 'text/plain') => {
    const url = URL.createObjectURL(new Blob([value], { type: mime + ';charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportResult = (clipboard: boolean) => {
    if (!result) return;
    if (!resultIsCurrent && !window.confirm('This is the previous successful result, not the result of your current inputs. Export it anyway?')) return;
    if (clipboard) void copy(result.raw);
    else download(result.raw, `result.${result.method === 'text' ? 'txt' : result.method}`, result.method === 'xml' ? 'application/xml' : `text/${result.method === 'html' ? 'html' : 'plain'}`);
  };
  const clearStorage = () => {
    setRemember(false); setSaved(false);
    try { localStorage.removeItem(STORAGE_KEY); notify('Saved data cleared. Your open documents have not changed.'); }
    catch { notify('This browser blocked access to saved data. Clear site data in your browser settings.'); }
  };
  const confirmReplace = (text: string) => (!data.xml && !data.xslt) || window.confirm(text);
  const newWorkspace = () => {
    if (!confirmReplace('Start a new workspace? This clears both documents, parameters and any saved workspace on this device.')) return;
    dispose(); setRunning(false); setData(emptyWorkspace()); setResult(null); setQuery(null); setError(''); setResultView('raw'); setActivePanel('xml'); setXmlView('code'); setFocusRange(null); clearStorage();
    notify('New workspace. Nothing is prefilled.');
  };
  const loadExample = (example: typeof examples[number]) => {
    if (!confirmReplace('Replace the current documents with this complete example? Existing parameter overrides and results will be cleared.')) return;
    dispose(); setRunning(false); setError(''); setResult(null); setQuery(null); setFocusRange(null); setResultView('raw');
    setData({ ...emptyWorkspace(), xml: example.xml, xslt: example.xslt, mode: example.id === 'namespaces' ? 'inspect' : 'transform' });
    setXmlView(example.id === 'namespaces' ? 'tree' : 'code'); setActivePanel('xml'); setDialog(null);
    notify(`${example.title} loaded. ${example.id === 'namespaces' ? 'Select an XML node to explore it.' : 'Run the transformation when you are ready.'}`);
  };
  const openFile = async (file: File, field: 'xml' | 'xslt') => {
    try {
      if (file.size > MAX_INPUT) throw new Error('Use a UTF-8 file smaller than 1 MiB.');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); checkSize(text, 'File');
      if (latest.current[field] && !window.confirm(`Replace the current ${field === 'xml' ? 'XML' : 'XSLT'} with ${file.name}?`)) return;
      setData(old => ({ ...old, [field]: text, ...(field === 'xslt' ? { overrides: [] } : { namespaces: [] }) }));
      setActivePanel(field); if (field === 'xml') setXmlView('code'); notify(`${file.name} opened locally. No upload was made.`);
    } catch (e) { notify(e instanceof TypeError ? 'The file is not valid UTF-8. Convert its encoding before opening it.' : messageOf(e)); }
  };
  const dropFile = (event: DragEvent, field: 'xml' | 'xslt') => {
    if (!event.dataTransfer.files.length) return;
    event.preventDefault(); event.stopPropagation();
    if (event.dataTransfer.files.length !== 1) { notify('Drop one file into each input panel.'); return; }
    void openFile(event.dataTransfer.files[0], field);
  };
  const updateOverride = (key: string, patch: Partial<Override>) => setData(old => {
    const existing = old.overrides.find(o => o.key === key) || { key, enabled: false, value: '', type: 'string' as const };
    return { ...old, overrides: [...old.overrides.filter(o => o.key !== key), { ...existing, ...patch }] };
  });
  const selectNode = (node: Node, siblings = false) => {
    const expression = nodePath(node, namespaces, siblings); setData(old => ({ ...old, xpath: expression })); runQuery(expression);
  };
  const showSource = (node: Node) => { const range = rangeFor(node, ranges); setFocusRange(range || null); setXmlView('code'); setActivePanel('xml'); };
  const beginResize = (e: PointerEvent<HTMLDivElement>, index: number) => {
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { index, x: e.clientX, width: workspaceRef.current?.clientWidth || 1, widths: [...widths] };
  };
  const resize = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d) return;
    const delta = (e.clientX - d.x) / d.width * 3;
    const next = [...d.widths]; const left = d.index, right = left + 1;
    const allowed = Math.max(0.6 - next[left], Math.min(delta, next[right] - 0.6));
    next[left] += allowed; next[right] -= allowed; setWidths(next);
  };
  const separator = (index: number) => <div role="separator" aria-label={`Resize ${index === 0 ? 'XML and XSLT' : 'XSLT and result'} panels`} aria-orientation="vertical" aria-valuenow={Math.round(widths[index] / 3 * 100)} tabIndex={0} className="separator"
    onPointerDown={e => beginResize(e, index)} onPointerMove={resize} onPointerUp={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
    onKeyDown={e => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault(); const next = [...widths], delta = e.key === 'ArrowLeft' ? -0.1 : 0.1; if (next[index] + delta >= 0.6 && next[index + 1] - delta >= 0.6) { next[index] += delta; next[index + 1] -= delta; setWidths(next); } }}><span /></div>;
  const formatted = useMemo(() => {
    if (!result || resultView !== 'formatted') return { text: result?.raw || '', error: '' };
    try { return { text: prettyXml(result.raw), error: '' }; }
    catch { return { text: result.raw, error: 'This result cannot be safely formatted as one XML document. The original output is shown unchanged.' }; }
  }, [result, resultView]);
  const preview = useMemo(() => result && resultView === 'preview' ? previewDocument(result.raw) : '', [result, resultView]);
  const resultStatus = running ? 'Running locally' : error ? 'Needs attention' : result && !resultIsCurrent ? 'Inputs changed' : result ? 'Transformation complete' : data.xml.trim() && data.xslt.trim() ? 'Ready to transform' : 'Add your documents';
  const hasInputs = !!data.xml.trim() && !!data.xslt.trim();

  return <main className="app-shell">
    <a className="skip-link" href="#workspace">Skip to workspace</a>
    <header className="app-header">
      <div className="brand"><span className="brand-mark"><Icon name="code" size={21} /></span><div><h1>XML Studio<span className="preview-badge">DEMO</span></h1><p>Less setup. More clarity.</p></div></div>
      <div className="header-actions"><button className="button quiet" onClick={() => setDialog('examples')}><Icon name="file" />Examples</button><button className="button quiet" onClick={newWorkspace}><Icon name="plus" />New workspace</button><button className="icon-button" aria-label="Help and privacy" onClick={() => setDialog('help')}><Icon name="help" size={19} /></button></div>
    </header>
    <div className="workspace-heading">
      <div className="mode-tabs" role="tablist" aria-label="Workspace mode">
        <button role="tab" aria-selected={data.mode === 'transform'} aria-controls="workspace" id="transform-tab" onClick={() => { setData(old => ({ ...old, mode: 'transform' })); setActivePanel('xml'); }}><Icon name="arrow" />Transform XML</button>
        <button role="tab" aria-selected={data.mode === 'inspect'} aria-controls="workspace" id="inspect-tab" onClick={() => { setData(old => ({ ...old, mode: 'inspect' })); setActivePanel('xml'); }}><Icon name="search" />Inspect &amp; XPath</button>
      </div>
      <span className="privacy-note"><Icon name="shield" size={14} />Runs on your device. No document uploads.</span>
    </div>
    <section className="workspace-intro"><div><h2>{data.mode === 'transform' ? 'Your XML in. Your result out.' : 'Find what you need in your XML.'}</h2><p>{data.mode === 'transform' ? 'Add your source and stylesheet, then run. Parameters are optional.' : 'Paste a document, select a node, or write an XPath. No stylesheet needed.'}</p></div><button className="text-button" onClick={() => setDialog('examples')}>Try a complete example <Icon name="arrow" size={14} /></button></section>
    {data.mode === 'transform' && <div className="run-bar">
      <div className="run-actions"><button className="button primary" disabled={!hasInputs || running} onClick={() => runTransform(data)} data-testid="run-transform"><Icon name="play" />{running ? 'Running…' : 'Run transformation'}</button>
        {running && <button className="button quiet" onClick={() => { dispose(); setRunning(false); notify('Run cancelled. Your inputs have been kept.'); }}><Icon name="stop" />Cancel</button>}
        <span className="shortcut">Ctrl / ⌘ + Enter</span><span className="control-divider" /><label className="check-control"><input type="checkbox" checked={data.autoRun} onChange={e => setData(old => ({ ...old, autoRun: e.target.checked }))} />Auto-run</label>
      </div><div className={`run-status ${error ? 'bad' : resultIsCurrent ? 'good' : ''}`} role="status"><span className={`status-dot ${running ? 'busy' : ''}`} />{resultStatus}</div>
    </div>}
    {data.mode === 'transform' && <div className="mobile-tabs" role="tablist" aria-label="Editor panel">{[['xml', '1', 'XML input'], ['xslt', '2', 'XSLT'], ['result', '3', 'Result']].map(([id, step, label]) => <button key={id} role="tab" aria-selected={activePanel === id} aria-controls={`${id}-panel`} onClick={() => setActivePanel(id)}><span>{step}</span>{label}</button>)}</div>}
    <div id="workspace" ref={workspaceRef} role="tabpanel" aria-labelledby={`${data.mode}-tab`} className={`workspace-grid ${data.mode}`} style={data.mode === 'transform' ? { gridTemplateColumns: `${widths[0]}fr 8px ${widths[1]}fr 8px ${widths[2]}fr` } as CSSProperties : undefined}>
      <section className={`editor-panel ${activePanel === 'xml' ? 'mobile-active' : ''}`} id="xml-panel" onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }} onDrop={e => dropFile(e, 'xml')}>
        <div className="panel-heading"><div className="panel-name"><span className="step">01</span><h3>XML input</h3></div><div className="panel-tools"><button className="small-button" onClick={() => xmlFile.current?.click()}><Icon name="file" size={14} />Open file</button><button className="icon-button compact" disabled={!data.xml} aria-label="Copy XML input" onClick={() => void copy(data.xml)}><Icon name="copy" size={14} /></button><button className="icon-button compact" disabled={!data.xml} aria-label="Download XML input" onClick={() => download(data.xml, 'input.xml', 'application/xml')}><Icon name="down" size={14} /></button></div></div>
        <input ref={xmlFile} type="file" className="hidden" accept=".xml,text/xml,application/xml" aria-label="Open XML file" onChange={e => { if (e.target.files?.[0]) void openFile(e.target.files[0], 'xml'); e.target.value = ''; }} />
        {data.mode === 'inspect' && <div className="view-bar"><div className="segmented" aria-label="XML view"><button aria-pressed={xmlView === 'code'} onClick={() => setXmlView('code')}>Code</button><button aria-pressed={xmlView === 'tree'} disabled={!xmlInfo.doc} onClick={() => setXmlView('tree')}>Tree</button></div><span>{xmlInfo.doc ? `${xmlInfo.doc.getElementsByTagName('*').length} elements` : 'Add XML to explore'}</span></div>}
        <div className="editor-body">{data.mode === 'inspect' && xmlView === 'tree' && xmlInfo.doc ? <XmlTree key={data.xml} doc={xmlInfo.doc} namespaces={namespaces} matches={matches} onSelect={selectNode} /> : <CodeEditor label="XML input" value={data.xml} onChange={xml => setData(old => ({ ...old, xml }))} placeholder={'Paste your XML here…\n\nOr open an .xml file or drop it into this panel.'} highlights={data.mode === 'inspect' ? highlights : undefined} />}</div>
        <div className="panel-footer"><span>{data.xml ? `${(utf8Size(data.xml) / 1024).toFixed(1)} KiB · UTF-8` : 'Your document stays in this browser'}</span>{data.xml && <span className={xmlInfo.error ? 'bad' : 'good'}>{xmlInfo.error ? 'Check XML' : 'Well-formed XML'}</span>}</div>
        {data.mode === 'inspect' && xmlInfo.error && <div className="inline-error" role="alert">{xmlInfo.error}</div>}
      </section>
      {data.mode === 'transform' ? <>
        {separator(0)}
        <section className={`editor-panel ${activePanel === 'xslt' ? 'mobile-active' : ''}`} id="xslt-panel" onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }} onDrop={e => dropFile(e, 'xslt')}>
          <div className="panel-heading"><div className="panel-name"><span className="step">02</span><h3>XSLT stylesheet</h3></div><div className="panel-tools"><button className="small-button" onClick={() => xslFile.current?.click()}><Icon name="file" size={14} />Open file</button><button className="icon-button compact" disabled={!data.xslt} aria-label="Copy XSLT stylesheet" onClick={() => void copy(data.xslt)}><Icon name="copy" size={14} /></button><button className="icon-button compact" disabled={!data.xslt} aria-label="Download XSLT stylesheet" onClick={() => download(data.xslt, 'stylesheet.xsl', 'application/xml')}><Icon name="down" size={14} /></button></div></div>
          <input ref={xslFile} type="file" className="hidden" accept=".xsl,.xslt,.xml,text/xml,application/xml" aria-label="Open XSLT file" onChange={e => { if (e.target.files?.[0]) void openFile(e.target.files[0], 'xslt'); e.target.value = ''; }} />
          <div className="editor-body"><CodeEditor label="XSLT stylesheet" value={data.xslt} onChange={xslt => setData(old => ({ ...old, xslt }))} placeholder={'Paste your XSLT stylesheet here…\n\nNeed a starting point? Try a complete example.'} /></div>
          <div className="panel-footer"><span>XSLT 1.0 · local JavaScript engine</span><button className="text-button" onClick={() => setDialog('help')}>Compatibility</button></div>
        </section>
        {separator(1)}
        <section className={`editor-panel result-panel ${activePanel === 'result' ? 'mobile-active' : ''}`} id="result-panel">
          <div className="panel-heading"><div className="panel-name"><span className="step">03</span><h3>Result</h3></div><div className="panel-tools"><button className="small-button" disabled={!result || running} onClick={() => exportResult(true)}><Icon name="copy" size={14} />Copy</button><button className="small-button" disabled={!result || running} onClick={() => exportResult(false)}><Icon name="down" size={14} />Download</button></div></div>
          {result && <div className="view-bar"><div className="segmented" aria-label="Result view"><button aria-pressed={resultView === 'raw'} onClick={() => setResultView('raw')}>Raw</button>{result.method === 'xml' && <button aria-pressed={resultView === 'formatted'} onClick={() => setResultView('formatted')}>Formatted</button>}{result.method !== 'text' && <button aria-pressed={resultView === 'preview'} onClick={() => setResultView('preview')}>Preview</button>}</div><span>{result.method.toUpperCase()}</span></div>}
          {error && <div className="error-card" role="alert"><strong>Transformation needs attention</strong><p>{error}</p><small>{errorHelp(error)}</small>{result && <b>Showing the previous successful result below.</b>}</div>}
          {result && !resultIsCurrent && !error && <div className="notice">Inputs changed. Run again to update this result.</div>}
          {resultView === 'formatted' && result && <div className="notice subtle">{formatted.error || 'Formatting is a display option. Copy and Download always use the original output.'}</div>}
          {resultView === 'preview' && result && <div className="notice subtle">Restricted preview. Scripts, forms, links and external resources are removed. Export stays unchanged.</div>}
          <div className="editor-body" data-testid="result-body">
            {result ? resultView === 'preview' ? <iframe sandbox="" referrerPolicy="no-referrer" title="Restricted result preview" srcDoc={preview} /> : <div className="result-source" data-testid="result-source">{!result.raw && <div className="empty-output">The transformation succeeded and produced an empty result.</div>}<CodeEditor label="Transformation result" value={resultView === 'formatted' ? formatted.text : result.raw} readOnly plainText={result.method === 'text'} /></div> : <div className="empty-result"><span className="empty-symbol"><Icon name="arrow" size={26} /></span><h4>{running ? 'Transforming on your device…' : hasInputs ? 'Ready when you are.' : 'Your result will appear here.'}</h4><p>{running ? 'You can cancel without losing your inputs.' : hasInputs ? 'Run your transformation to see the output.' : 'Add XML and a stylesheet, then run your transformation.'}</p>{!hasInputs && <button className="text-button" onClick={() => setDialog('examples')}>Start with an example <Icon name="arrow" size={14} /></button>}</div>}
          </div><div className="panel-footer"><span>{result ? `${utf8Size(result.raw).toLocaleString()} bytes · ${result.duration} ms` : 'No result yet'}</span><span>{result ? (resultIsCurrent && !error ? 'Current result' : 'Previous result') : 'Nothing leaves your device'}</span></div>
        </section>
      </> : <section className="inspector-panel">
        <div className="panel-heading"><div className="panel-name"><Icon name="search" /><h3>XPath inspector</h3></div><span className="version-label">XPath 1.0</span></div>
        <div className="query-controls"><label className="field-label" htmlFor="xpath">XPath expression</label><textarea id="xpath" value={data.xpath} onChange={e => setData(old => ({ ...old, xpath: e.target.value }))} rows={2} placeholder="Enter an XPath, or select a node in the XML tree…" spellCheck={false} autoCapitalize="none" maxLength={8000} />
          <div className="query-actions"><button className="button primary" disabled={!data.xml.trim() || !data.xpath.trim()} onClick={() => runQuery()}><Icon name="play" />Evaluate XPath</button><button className="small-button" disabled={!data.xpath} onClick={() => void copy(data.xpath)}><Icon name="copy" size={14} />Copy XPath</button></div>
          <button className="disclosure-button" aria-expanded={nsOpen} onClick={() => setNsOpen(!nsOpen)}><Icon name="chevron" size={12} style={{ transform: nsOpen ? 'rotate(90deg)' : undefined }} />Namespaces <span>{namespaces.length ? `${namespaces.length} detected / configured` : 'optional'}</span></button>
          {nsOpen && <div className="namespaces"><p>Default namespaces need a prefix in XPath 1.0. Detected prefixes are editable; changing a binding does not change your XML.</p>{namespaces.map((n, i) => <div className="namespace-row" key={i}><input aria-label={`Namespace prefix ${i + 1}`} value={n.prefix} placeholder="ns" onChange={e => setData(old => ({ ...old, namespaces: namespaces.map((v, j) => j === i ? { ...v, prefix: e.target.value } : v) }))} /><input aria-label={`Namespace URI ${i + 1}`} value={n.uri} placeholder="urn:example" onChange={e => setData(old => ({ ...old, namespaces: namespaces.map((v, j) => j === i ? { ...v, uri: e.target.value } : v) }))} /><button className="icon-button compact" aria-label={`Remove namespace ${i + 1}`} onClick={() => setData(old => ({ ...old, namespaces: namespaces.filter((_, j) => j !== i) }))}><Icon name="close" size={13} /></button></div>)}<div className="namespace-actions"><button className="text-button" onClick={() => setData(old => ({ ...old, namespaces: [...namespaces, { prefix: '', uri: '' }] }))}>+ Add binding</button><button className="text-button" onClick={() => setData(old => ({ ...old, namespaces: [] }))}>Reset to detected</button></div></div>}
        </div>
        <div className="query-results" aria-live="polite">
          {query && !queryIsCurrent && <div className="notice">XML, expression or namespaces changed. Evaluate again to update the matches.</div>}
          {queryIsCurrent && query?.error && <div className="error-card" role="alert"><strong>Could not evaluate XPath</strong><p>{query.error}</p><small>{errorHelp(query.error)}</small></div>}
          {!query || !queryIsCurrent ? <div className="empty-result inspect-empty"><span className="empty-symbol"><Icon name="search" size={24} /></span><h4>Find a value. Understand its path.</h4><p>Open the XML tree and select a node, or enter an expression above. An empty field does not run a query.</p>{!!xmlInfo.doc && <button className="text-button" onClick={() => setXmlView('tree')}>Explore the XML tree <Icon name="arrow" size={14} /></button>}</div> : query.result?.type === 'nodes' ? <>
            <div className="results-heading"><strong>{matches.length === 0 ? 'No matching nodes' : `${matches.length} matching ${matches.length === 1 ? 'node' : 'nodes'}`}</strong><span>Click a result to locate it.</span></div>
            {!matches.length && <p className="zero-matches">The expression is valid, but nothing matched. Check element names and namespace prefixes.</p>}
            {matches.slice(0, 200).map((node, i) => <article className="match-card" key={i}><div className="match-heading"><span className="match-number">{i + 1}</span><code>{node.nodeName}</code><button className="text-button" onClick={() => showSource(node)}>View in source</button></div><pre>{node.nodeType === 2 ? (node as Attr).value || '(empty attribute)' : (node.textContent || '').trim() || '(empty element)'}</pre><div className="match-actions"><button className="text-button" onClick={() => void copy(nodePath(node, namespaces))}>Copy XPath</button><button className="text-button" onClick={() => void copy(node.textContent || '')}>Copy value</button>{node.nodeType === 1 && <button className="text-button" onClick={() => selectNode(node, true)}>All matching siblings</button>}</div></article>)}
            {matches.length > 200 && <div className="notice">Showing the first 200 of {matches.length} matches. Narrow the query to see a smaller set.</div>}
          </> : query.result ? <div className="scalar-result"><span className="version-label">{query.result.type}</span><h4>XPath returned a {query.result.type}.</h4><pre>{query.result.value === '' ? '(empty string)' : query.result.value}</pre><button className="small-button" onClick={() => query.result && query.result.type !== 'nodes' && void copy(query.result.value)}><Icon name="copy" size={14} />Copy value</button></div> : null}
        </div>
      </section>}
    </div>
    {data.mode === 'transform' && <details className="parameters" key="parameters"><summary><span className="parameters-title">Parameters <span className="optional">Optional</span></span><span>{overrideCount ? `${overrideCount} overridden` : parameters.length ? `${parameters.length} available · using stylesheet defaults` : 'No overrides'}</span></summary><div className="parameters-body"><p>Use the stylesheet defaults unless you need something different. Turn on an override to supply a value; an empty string is a valid value.</p>{!parameters.length ? <div className="parameter-empty">{styleInfo.error ? 'Correct the stylesheet to detect its parameters.' : data.xslt ? 'No top-level xsl:param declarations were found. You can run this stylesheet without parameters.' : 'Add a stylesheet to discover its parameters. You do not need to create any now.'}</div> : <div className="parameter-grid">{parameters.map((p, i) => {
      const key = paramKey(p); const override = data.overrides.find(o => o.key === key); const enabled = !!override?.enabled;
      return <div className="parameter-card" key={key}><div className="parameter-heading"><code>{p.name}</code><label className="check-control"><input type="checkbox" aria-label={`Override ${p.name}`} checked={enabled} onChange={e => updateOverride(key, { enabled: e.target.checked })} />Override default</label></div>{p.namespaceUri && <small className="parameter-namespace">Namespace: {p.namespaceUri}</small>}<div className="parameter-default">Default: <code>{p.defaultDescription}</code></div>{enabled ? <div className="parameter-input"><label htmlFor={`parameter-${i}`} className="field-label">Value for {p.name}</label><div className="typed-value"><select aria-label={`Type of ${p.name}`} value={override?.type || 'string'} onChange={e => updateOverride(key, { type: e.target.value as Override['type'], value: e.target.value === 'boolean' ? 'false' : '' })}><option value="string">String</option><option value="number">Number</option><option value="boolean">Boolean</option></select>{override?.type === 'boolean' ? <select id={`parameter-${i}`} value={override.value} onChange={e => updateOverride(key, { value: e.target.value })}><option value="false">false</option><option value="true">true</option></select> : <input id={`parameter-${i}`} value={override?.value || ''} placeholder={override?.type === 'number' ? 'Enter a number' : 'Empty string'} onChange={e => updateOverride(key, { value: e.target.value })} />}</div>{(!override?.value && (!override || override.type === 'string')) && <small>An empty string will override the default.</small>}</div> : <div className="default-active"><Icon name="check" size={14} />Using stylesheet default</div>}</div>;
    })}</div>}</div></details>}
    <footer className="workspace-footer"><div className="remember-control"><label className="check-control"><input type="checkbox" checked={remember} disabled={!hydrated} onChange={e => { if (e.target.checked) setRemember(true); else clearStorage(); }} />Remember on this device</label><span>{remember ? saved ? 'Saved locally' : 'Saving locally…' : 'Off · closing this tab clears unsaved work'}</span></div><div className="footer-links">{data.mode === 'transform' && <button className="text-button" onClick={() => setWidths(initialWidths)}>Reset layout</button>}<button className="text-button" onClick={() => setDialog('help')}>Privacy &amp; limits</button><span>XML Studio / Live XSLT</span></div></footer>
    {toast && <div className="toast" role="status"><Icon name="check" size={16} />{toast}<button className="icon-button compact" aria-label="Dismiss notification" onClick={() => setToast('')}><Icon name="close" size={13} /></button></div>}
    {dialog === 'examples' && <Dialog title="Start with a complete example" onClose={() => setDialog(null)}><p className="dialog-description">Each example includes matching XML and XSLT. Nothing is replaced without your confirmation.</p><div className="example-list">{examples.map(example => <button className="example-card" key={example.id} onClick={() => loadExample(example)} data-testid={`example-${example.id}`}><span className="example-icon"><Icon name={example.id === 'namespaces' ? 'search' : 'file'} size={21} /></span><span className="example-description"><strong>{example.title}<span>{example.tag}</span></strong><small>{example.description}</small></span><Icon name="arrow" size={18} /></button>)}</div></Dialog>}
    {dialog === 'help' && <Dialog title="A small tool, with clear boundaries" onClose={() => setDialog(null)}><div className="help-copy"><h3>Getting started</h3><p>Transform XML: open or paste XML and XSLT, then run. Inspect &amp; XPath: add only XML, switch to Tree, and select a node. Use Ctrl/⌘ + Enter to run either tool.</p><h3>Compatibility</h3><p>Transformations use the bundled xslt-processor 5.1.2 JavaScript engine in a cancellable worker, not the deprecated native browser XSLTProcessor. This preview targets common, self-contained XSLT 1.0 workflows, not full processor conformance or XSLT 2.0/3.0. Test your real stylesheets before relying on results in production.</p><p>XPath inspection uses your browser’s separate XPath 1.0 API. XSLT parameter values can be strings, numbers or booleans. A disabled override uses the stylesheet’s declared default.</p><h3>Privacy &amp; safe processing</h3><p>Your document contents are not uploaded or sent to an AI service. Editors and the transformation engine are served from this site, not a third-party CDN. Only an explicit “Remember on this device” choice stores your workspace locally. Avoid saving sensitive payloads on shared devices.</p><p>DTDs, entity declarations, imported stylesheets and external document loading are disabled. Previews are sanitized and sandboxed with scripts, forms, navigation links and network resources removed. Raw downloads are not sanitized: open untrusted HTML with care.</p><h3>Limits &amp; output</h3><p>1 MiB per input, 20,000 XML elements, 128 nesting levels, 4 MiB output and a 10-second transformation limit. Downloads are UTF-8. Formatting and restricted preview never change the raw result used by Copy and Download.</p><p>An error does not delete the last successful output. Changed or failed inputs are clearly marked; exporting a previous result asks for confirmation.</p><button className="button secondary" onClick={clearStorage}>Clear saved workspace data</button><p className="license-note">XSLT engine: xslt-processor (LGPL-3.0), unmodified. Editor: CodeMirror (MIT). Sanitizer: DOMPurify (Apache-2.0 or MPL-2.0). See the repository’s third-party notices for source and license information.</p></div></Dialog>}
  </main>;
}
