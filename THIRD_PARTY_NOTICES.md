# Third-party notices

## xslt-processor 5.1.2

The JavaScript XSLT engine is an unmodified npm dependency licensed under LGPL-3.0. Its license is copied from the installed package into `public/licenses/xslt-processor-LGPL-3.0.txt` during the build, served at `/licenses/xslt-processor-LGPL-3.0.txt`.

- Source: https://github.com/DesignLiquido/xslt-processor/tree/v5.1.2
- Package: https://www.npmjs.com/package/xslt-processor/v/5.1.2
- License: https://github.com/DesignLiquido/xslt-processor/blob/v5.1.2/LICENSE

Application source and build instructions are in this repository. To use a modified engine, replace the dependency with a local checkout or package and rebuild with `npm run build`. The worker is a separately generated bundle. No engine source is copied into application modules or modified.

## CodeMirror and React CodeMirror

CodeMirror and @uiw/react-codemirror are MIT-licensed. Source and licenses:

- https://github.com/codemirror/dev
- https://github.com/uiwjs/react-codemirror

## DOMPurify

DOMPurify is offered under Apache-2.0 or MPL-2.0. Source and licenses:

- https://github.com/cure53/DOMPurify

Other dependency notices remain in the installed npm packages and generated dependency bundles.
