# XML Studio (Live XSLT)

A small, local-first XML workspace. The redesign is on `demo/xml-workspace`; it does not change the production branch or `xml.viet.fi`.

## Use it

**Transform XML:** paste or open XML and an XSLT stylesheet, then click **Run transformation** (Ctrl/Cmd + Enter). Auto-run is optional and off initially. Complete examples are available on demand. No sample documents or parameter overrides are inserted into a new workspace.

**Inspect & XPath:** paste XML, switch to Tree, and select a node to obtain its exact XPath. Evaluate your own XPath 1.0, inspect scalar results, select matching siblings, copy paths/values, and highlight results in the original source. Namespace bindings are detected and editable. The XPath field starts empty and does not run an empty query.

**Parameters:** top-level `xsl:param` declarations are detected, not overridden. Enable an override to supply a string, number or boolean. An enabled empty string is intentionally different from a disabled override.

**Results:** Copy and Download always export the engine's unmodified output. Formatted XML is only a view; mixed content and `xml:space="preserve"` are preserved. HTML/SVG preview is restricted and sanitized. Changed inputs and failed transformations clearly label retained previous results.

## Privacy and boundaries

- XML and XSLT are processed in the browser. There is no document-upload, analytics, AI or cloud-persistence endpoint.
- CodeMirror and the XSLT engine are locally bundled, not loaded from a third-party CDN.
- Persistence is off until **Remember on this device** is selected. Restoring never enables auto-run. Help includes a clear-saved-data action.
- DTDs, entity declarations, external stylesheets and external document loading are blocked. Previews are sanitized with DOMPurify and rendered in an opaque sandbox with a restrictive CSP. Copy/download remain raw; treat exported HTML as untrusted.
- Limits: 1 MiB per input, 20,000 XML elements, 128 levels, 4 MiB output, and a cancellable 10-second transformation budget.
- Output files use UTF-8. Set a matching `xsl:output` encoding or omit it.

## Compatibility

The runner uses **xslt-processor 5.1.2** in a Web Worker. It no longer depends on native browser `XSLTProcessor`. This preview targets common, self-contained **XSLT 1.0** workflows. It is not a guarantee of complete XSLT conformance and does not expose XSLT 2.0/3.0, engine extensions, imported stylesheets or multi-document loading. Test representative production stylesheets before adopting it.

The inspector uses the separate browser **XPath 1.0** API, independent of native XSLT removal. Default XML namespaces must be mapped to an explicit prefix in XPath; the app generates `ns`, `ns2`, etc. where needed.

## Develop and verify

Node.js 22 or newer:

```sh
npm ci                 # npm install on initial preview bootstrap before its lock is committed
npm run dev
npm run typecheck
npm run lint
npm run build
npx playwright install chromium webkit
npm test
```

The GitHub workflow runs type checking, lint, a production build and browser tests on Chromium and WebKit. Screenshots, traces on failure and the HTML report are uploaded as artifacts. Only after successful checks may it commit the generated dependency lock, and only to `demo/xml-workspace`; it never writes to `master`.

The existing Vercel Git integration provides preview deployments for the demo branch. Do not promote or merge until reviewed. The production domain is not reassigned by this branch.

## Structure

- `src/components/Workspace.tsx`: workspace interaction and state.
- `src/components/CodeEditor.tsx`: bundled CodeMirror with source highlights.
- `src/components/XmlTree.tsx`: incremental tree explorer.
- `src/lib/xml.ts`: validation, parameter discovery, safe formatting, namespaces and XPath.
- `src/lib/preview.ts`: sanitized, network-restricted preview, separate from raw export.
- `src/workers/transform.worker.ts`: isolated transformation and blocked external loaders.
- `tests/workspace.spec.ts`: end-to-end regression and safety checks.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for dependency licenses and source information.
