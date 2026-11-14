import React, { useState } from 'react'; import { useLocation } from 'react-router-dom';
import { api } from '../api.js'; import { useApp } from '../context.jsx';
import { Icon, PageHead, useLoad, Empty, Skeleton, ago } from '../components.jsx';

const CATS = ['crop', 'irrigation', 'fertilizer', 'pest', 'disease', 'harvest', 'market', 'farm'];
const CatSelect = ({ value, onChange }) => { const { t } = useApp(); return <select value={value} onChange={e => onChange(e.target.value)}>{CATS.map(c => <option key={c} value={c}>{t('cat_' + c)}</option>)}</select>; };

function TipList({ canDelete }) {
  const { t, user, lang, notify } = useApp(); const [q, setQ] = useState('');
  const [tips, reload] = useLoad(() => api('/advisory/tips?q=' + encodeURIComponent(q)), [q]);
  const del = async id => { if (confirm(t('confirmDel'))) { await api('/advisory/tips/' + id, { method: 'DELETE' }).catch(x => notify(x.message)); reload(); } };
  return <>
    <input className="search" type="search" placeholder={'🔍 ' + t('searchTips')} value={q} onChange={e => setQ(e.target.value)} />
    {!tips ? <Skeleton n={2} /> : !tips.length ? <Empty icon="bulb" text={t('noTips')} /> :
      <div className="cards">{tips.map(x => <article key={x.id} className="card tip"><div className="bar"><h3>{x.title}</h3><span className="chip">{t('cat_' + x.category)}</span></div>
        {x.crop && <small className="muted">🌾 {x.crop}</small>}<p className="body">{x.body}</p>
        <div className="bar"><small className="muted">{t('byExpert')} {x.expert_name} · {ago(x.created_at, lang)}</small>
          {canDelete && x.expert_id === user.id && <button className="ghost" onClick={() => del(x.id)} aria-label={t('delete')}><Icon n="trash" /></button>}</div></article>)}</div>}
  </>;
}

function Question({ q, onDel }) {
  const { t, lang } = useApp();
  return <article className={'card qa' + (q.status === 'answered' ? ' answered' : '')}>
    <header><div><h3>{q.crop} <span className="chip">{t('cat_' + q.category)}</span></h3><small className="muted">{ago(q.created_at, lang)}</small></div>
      <div className="row" style={{ margin: 0 }}><span className={'chip ' + (q.status === 'open' ? 'warn' : '')}>{t(q.status === 'open' ? 'waiting' : 'answered')}</span>
        {onDel && <button className="ghost" onClick={() => onDel(q.id)} aria-label={t('delete')}><Icon n="trash" /></button>}</div></header>
    <p className="body">{q.question}</p>
    {q.answer && <div className="ans"><small>{t('answeredBy')} {q.expert_name}</small><p className="body" style={{ margin: 0 }}>{q.answer}</p></div>}
  </article>;
}

function Farmer() {
  const { t, notify } = useApp(); const pre = useLocation().state || {};
  const [tab, setTab] = useState('ask');
  const [f, setF] = useState({ crop: pre.crop || '', category: pre.category || 'crop', question: pre.question || '' }); const [err, setErr] = useState('');
  const [list, reload] = useLoad(() => api('/advisory/requests'), []);
  const submit = async e => { e.preventDefault(); setErr(''); try { await api('/advisory/requests', { method: 'POST', body: f }); setF({ crop: '', category: 'crop', question: '' }); notify('✓ ' + t('sent')); reload(); } catch (x) { setErr(x.message); } };
  const del = async id => { if (confirm(t('confirmDel'))) { await api('/advisory/requests/' + id, { method: 'DELETE' }).catch(x => notify(x.message)); reload(); } };
  return <>
    <div className="tabs"><button className={'tab' + (tab === 'ask' ? ' on' : '')} onClick={() => setTab('ask')}><Icon n="chat" /> {t('askExpert')}</button>
      <button className={'tab' + (tab === 'tips' ? ' on' : '')} onClick={() => setTab('tips')}><Icon n="bulb" /> {t('tipsGuides')}</button></div>
    {tab === 'ask' ? <>
      <form className="card grid" onSubmit={submit}>
        <label className="field"><span>{t('cropName')}</span><input required value={f.crop} onChange={e => setF({ ...f, crop: e.target.value })} /></label>
        <label className="field"><span>{t('topic')}</span><CatSelect value={f.category} onChange={category => setF({ ...f, category })} /></label>
        <label className="field full"><span>{t('yourQuestion')}</span><textarea required rows="4" minLength="10" maxLength="2000" value={f.question} onChange={e => setF({ ...f, question: e.target.value })} placeholder={t('questionHint')} /></label>
        {err && <p className="err full" role="alert">{err}</p>}
        <button className="btn full">{t('sendQuestion')}</button></form>
      <h2 className="sec">{t('myQuestions')}</h2>
      {!list ? <Skeleton n={2} /> : !list.length ? <Empty icon="chat" text={t('noQuestions')} /> : list.map(q => <Question key={q.id} q={q} onDel={q.status === 'open' ? del : null} />)}
    </> : <TipList />}</>;
}

