import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { examples, wrapXslt } from '../src/lib/examples';
async function fill(page: Page, name: string, value: string) { await page.getByRole('textbox', { name, exact: true }).fill(value); }
async function load(page: Page, xml: string, xslt: string) { await fill(page, 'XML input', xml); await fill(page, 'XSLT stylesheet', xslt); }
async function run(page: Page) {
  await page.getByTestId('run-transform').click();
  await expect(page.getByText('Transformation complete', { exact: true })).toBeVisible({ timeout: 20000 });
}
// Next.js has a separate, empty route-announcer alert outside the app's main element.
const alerts = (page: Page) => page.locator('main').getByRole('alert');
const output = (page: Page) => page.getByTestId('result-source').locator('.cm-content');
const identity = wrapXslt('<xsl:output method="xml" omit-xml-declaration="yes"/><xsl:template match="@*|node()"><xsl:copy><xsl:apply-templates select="@*|node()"/></xsl:copy></xsl:template>');
test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('starts empty and does not show errors or parameter overrides', async ({ page }) => {
  // CodeMirror renders its placeholder inside the textbox only when the document is empty.
  await expect(page.getByRole('textbox', { name: 'XML input', exact: true }).locator('.cm-placeholder')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'XSLT stylesheet', exact: true }).locator('.cm-placeholder')).toBeVisible();
  await expect(page.getByTestId('run-transform')).toBeDisabled(); await expect(alerts(page)).toHaveCount(0);
  await expect(page.locator('details.parameters')).not.toHaveAttribute('open');
  await expect(page.getByLabel('Remember on this device')).not.toBeChecked();
  await page.getByRole('tab', { name: 'Inspect & XPath' }).click();
  await expect(page.getByLabel('XPath expression')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Evaluate XPath' })).toBeDisabled();
  await expect(page.getByText('No matching nodes', { exact: true })).toHaveCount(0);
});
test('loads a complete example and transforms without native XSLTProcessor', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'XSLTProcessor', { value: undefined, configurable: true }); });
  await page.reload(); await page.getByRole('button', { name: 'Examples', exact: true }).click(); await page.getByTestId('example-orders').click(); await run(page);
  await expect(output(page)).toContainText('Alice'); await expect(output(page)).toContainText('Alex'); await expect(output(page)).not.toContainText('Sam');
});
test('default, empty-string override, then default again', async ({ page }) => {
  const example = examples.find(e => e.id === 'parameters')!;
  await load(page, example.xml, example.xslt); await run(page); await expect(output(page)).toContainText('Ready to ship');
  await page.locator('details.parameters summary').click(); await expect(page.getByLabel('Override title', { exact: true })).not.toBeChecked();
  await page.getByLabel('Override title', { exact: true }).check(); await expect(page.getByLabel('Value for title')).toHaveValue('');
  await run(page); await expect(output(page)).not.toContainText('Ready to ship'); await expect(output(page)).toContainText('heading');
  await page.getByLabel('Override title', { exact: true }).uncheck(); await run(page); await expect(output(page)).toContainText('Ready to ship');
});
test('typed boolean and numeric overrides preserve their types', async ({ page }) => {
  await load(page, '<root/>', wrapXslt('<xsl:output method="text"/><xsl:param name="flag" select="true()"/><xsl:param name="count" select="1"/><xsl:template match="/"><xsl:choose><xsl:when test="$flag">yes</xsl:when><xsl:otherwise>no</xsl:otherwise></xsl:choose><xsl:value-of select="$count + 2"/></xsl:template>'));
  await page.locator('details.parameters summary').click();
  await page.getByLabel('Override flag', { exact: true }).check(); await page.getByLabel('Type of flag').selectOption('boolean');
  await page.getByLabel('Override count', { exact: true }).check(); await page.getByLabel('Type of count').selectOption('number');
  await page.getByLabel('Value for count').fill('0'); await run(page); await expect(output(page)).toHaveText('no2');
});
test('shows stale output and keeps it visible after a malformed XML error', async ({ page }) => {
  await load(page, '<a><b>original</b></a>', identity); await run(page); await fill(page, 'XML input', '<a><b>');
  await expect(page.getByText('Inputs changed. Run again to update this result.')).toBeVisible(); await page.getByTestId('run-transform').click();
  await expect(alerts(page)).toContainText('Transformation needs attention'); await expect(alerts(page)).toContainText('previous successful result'); await expect(output(page)).toContainText('original');
});
test('formats simple nested XML without changing downloads or mixed content', async ({ page }) => {
  await load(page, '<a><b>1</b></a>', identity); await run(page); await page.getByRole('button', { name: 'Formatted', exact: true }).click();
  await expect(output(page)).toContainText('<b>1</b>'); await expect(alerts(page)).toHaveCount(0);
  await fill(page, 'XML input', '<a>Hello <b>world</b> !</a>'); await run(page);
  const downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download', exact: true }).click();
  const downloaded = await downloadEvent; const raw = await readFile((await downloaded.path())!, 'utf8'); expect(raw).toContain('Hello <b>world</b> !');
  await page.getByRole('button', { name: 'Formatted', exact: true }).click();
  const nextEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download', exact: true }).click(); expect(await readFile((await (await nextEvent).path())!, 'utf8')).toBe(raw);
});
test('text output contains no XML declaration and downloads as text', async ({ page }) => {
  const example = examples.find(e => e.id === 'text')!; await load(page, example.xml, example.xslt); await run(page);
  await expect(output(page)).toContainText('Order'); await expect(output(page)).not.toContainText('<?xml');
  const event = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download', exact: true }).click(); const file = await event;
  expect(file.suggestedFilename()).toBe('result.txt'); expect(await readFile((await file.path())!, 'utf8')).toBe('Order\tCustomer\n1042\tAlice\n1043\tSam\n1044\tAlex\n');
});
test('namespaced transformation produces expected customers', async ({ page }) => {
  const example = examples.find(e => e.id === 'namespaces')!; await load(page, example.xml, example.xslt); await run(page);
  await expect(output(page)).toContainText('Alice'); await expect(output(page)).toContainText('Sam');
});
test('namespaces are auto-detected and XPath distinguishes nodes and scalar results', async ({ page }) => {
  await page.getByRole('tab', { name: 'Inspect & XPath' }).click(); await fill(page, 'XML input', '<orders xmlns="urn:orders"><order id="1"/><order id="2"><name>Sam</name></order></orders>');
  await page.getByLabel('XPath expression').fill('//ns:order'); await page.getByRole('button', { name: 'Evaluate XPath' }).click(); await expect(page.getByText('2 matching nodes', { exact: true })).toBeVisible();
  await page.getByLabel('XPath expression').fill('count(//ns:order)'); await page.getByRole('button', { name: 'Evaluate XPath' }).click(); await expect(page.locator('.scalar-result pre')).toHaveText('2');
  await page.getByLabel('XPath expression').fill('boolean(//ns:missing)'); await page.getByRole('button', { name: 'Evaluate XPath' }).click(); await expect(page.locator('.scalar-result pre')).toHaveText('false');
  await page.getByLabel('XPath expression').fill('string(//ns:missing)'); await page.getByRole('button', { name: 'Evaluate XPath' }).click(); await expect(page.locator('.scalar-result pre')).toHaveText('(empty string)');
});
test('tree selection creates an exact XPath and can select all siblings', async ({ page }) => {
  await page.getByRole('tab', { name: 'Inspect & XPath' }).click(); await fill(page, 'XML input', '<orders><order id="1">A</order><order id="2">B</order></orders>');
  await page.getByRole('button', { name: 'Tree', exact: true }).click(); await page.locator('.tree-node').filter({ hasText: '<order>' }).first().click();
  await expect(page.getByLabel('XPath expression')).toHaveValue('/orders[1]/order[1]'); await expect(page.getByText('1 matching node', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'All matching siblings', exact: true }).click(); await expect(page.getByText('2 matching nodes', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View in source', exact: true }).first().click(); await expect(page.locator('.xml-match').first()).toBeVisible();
});
test('invalid XPath and duplicate namespace prefixes produce recoverable errors', async ({ page }) => {
  await page.getByRole('tab', { name: 'Inspect & XPath' }).click(); await fill(page, 'XML input', '<root><item/></root>');
  await page.getByLabel('XPath expression').fill('//*['); await page.getByRole('button', { name: 'Evaluate XPath' }).click(); await expect(alerts(page)).toContainText('Could not evaluate XPath');
  await page.getByLabel('XPath expression').fill('//missing'); await page.getByRole('button', { name: 'Evaluate XPath' }).click(); await expect(page.getByText('No matching nodes', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Namespaces/ }).click(); await page.getByRole('button', { name: '+ Add binding', exact: true }).click();
  await page.getByLabel('Namespace prefix 1', { exact: true }).fill('p'); await page.getByLabel('Namespace URI 1', { exact: true }).fill('urn:a');
  await page.getByRole('button', { name: '+ Add binding', exact: true }).click(); await page.getByLabel('Namespace prefix 2', { exact: true }).fill('p'); await page.getByLabel('Namespace URI 2', { exact: true }).fill('urn:b');
  await page.getByRole('button', { name: 'Evaluate XPath' }).click(); await expect(alerts(page)).toContainText('duplicated');
});
test('does not persist by default; opt-in restores inputs with auto-run off', async ({ page }) => {
  await load(page, '<secret>local only</secret>', identity); expect(await page.evaluate(() => localStorage.getItem('xml-studio.workspace.v1'))).toBeNull();
  await page.getByLabel('Auto-run', { exact: true }).check(); await page.getByLabel('Remember on this device').check(); await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('textbox', { name: 'XML input', exact: true })).toContainText('local only');
  await expect(page.getByLabel('Auto-run', { exact: true })).not.toBeChecked(); await page.getByLabel('Remember on this device').uncheck(); expect(await page.evaluate(() => localStorage.getItem('xml-studio.workspace.v1'))).toBeNull();
});
test('examples and new workspace require confirmation before clearing user work', async ({ page }) => {
  await load(page, '<private/>', identity); page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: 'New workspace', exact: true }).click(); await expect(page.getByRole('textbox', { name: 'XML input', exact: true })).toContainText('private');
  await page.getByRole('button', { name: 'Examples', exact: true }).click(); page.once('dialog', d => d.dismiss()); await page.getByTestId('example-orders').click(); await page.getByRole('button', { name: 'Close dialog' }).click(); await expect(page.getByRole('textbox', { name: 'XML input', exact: true })).toContainText('private');
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'New workspace', exact: true }).click(); await expect(page.getByTestId('run-transform')).toBeDisabled();
});
test('preview blocks scripts, remote resources and meta refresh while keeping raw output', async ({ page }) => {
  const external: string[] = []; page.on('request', request => { if (request.url().includes('preview-test.invalid')) external.push(request.url()); });
  await load(page, '<root/>', wrapXslt('<xsl:output method="html"/><xsl:template match="/"><html><head><meta http-equiv="refresh" content="0;url=https://preview-test.invalid/leak"/></head><body><h1>Safe heading</h1><script>parent.previewEscaped=true;</script><img src="https://preview-test.invalid/image"/><a href="https://preview-test.invalid/link">External link</a></body></html></xsl:template>'));
  await run(page); await expect(output(page)).toContainText('previewEscaped'); await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Restricted result preview"]'); await expect(frame.getByRole('heading', { name: 'Safe heading' })).toBeVisible();
  await expect(frame.locator('script')).toHaveCount(0); await expect(frame.locator('[src], [href], meta[http-equiv="refresh"]')).toHaveCount(0); expect(await page.evaluate(() => 'previewEscaped' in window)).toBe(false); expect(external).toEqual([]); await expect(page.locator('iframe')).toHaveAttribute('sandbox', '');
});
test('rejects DTDs and imports, and recovers with valid input', async ({ page }) => {
  await load(page, '<!DOCTYPE root [<!ENTITY x "private">]><root>&x;</root>', identity); await page.getByTestId('run-transform').click(); await expect(alerts(page)).toContainText('DTDs');
  await load(page, '<root/>', wrapXslt('<xsl:include href="https://preview-test.invalid/stylesheet"/>')); await page.getByTestId('run-transform').click(); await expect(alerts(page)).toContainText('External stylesheets');
  await load(page, '<root>recovered</root>', identity); await run(page); await expect(output(page)).toContainText('recovered');
});
test('external document() cannot access the network', async ({ page }) => {
  const external: string[] = []; page.on('request', r => { if (r.url().includes('preview-test.invalid')) external.push(r.url()); });
  await load(page, '<root/>', wrapXslt('<xsl:template match="/"><xsl:copy-of select="document(\'https://preview-test.invalid/leak\')"/></xsl:template>'));
  await page.getByTestId('run-transform').click(); await expect(alerts(page)).toBeVisible({ timeout: 15000 }); expect(external).toEqual([]);
});
test('file opening enforces size and UTF-8 limits without wiping existing input', async ({ page }) => {
  await page.getByLabel('Open XML file', { exact: true }).setInputFiles({ name: 'input.xml', mimeType: 'application/xml', buffer: Buffer.from('<root>from file</root>') }); await expect(page.getByRole('textbox', { name: 'XML input', exact: true })).toContainText('from file');
  await page.getByLabel('Open XML file', { exact: true }).setInputFiles({ name: 'large.xml', mimeType: 'application/xml', buffer: Buffer.alloc(1024 * 1024 + 1, 65) }); await expect(page.getByText('Use a UTF-8 file smaller than 1 MiB.', { exact: true })).toBeVisible(); await expect(page.getByRole('textbox', { name: 'XML input', exact: true })).toContainText('from file');
  await page.getByLabel('Open XML file', { exact: true }).setInputFiles({ name: 'invalid.xml', mimeType: 'application/xml', buffer: Buffer.from([0xc3, 0x28]) }); await expect(page.getByText('The file is not valid UTF-8. Convert its encoding before opening it.', { exact: true })).toBeVisible(); await expect(page.getByRole('textbox', { name: 'XML input', exact: true })).toContainText('from file');
});
test('mobile editor tabs and inspector fit the viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('tab', { name: /1\s*XML input/ })).toBeVisible(); await page.getByRole('tab', { name: /2\s*XSLT/ }).click(); await expect(page.getByRole('textbox', { name: 'XSLT stylesheet', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /3\s*Result/ }).click(); await expect(page.getByText('Your result will appear here.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: testInfo.outputPath('mobile-workspace.png'), fullPage: true });
  await page.getByRole('tab', { name: 'Inspect & XPath' }).click(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('desktop example is usable without console errors', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1512, height: 982 }); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.getByRole('button', { name: 'Examples', exact: true }).click(); await page.getByTestId('example-orders').click(); await run(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: testInfo.outputPath('desktop-workspace.png'), fullPage: true }); expect(errors).toEqual([]);
});
