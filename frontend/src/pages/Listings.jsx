import React, { useEffect, useState, useCallback } from 'react'; import { api } from '../api.js'; import { useApp } from '../context.jsx';
const blank = { crop_name: '', quantity: '', unit: 'kg', price: '', location: '', selling_info: '', status: 'available' };

function CropForm({ initial, onDone, onCancel }) {
  const { t, notify, user } = useApp();
  const [f, setF] = useState(initial || { ...blank, location: [user.village, user.district].filter(Boolean).join(', ') }); const [err, setErr] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => { e.preventDefault(); setErr('');
    try { await api(initial ? '/listings/' + initial.id : '/listings', { method: initial ? 'PUT' : 'POST', body: f }); notify('✓ ' + t('saved')); onDone(); }
    catch (x) { setErr(x.message); } };
  return <form className="card grid" onSubmit={submit}>
    <h2 className="full">{initial ? t('edit') : t('addCrop')}</h2>
    <label className="field full"><span>{t('cropName')}</span><input required value={f.crop_name} onChange={set('crop_name')} placeholder="Aman Rice / ধান"/></label>
    <label className="field"><span>{t('quantity')}</span><input type="number" min="0" step="any" inputMode="decimal" required value={f.quantity} onChange={set('quantity')}/></label>
    <label className="field"><span>{t('unit')}</span><select value={f.unit} onChange={set('unit')}>{['kg', 'maund', 'ton', 'piece', 'dozen'].map(u => <option key={u}>{u}</option>)}</select></label>
    <label className="field"><span>{t('price')}</span><input type="number" min="0" step="any" inputMode="decimal" required value={f.price} onChange={set('price')}/></label>
    <label className="field"><span>{t('location')}</span><input value={f.location} onChange={set('location')}/></label>
    <label className="field full"><span>{t('sellingInfo')}</span><textarea rows="3" maxLength="500" value={f.selling_info} onChange={set('selling_info')}/></label>
    {err && <p className="err full" role="alert">{err}</p>}
    <div className="row full"><button className="btn">{t('save')}</button><button type="button" className="btn alt2" onClick={onCancel}>{t('cancel')}</button></div></form>;
}

export default function Listings({ mode }) {
  const { t, user, notify } = useApp(); const [items, setItems] = useState(null); const [q, setQ] = useState(''); const [form, setForm] = useState(null);
  const load = useCallback(() => api(`/listings?q=${encodeURIComponent(q)}${mode === 'mine' ? '&mine=1' : ''}`).then(setItems).catch(x => notify(x.message)), [q, mode, notify]);
  useEffect(() => { const id = setTimeout(load, 200); return () => clearTimeout(id); }, [load]);
  const done = () => { setForm(null); load(); };
  const del = async l => { if (confirm(t('confirmDel'))) { await api('/listings/' + l.id, { method: 'DELETE' }); load(); } };
  const toggleSold = async l => { await api('/listings/' + l.id, { method: 'PUT', body: { ...l, status: l.status === 'sold' ? 'available' : 'sold' } }); load(); };
  const adminSet = async (l, status) => { await api('/admin/listings/' + l.id, { method: 'PATCH', body: { status } }); load(); };
  const title = mode === 'mine' ? t('myListings') : mode === 'admin' ? t('listings') : t('market');
  if (form !== null) return <CropForm initial={form.id ? form : null} onDone={done} onCancel={() => setForm(null)}/>;
  return <>
    <div className="bar"><h1>{title}</h1>{mode === 'mine' && <button className="btn" onClick={() => setForm({})}>＋ {t('addCrop')}</button>}</div>
    <input className="search" type="search" placeholder={'🔍 ' + t('search')} value={q} onChange={e => setQ(e.target.value)}/>
    {!items ? <p>{t('loading')}</p> : !items.length ? <div className="empty card"><span aria-hidden>🌱</span><p>{mode === 'mine' ? t('emptyMine') : t('emptyAll')}</p>
      {mode === 'mine' && <button className="btn" onClick={() => setForm({})}>＋ {t('addCrop')}</button>}</div> :
      <div className="cards">{items.map(l => <article key={l.id} className={'crop card ' + l.status}>
        <header><h3>{l.crop_name}</h3><span className={'chip s-' + l.status}>{t(l.status)}</span></header>
        <p className="price">৳{l.price} <small>{t('per')} {l.unit}</small></p>
        <p>📦 {l.quantity} {l.unit}</p>{l.location && <p>📍 {l.location}</p>}
        {l.selling_info && <p className="muted">{l.selling_info}</p>}
        <p className="muted">{t('by')} {l.farmer_name}</p>
        <div className="row">
          {mode === 'browse' && user.role === 'buyer' && <a className="btn" href={'tel:' + l.farmer_phone}>📞 {t('call')}</a>}
          {mode === 'mine' && <><button className="btn sm" onClick={() => setForm(l)}>{t('edit')}</button>
            <button className="btn sm alt2" onClick={() => toggleSold(l)}>{l.status === 'sold' ? t('markAvail') : t('markSold')}</button>
            <button className="btn sm danger" onClick={() => del(l)}>{t('delete')}</button></>}
          {mode === 'admin' && <><button className="btn sm alt2" onClick={() => adminSet(l, l.status === 'hidden' ? 'available' : 'hidden')}>{l.status === 'hidden' ? t('show') : t('hide')}</button>
            <button className="btn sm danger" onClick={() => del(l)}>{t('delete')}</button></>}
        </div></article>)}</div>}</>;
}