function Answer({ q, onDone }) {
  const { t, notify } = useApp(); const [a, setA] = useState(q.answer || ''); const [busy, setBusy] = useState(false);
  const send = async e => { e.preventDefault(); setBusy(true); try { await api(`/advisory/requests/${q.id}/answer`, { method: 'PUT', body: { answer: a } }); notify('✓ ' + t('sent')); onDone(); } catch (x) { notify(x.message); } finally { setBusy(false); } };
  return <article className="card qa"><header><div><h3>{q.crop} <span className="chip">{t('cat_' + q.category)}</span></h3><small className="muted">{q.farmer_name}{q.farmer_district ? ' · ' + q.farmer_district : ''}</small></div></header>
    <p className="body">{q.question}</p>
    <form onSubmit={send}><label className="field"><span>{t('yourAnswer')}</span><textarea required rows="4" minLength="10" maxLength="4000" value={a} onChange={e => setA(e.target.value)} /></label>
      <button className="btn sm" disabled={busy}><Icon n="check" /> {t('sendAnswer')}</button></form></article>;
}

function Expert() {
  const { t, notify } = useApp(); const [tab, setTab] = useState('open');
  const [open, reOpen] = useLoad(() => api('/advisory/requests?scope=open'), []);
  const [mine, reMine] = useLoad(() => api('/advisory/requests?scope=mine'), []);
  const [f, setF] = useState({ title: '', crop: '', category: 'crop', body: '' }); const [err, setErr] = useState(''); const [tipKey, setTipKey] = useState(0);
  const done = () => { reOpen(); reMine(); };
  const post = async e => { e.preventDefault(); setErr(''); try { await api('/advisory/tips', { method: 'POST', body: f }); setF({ title: '', crop: '', category: 'crop', body: '' }); setTipKey(k => k + 1); notify('✓ ' + t('published')); } catch (x) { setErr(x.message); } };
  const tabs = [['open', 'chat', t('openQuestions') + (open ? ` (${open.length})` : '')], ['mine', 'check', t('myAnswers')], ['tip', 'bulb', t('shareTip')]];
  return <>
    <div className="tabs">{tabs.map(([k, ic, label]) => <button key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}><Icon n={ic} /> {label}</button>)}</div>
    {tab === 'open' && (!open ? <Skeleton n={2} /> : !open.length ? <Empty icon="check" text={t('noOpen')} /> : open.map(q => <Answer key={q.id} q={q} onDone={done} />))}
    {tab === 'mine' && (!mine ? <Skeleton n={2} /> : !mine.length ? <Empty icon="chat" text={t('noAnswers')} /> : mine.map(q => <Question key={q.id} q={q} />))}
    {tab === 'tip' && <>
      <form className="card grid" onSubmit={post}>
        <label className="field full"><span>{t('tipTitle')}</span><input required maxLength="200" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></label>
        <label className="field"><span>{t('cropName')}</span><input value={f.crop} onChange={e => setF({ ...f, crop: e.target.value })} /></label>
        <label className="field"><span>{t('topic')}</span><CatSelect value={f.category} onChange={category => setF({ ...f, category })} /></label>
        <label className="field full"><span>{t('tipBody')}</span><textarea required rows="5" minLength="20" maxLength="3000" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} /></label>
        {err && <p className="err full" role="alert">{err}</p>}
        <button className="btn full">{t('publish')}</button></form>
      <TipList key={tipKey} canDelete /></>}</>;
}

export default function Advisory() {
  const { t, user } = useApp();
  return <><PageHead title={t('advisory')} sub={user.role === 'farmer' ? t('advisorySub') : t('expertAdvSub')} />{user.role === 'farmer' ? <Farmer /> : <Expert />}</>;
}
