import type { CSSProperties } from 'react';
const paths = {
  arrow: 'M5 12h14m-6-6 6 6-6 6', file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 0v6h6M8 13h8M8 17h5',
  copy: 'M9 9h12v12H9zM5 15H3V3h12v2', down: 'M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4', play: 'm8 5 11 7-11 7z', check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6', shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zm-4 9 3 3 5-6', search: 'M21 21l-5-5M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0',
  chevron: 'm9 5 7 7-7 7', code: 'm8 5-7 7 7 7m8-14 7 7-7 7M14 3l-4 18', help: 'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0', plus: 'M12 5v14M5 12h14', stop: 'M6 6h12v12H6z'
};
export function Icon({ name, size = 16, style }: { name: keyof typeof paths; size?: number; style?: CSSProperties }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={style}><path d={paths[name]} /></svg>;
}
