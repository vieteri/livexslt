import DOMPurify from 'dompurify';
/** Only the visual preview is sanitized. Raw exports are not modified. */
export function previewDocument(raw: string): string {
  const clean = DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'meta', 'base', 'link', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'video', 'audio', 'source', 'track', 'foreignObject', 'animate', 'set'],
    FORBID_ATTR: ['href', 'src', 'srcset', 'action', 'formaction', 'poster', 'data', 'xlink:href', 'ping', 'autofocus']
  });
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><meta name="referrer" content="no-referrer"><style>body{font:15px system-ui,sans-serif;padding:24px;color:#172b3a;line-height:1.6}table{border-collapse:collapse;width:100%}td,th{border:1px solid #dde4e9;padding:12px;text-align:left}th{background:#f3f6f8}h1{font-size:24px}</style></head><body>${clean}</body></html>`;
}
