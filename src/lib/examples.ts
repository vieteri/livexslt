import { XSL_NS } from './model';
export const wrapXslt = (body: string, extra = '') => `<?xml version="1.0" encoding="UTF-8"?>\n<xsl:stylesheet version="1.0" xmlns:xsl="${XSL_NS}" ${extra}>\n${body}\n</xsl:stylesheet>`;
const orders = `<?xml version="1.0" encoding="UTF-8"?>
<orders>
  <order id="1042">
    <customer>Alice</customer>
    <total currency="EUR">49.90</total>
    <status>paid</status>
  </order>
  <order id="1043">
    <customer>Sam</customer>
    <total currency="EUR">125.00</total>
    <status>pending</status>
  </order>
  <order id="1044">
    <customer>Alex</customer>
    <total currency="EUR">18.50</total>
    <status>paid</status>
  </order>
</orders>`;
export const examples = [
  {
    id: 'orders', title: 'Map an order', tag: 'Start here', description: 'Rename fields and keep only paid orders. No parameters needed.',
    xml: orders,
    xslt: wrapXslt(`  <xsl:output method="xml" indent="yes" omit-xml-declaration="yes"/>
  <xsl:template match="/">
    <shipments>
      <xsl:for-each select="orders/order[status='paid']">
        <shipment>
          <reference><xsl:value-of select="@id"/></reference>
          <recipient><xsl:value-of select="customer"/></recipient>
          <amount><xsl:value-of select="total"/></amount>
        </shipment>
      </xsl:for-each>
    </shipments>
  </xsl:template>`)
  },
  {
    id: 'namespaces', title: 'Explore a namespaced message', tag: 'XPath', description: 'Inspect a SOAP-style message. Namespace prefixes are detected for you.',
    xml: `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <orders xmlns="urn:example:orders">
      <order id="1042"><customer>Alice</customer><total>49.90</total></order>
      <order id="1043"><customer>Sam</customer><total>125.00</total></order>
    </orders>
  </s:Body>
</s:Envelope>`,
    xslt: wrapXslt(`  <xsl:output method="xml" omit-xml-declaration="yes"/>
  <xsl:template match="/">
    <customers>
      <xsl:for-each select="s:Envelope/s:Body/o:orders/o:order">
        <name><xsl:value-of select="o:customer"/></name>
      </xsl:for-each>
    </customers>
  </xsl:template>`, 'xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:o="urn:example:orders" exclude-result-prefixes="s o"')
  },
  {
    id: 'parameters', title: 'Try an optional parameter', tag: 'XSLT', description: 'Use the stylesheet default, override it, or deliberately pass an empty string.',
    xml: orders,
    xslt: wrapXslt(`  <xsl:output method="xml" indent="yes" omit-xml-declaration="yes"/>
  <xsl:param name="title">Ready to ship</xsl:param>
  <xsl:template match="/">
    <report>
      <heading><xsl:value-of select="$title"/></heading>
      <count><xsl:value-of select="count(orders/order[status='paid'])"/></count>
    </report>
  </xsl:template>`)
  },
  {
    id: 'text', title: 'Export plain text', tag: 'Text output', description: 'Produce a simple tab-separated report without an XML declaration.',
    xml: orders,
    xslt: wrapXslt(`  <xsl:output method="text" encoding="UTF-8"/>
  <xsl:template match="/">
    <xsl:text>Order&#9;Customer&#10;</xsl:text>
    <xsl:for-each select="orders/order">
      <xsl:value-of select="@id"/><xsl:text>&#9;</xsl:text>
      <xsl:value-of select="customer"/><xsl:text>&#10;</xsl:text>
    </xsl:for-each>
  </xsl:template>`)
  },
  {
    id: 'html', title: 'Preview a CD collection', tag: 'HTML output', description: 'A small HTML table, rendered in a restricted, network-free preview.',
    xml: `<catalog>
  <cd><title>Empire Burlesque</title><artist>Bob Dylan</artist></cd>
  <cd><title>Hide your heart</title><artist>Bonnie Tyler</artist></cd>
</catalog>`,
    xslt: wrapXslt(`  <xsl:output method="html"/>
  <xsl:param name="title">My CD Collection</xsl:param>
  <xsl:param name="headerColor">#0f766e</xsl:param>
  <xsl:template match="/">
    <html><body>
      <h1><xsl:value-of select="$title"/></h1>
      <table>
        <tr style="color:{$headerColor}"><th>Title</th><th>Artist</th></tr>
        <xsl:for-each select="catalog/cd">
          <tr><td><xsl:value-of select="title"/></td><td><xsl:value-of select="artist"/></td></tr>
        </xsl:for-each>
      </table>
    </body></html>
  </xsl:template>`)
  }
];
