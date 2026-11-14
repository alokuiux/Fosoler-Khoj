import React, { useState } from 'react';
import { api } from '../api.js'; import { useApp } from '../context.jsx';
import { Icon, PageHead, useLoad, Skeleton, fmtDay } from '../components.jsx';

const ADV_ICON = { irrigation: 'drop', harvest: 'scissors', spray: 'spray', alert: 'alert', disease: 'leaf', crop: 'sprout' };
const skyOf = (icon) => icon === '☀️' || icon === '🌤️' ? 'sky-clear' : icon === '⛈️' ? 'sky-storm' : icon === '🌧️' || icon === '🌦️' ? 'sky-rain' : 'sky-cloud';

const Horizon = () => <svg className="horizon" viewBox="0 0 800 70" preserveAspectRatio="none" aria-hidden="true">
  <path d="M0 40 Q 200 15 400 35 T 800 28 V70 H0z" fill="#2f7a4d" opacity=".55" />
  <path d="M0 52 Q 220 30 430 48 T 800 42 V70 H0z" fill="#1f5a3d" />
  {Array.from({ length: 14 }, (_, i) => <path key={i} d={`M${i * 60 - 10} 70 L${i * 60 + 30} 54`} stroke="#4c9a5f" strokeWidth="2" opacity=".5" />)}
</svg>;

export default function Weather() {
  const { t, lang, user } = useApp();
  const [district, setDistrict] = useState(user.district || '');
  const [sel, setSel] = useState(0);
  const [districts] = useLoad(() => api('/weather/districts'), []);
  const [w, reload, err] = useLoad(() => api('/weather' + (district ? '?district=' + encodeURIComponent(district) : '')), [district]);
  const c = w?.current;
  const order = ['alert', 'irrigation', 'harvest', 'spray', 'disease', 'crop'];
  const advice = w ? [...w.advice].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type)) : [];

  return <>
    <PageHead title={t('weather')} sub={t('weatherSub')}><button className="ghost" onClick={reload}><Icon n="refresh" /> {t('refresh')}</button></PageHead>
    {err && <p className="err">{err}</p>}
    {!w ? <Skeleton n={2} /> : <>
      {w.source === 'sample' && <div className="notice"><Icon n="alert" /><span>{t('sampleWeather')}</span></div>}
      <section className={'sky ' + skyOf(c.icon)}>
        <div className="where"><Icon n="pin" /><b>{w.location}</b>
          <select aria-label={t('district')} value={w.location} onChange={e => setDistrict(e.target.value)}>
            {(districts || [w.location]).map(d => <option key={d}>{d}</option>)}</select></div>
        <div className="now"><span className="em" aria-hidden>{c.icon}</span><span className="temp">{Math.round(c.temp)}°</span>
          <div><b style={{ fontSize: '1.3rem' }}>{c[lang]}</b><br />{t('feelsHigh')} {Math.round(w.daily[0].tmax)}° · {t('feelsLow')} {Math.round(w.daily[0].tmin)}°</div></div>
        <div className="facts"><div><Icon n="drop" /> {t('humidity')} {Math.round(c.humidity)}%</div><div><Icon n="wind" /> {t('wind')} {Math.round(c.wind)} km/h</div>
          <div><Icon n="cloudrain" /> {t('todayRain')} {w.daily[0].rain.toFixed(1)} mm</div></div>
        <Horizon />
      </section>

      <h2 className="sec" style={{ marginTop: '1.2rem' }}>{t('forecast7')}</h2>
      <div className="days">{w.daily.map((d, i) => <button key={d.date} type="button" aria-pressed={sel === i} onClick={() => setSel(i)} className={'day' + (i === 0 ? ' today' : '') + (sel === i ? ' sel' : '')}>
        <b>{i === 0 ? t('today') : fmtDay(d.date, lang)}</b><span className="em" aria-hidden>{d.icon}</span>
        <span className="hi">{Math.round(d.tmax)}°</span> <span className="lo">{Math.round(d.tmin)}°</span>
        <div className="rain" title={d.prob + '%'}><i style={{ width: Math.min(100, d.prob) + '%' }} /></div>
        <small>{d.rain.toFixed(0)} mm · {d.prob}%</small></button>)}</div>
      {w.daily[sel] && (() => { const d = w.daily[sel]; return <div className="card" aria-live="polite">
        <h3>{fmtDay(d.date, lang, { weekday: 'long', day: 'numeric', month: 'long' })} — {d[lang]} <span aria-hidden>{d.icon}</span></h3>
        <div className="stats" style={{ marginTop: '.7rem', marginBottom: 0 }}>
          <div className="stat"><div className="ico-wrap gold"><Icon n="thermo" /></div><div><b>{Math.round(d.tmax)}° / {Math.round(d.tmin)}°</b><span>{t('feelsHigh')} / {t('feelsLow')}</span></div></div>
          <div className="stat"><div className="ico-wrap sky"><Icon n="cloudrain" /></div><div><b>{d.rain.toFixed(1)} mm</b><span>{t('rainChance')}: {d.prob}%</span></div></div>
          <div className="stat"><div className="ico-wrap"><Icon n="wind" /></div><div><b>{Math.round(d.wind)} km/h</b><span>{t('maxWind')}</span></div></div>
          <div className="stat"><div className="ico-wrap"><Icon n="drop" /></div><div><b>{d.et0 != null ? d.et0.toFixed(1) + ' mm' : '–'}</b><span>{t('evaporation')}</span></div></div></div></div>; })()}

      <h2 className="sec">{t('farmDecisions')}</h2>
      <div className="advice">{advice.map((a, i) => <article key={i} className={'adv card lv-' + a.level}>
        <span className="ico-wrap"><Icon n={ADV_ICON[a.type] || 'bulb'} /></span>
        <div><h3>{a.title[lang]}</h3><p>{a.text[lang]}</p></div></article>)}</div>
      <p className="muted">{t('weatherSource')}</p>
    </>}
  </>;
}
