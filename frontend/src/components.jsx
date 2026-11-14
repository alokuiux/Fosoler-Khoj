import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from './context.jsx';

const PATHS = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  weather: 'M7 18a4 4 0 1 1 .9-7.9A5.5 5.5 0 0 1 18.5 11 3.5 3.5 0 0 1 18 18z',
  monitor: 'M3 12h4l3-8 4 16 3-8h4',
  leaf: 'M11 20A7 7 0 0 1 4 13c0-6 7-10 16-10 0 9-4 17-9 17z M4 21c3-6 6-9 11-12',
  chat: 'M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  sprout: 'M12 22V12 M12 12C12 7 8 5 4 5c0 4 3 7 8 7z M12 14c0-4 3-7 8-7 0 4-3 7-8 7z',
  cart: 'M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6 M9 21h.01 M17 21h.01',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  plus: 'M12 5v14 M5 12h14',
  drop: 'M12 2.7s7 7.2 7 12.3a7 7 0 0 1-14 0c0-5.1 7-12.3 7-12.3z',
  thermo: 'M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z',
  wind: 'M9.6 4.6A2 2 0 1 1 11 8H2 M12.6 19.4A2 2 0 1 0 14 16H2 M17.7 7.7A2.5 2.5 0 1 1 19.5 12H2',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  trash: 'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6',
  check: 'M20 6L9 17l-5-5',
  alert: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z M12 9v4 M12 17h.01',
  bulb: 'M9 18h6 M10 22h4 M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  chip: 'M4 4h16v16H4z M9 9h6v6H9z M9 1v3 M15 1v3 M9 20v3 M15 20v3 M20 9h3 M20 14h3 M1 9h3 M1 14h3',
  refresh: 'M23 4v6h-6 M1 20v-6h6 M3.5 9a9 9 0 0 1 15-3.4L23 10 M1 14l4.5 4.4A9 9 0 0 0 20.5 15',
  store: 'M3 9l1-5h16l1 5 M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0 M5 12v8h14v-8',
  pin: 'M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  spray: 'M8 3h6v4H8z M6 7h10v14H6z M14 5h4 M18 3v4',
  scissors: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M20 4L8.1 15.9 M14.5 14.5L20 20 M8.1 8.1L12 12',
  package: 'M16.5 9.4L7.5 4.2 M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z M3.3 7L12 12l8.7-5 M12 22V12',
  truck: 'M1 3h15v13H1z M16 8h4l3 3v5h-7V8z M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  x: 'M18 6L6 18 M6 6l12 12',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  cloudrain: 'M16 13v8 M8 13v8 M12 15v8 M20 16.6A4.5 4.5 0 0 0 18 8h-1.3A7 7 0 1 0 4 14.9',
};
export const Icon = ({ n, className = '' }) => (
  <svg className={'ico ' + className} viewBox="0 0 24 24" aria-hidden="true">{(PATHS[n] || '').split(' M').map((d, i) => <path key={i} d={(i ? 'M' : '') + d} />)}</svg>
);

export function useLoad(fn, deps = []) {
  const { notify } = useApp();
  const [data, setData] = useState(null); const [err, setErr] = useState('');
  const run = useCallback(() => { setErr(''); return fn().then(setData).catch((x) => { setErr(x.message); notify(x.message); }); }, deps); // eslint-disable-line
  useEffect(() => { run(); }, [run]);
  return [data, run, err, setData];
}

export const locale = (lang) => (lang === 'bn' ? 'bn-BD' : 'en-GB');
export const fmtDay = (d, lang, o = { weekday: 'short' }) => new Date(d + 'T00:00:00').toLocaleDateString(locale(lang), o);
export const fmtWhen = (d, lang) => new Date(d).toLocaleString(locale(lang), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const ago = (d, lang) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' });
  return m < 60 ? rtf.format(-m, 'minute') : m < 1440 ? rtf.format(-Math.round(m / 60), 'hour') : rtf.format(-Math.round(m / 1440), 'day');
};

export const PageHead = ({ title, sub, children }) => (
  <div className="page-head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{children && <div className="row" style={{ margin: 0 }}>{children}</div>}</div>
);

export const Stat = ({ n, label, icon = 'leaf', tone = '' }) => (
  <div className="stat"><div className={'ico-wrap ' + tone}><Icon n={icon} /></div><div><b>{n ?? '–'}</b><span>{label}</span></div></div>
);

export const Empty = ({ icon = 'sprout', text, children }) => (
  <div className="empty card"><Icon n={icon} /><p>{text}</p>{children}</div>
);
export const Skeleton = ({ n = 3 }) => <div className="cards">{Array.from({ length: n }, (_, i) => <div key={i} className="skeleton" />)}</div>;

/* Meter showing the current value inside a track with an "ideal" band highlighted */
export function Gauge({ label, icon, value, unit, min, max, ideal }) {
  const has = value != null && value !== '';
  const v = has ? Number(value) : null;
  const pct = (x) => Math.max(0, Math.min(100, ((x - min) / (max - min)) * 100));
  const out = has && ideal && (v < ideal[0] || v > ideal[1]);
  const shown = !has ? '–' : max >= 1000 ? Math.round(v).toLocaleString() : Number.isInteger(v) ? v : v.toFixed(1);
  return (
    <div className="gauge">
      <div className="top2"><span><Icon n={icon} />{label}</span><b>{shown}<small> {has ? unit : ''}</small></b></div>
      <div className="track">
        {ideal && <div className="ideal" style={{ left: pct(ideal[0]) + '%', width: pct(ideal[1]) - pct(ideal[0]) + '%' }} />}
        {has && <div className={'mk' + (out ? ' out' : '')} style={{ left: pct(v) + '%' }} />}
      </div>
      <div className="rng"><span>{min}</span><span>{max >= 1000 ? max / 1000 + 'k' : max}</span></div>
    </div>
  );
}

/* Minimal area chart */
export function Spark({ points, color = '#1f5a3d', unit = '' }) {
  const W = 600, H = 120, pad = 6;
  const vals = points.map((p) => p.v).filter((v) => v != null);
  if (vals.length < 2) return <div className="muted" style={{ padding: '1.4rem 0', textAlign: 'center' }}>—</div>;
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const xy = points.filter((p) => p.v != null).map((p, i, a) => [pad + (i / (a.length - 1)) * (W - pad * 2), H - pad - ((p.v - lo) / span) * (H - pad * 2)]);
  const line = xy.map((p) => p.join(',')).join(' ');
  const area = `${pad},${H} ${line} ${W - pad},${H}`;
  const last = xy[xy.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`min ${lo}${unit}, max ${hi}${unit}`}>
      <polygon points={area} fill={color} opacity=".12" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="4.5" fill={color} stroke="#fff" strokeWidth="2" />
    </svg>
  );
}
