import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js'; import { useApp } from '../context.jsx';
import { Icon, PageHead, useLoad, Skeleton, Empty, Gauge, Spark, ago } from '../components.jsx';

// key, icon, gauge min, gauge max, ideal band, unit
const G = [
  ['soil_moisture', 'drop', 0, 100, [40, 70], '%'], ['soil_temp', 'thermo', 10, 45, [18, 32], '°C'], ['soil_ph', 'leaf', 4, 9, [6, 7.5], 'pH'],
  ['air_temp', 'sun', 5, 45, [18, 33], '°C'], ['humidity', 'weather', 0, 100, [50, 80], '%'], ['light_lux', 'sun', 0, 100000, [20000, 70000], 'lx'],
];
const PERIODS = [['24h', '24h'], ['3d', '3d'], ['7d', '7d']];
const LEVEL_ICON = { danger: 'alert', warn: 'alert', good: 'check', info: 'bulb' };

const fmt = (k, v) => (v == null ? '–' : k === 'light_lux' ? Math.round(v).toLocaleString() : v);
const unitOf = (k) => G.find((g) => g[0] === k)[5];

/* Report for ONE period: its own stats, chart, analysis and recommendations (fetched from /report?period=) */
function PeriodReport({ id, tick }) {
  const { t, lang } = useApp();
  const [period, setPeriod] = useState('24h'); const [metric, setMetric] = useState('soil_moisture');
  const [rep, setRep] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(true);
  useEffect(() => {
    let live = true; setBusy(true); setErr('');
    api(`/iot/devices/${id}/report?period=${period}`).then((r) => live && setRep(r)).catch((x) => live && setErr(x.message)).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [id, period, tick]);

  const trend = (d) => (d == null ? '' : d > 0.5 ? '↑ +' + d : d < -0.5 ? '↓ ' + d : '→ 0');
  return <div className="report">
    <div className="tabs" role="tablist" aria-label={t('periodReport')}>
      {PERIODS.map(([k, label]) => <button key={k} role="tab" aria-selected={period === k} className={'tab' + (period === k ? ' on' : '')} onClick={() => setPeriod(k)}>{label}</button>)}
    </div>
    {err && <p className="err" role="alert">{err}</p>}
    {busy && !rep ? <div className="skeleton" style={{ minHeight: 160 }} /> : rep && <div style={{ opacity: busy ? 0.55 : 1, transition: 'opacity .15s' }}>
      <div className={'rep-sum lv-' + (rep.status === 'danger' ? 'danger' : rep.status === 'warn' ? 'warn' : rep.status === 'good' ? 'good' : 'info')}>
        <b>{t('analysis')}</b> <span className={'chip ' + (rep.status === 'danger' ? 'danger' : rep.status === 'warn' ? 'warn' : '')}>{t('st_' + rep.status)}</span>
        <p>{rep.summary[lang]}</p></div>

      {rep.n > 0 && <>
        <div className="mstats">{G.map(([k, ic]) => { const m = rep.metrics[k]; return <div className="mstat" key={k}>
          <span className="lab"><Icon n={ic} />{t('m_' + k)}</span>
          <b>{m ? fmt(k, m.avg) : '–'}<small> {m ? unitOf(k) : ''}</small></b>
          {m ? <small className="muted">{t('range')}: {fmt(k, m.min)}–{fmt(k, m.max)} · {trend(m.delta)}</small> : <small className="muted">{t('noData')}</small>}
        </div>; })}</div>

        <div className="tabs" style={{ marginTop: '.8rem' }}>{G.map((g) => <button key={g[0]} className={'tab' + (metric === g[0] ? ' on' : '')} onClick={() => setMetric(g[0])}>{t('m_' + g[0])}</button>)}</div>
        <Spark points={rep.series.map((r) => ({ v: r[metric] == null ? null : Number(r[metric]) }))} unit={unitOf(metric)} />
        <div className="rng muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem' }}>
          <span>{new Date(rep.series[0]?.t || Date.now()).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          <span>{rep.n} {t('readings')}</span>
          <span>{new Date(rep.series.at(-1)?.t || Date.now()).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
      </>}

      {rep.findings.length > 0 && <div className="alerts" style={{ padding: '.8rem 0 0' }}>{rep.findings.map((f, i) =>
        <div key={i} className={'alert-line ' + f.level + (f.level === 'good' || f.level === 'info' ? ' ok' : '')}><Icon n={LEVEL_ICON[f.level]} />{f[lang]}</div>)}</div>}

      <h3 style={{ margin: '1rem 0 .4rem' }}><Icon n="bulb" /> {t('recommendations')}</h3>
      <ul className="recs">{rep.recommendations.map((r, i) => <li key={i}>{r[lang]}</li>)}</ul>
    </div>}
  </div>;
}

function Detail({ d, onChange, tick }) {
  const { t, lang, notify } = useApp();
  const [show, setShow] = useState(false);
  const snippet = `curl -X POST ${window.location.origin}/api/iot/ingest \\\n  -H "Content-Type: application/json" \\\n  -H "x-device-key: ${d.device_key}" \\\n  -d '{"soil_moisture":46.5,"soil_temp":27.2,"soil_ph":6.6,"air_temp":31,"humidity":72,"light_lux":42000}'`;
  const sim = async () => { try { await api(`/iot/devices/${d.id}/simulate`, { method: 'POST' }); onChange(); } catch (x) { notify(x.message); } };
  const del = async () => { if (confirm(t('confirmDelDevice'))) { try { await api('/iot/devices/' + d.id, { method: 'DELETE' }); onChange(); } catch (x) { notify(x.message); } } };
  return <article className="card dev">
    <div className="dev-head">
      <div><h3><span className={'dot' + (d.online ? ' on' : '')} />{d.name} <span className={'chip ' + (d.online ? '' : 'warn')}>{t(d.online ? 'online' : 'offline')}</span></h3>
        <small className="muted">{d.field_name || '—'} · {d.last_seen ? t('lastSeen') + ' ' + ago(d.last_seen, lang) : t('noData')}</small></div>
      <div className="row" style={{ margin: 0 }}>
        <button className="btn sm gold" onClick={sim}><Icon n="plus" /> {t('simulate')}</button>
        <button className="btn sm alt2" onClick={() => setShow(!show)}><Icon n="chip" /> {t('connect')}</button>
        <button className="btn sm danger" onClick={del} aria-label={t('delete')}><Icon n="trash" /></button></div></div>
    {show && <div className="setup"><p className="muted">{t('connectHelp')}</p><pre className="code">{snippet}</pre></div>}
    <div className="gauges-head"><b>{t('liveNow')}</b></div>
    <div className="gauges">{G.map(([k, ic, mn, mx, ideal, u]) => <Gauge key={k} label={t('m_' + k)} icon={ic} value={d.latest?.[k]} unit={u} min={mn} max={mx} ideal={ideal} />)}</div>
    {d.alerts.length > 0 && <div className="alerts">{d.alerts.map((a, i) => <div key={i} className={'alert-line ' + a.level}><Icon n="alert" />{a[lang]}</div>)}</div>}
    <div className="chart"><PeriodReport id={d.id} tick={tick} /></div>
  </article>;
}

export default function Monitor() {
  const { t, notify } = useApp();
  const [list, reload] = useLoad(() => api('/iot/devices'), []);
  const [tick, setTick] = useState(0); const [spin, setSpin] = useState(false);
  const [f, setF] = useState({ name: '', field_name: '' }); const [adding, setAdding] = useState(false);
  // Refresh = reload the device list (live values) AND every period report
  const refresh = useCallback(async () => { setSpin(true); setTick((x) => x + 1); await reload(); setSpin(false); }, [reload]);
  useEffect(() => { const id = setInterval(refresh, 30000); return () => clearInterval(id); }, [refresh]);
  const add = async (e) => { e.preventDefault(); try { await api('/iot/devices', { method: 'POST', body: f }); setF({ name: '', field_name: '' }); setAdding(false); notify('✓ ' + t('saved')); refresh(); } catch (x) { notify(x.message); } };
  return <>
    <PageHead title={t('monitor')} sub={t('monitorSub')}>
      <button className="ghost" onClick={refresh} disabled={spin}><Icon n="refresh" /> {spin ? t('loading') : t('refresh')}</button>
      <button className="btn" onClick={() => setAdding(!adding)}><Icon n="plus" /> {t('addDevice')}</button></PageHead>
    {adding && <form className="card grid" onSubmit={add}>
      <label className="field"><span>{t('deviceName')}</span><input required maxLength="120" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Soil probe 1" /></label>
      <label className="field"><span>{t('fieldName')}</span><input maxLength="160" value={f.field_name} onChange={(e) => setF({ ...f, field_name: e.target.value })} placeholder="North paddy plot" /></label>
      <div className="row full"><button className="btn">{t('save')}</button><button type="button" className="btn alt2" onClick={() => setAdding(false)}>{t('cancel')}</button></div></form>}
    {!list ? <Skeleton n={2} /> : !list.length
      ? <Empty icon="chip" text={t('noDevices')}><button className="btn" onClick={() => setAdding(true)}><Icon n="plus" /> {t('addDevice')}</button></Empty>
      : list.map((d) => <Detail key={d.id} d={d} onChange={refresh} tick={tick} />)}
  </>;
}
