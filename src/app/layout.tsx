import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'XML Studio — inspect XML & test XSLT',
  description: 'A private, browser-based workspace for XML, XPath and XSLT. Open your files, inspect their structure and test transformations. No uploads or account needed.',
  robots: { index: process.env.VERCEL_ENV !== 'preview', follow: process.env.VERCEL_ENV !== 'preview' },
  icons: { icon: '/xml.ico' }
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f6f8fa' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
