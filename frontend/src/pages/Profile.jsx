import React, { useState } from 'react'; import { api } from '../api.js'; import { useApp } from '../context.jsx';
const DIVS = ['Dhaka', 'Chattogram', 'Rajshahi', 'Khulna', 'Barishal', 'Sylhet', 'Rangpur', 'Mymensingh'];
export default function Profile() {
  const { user, setUser, t, notify, changeLang } = useApp();
  const [f, setF] = useState({ name: user.name, phone: user.phone || '', division: user.division || '', district: user.district || '', village: user.village || '', bio: user.bio || '', language: user.language || 'en' });
  const [pw, setPw] = useState({ current: '', next: '' }); const [err, setErr] = useState(''); const [perr, setPerr] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const save = async e => { e.preventDefault(); setErr('');
    try { const u = await api('/profile', { method: 'PUT', body: f }); setUser(u); changeLang(u.language); notify('✓ ' + t('saved')); } catch (x) { setErr(x.message); } };
  const savePw = async e => { e.preventDefault(); setPerr('');
    try { await api('/profile/password', { method: 'PUT', body: pw }); setPw({ current: '', next: '' }); notify('✓ ' + t('saved')); } catch (x) { setPerr(x.message); } };
  return <>
    <h1>{t('profile')}</h1>
    <div className="who card"><div className="avatar">{user.name[0]}</div><div><b>{user.name}</b><br/><small>{user.email}</small><br/><span className="chip">{t(user.role)}</span></div></div>
    <form className="card grid" onSubmit={save}>
      <label className="field"><span>{t('name')}</span><input required value={f.name} onChange={set('name')}/></label>
      <label className="field"><span>{t('phone')}</span><input type="tel" required value={f.phone} onChange={set('phone')}/></label>
      <label className="field"><span>{t('division')}</span><select value={f.division} onChange={set('division')}><option value="">—</option>{DIVS.map(d => <option key={d}>{d}</option>)}</select></label>
      <label className="field"><span>{t('district')}</span><input value={f.district} onChange={set('district')}/></label>
      <label className="field"><span>{t('village')}</span><input value={f.village} onChange={set('village')}/></label>
      <label className="field"><span>{t('language')}</span><select value={f.language} onChange={set('language')}><option value="en">English</option><option value="bn">বাংলা</option></select></label>
      <label className="field full"><span>{t('bio')}</span><textarea rows="3" maxLength="500" value={f.bio} onChange={set('bio')}/></label>
      {err && <p className="err full" role="alert">{err}</p>}
      <button className="btn full">{t('save')}</button></form>
    <form className="card grid" onSubmit={savePw}><h2 className="full">{t('changePw')}</h2>
      <label className="field"><span>{t('currentPw')}</span><input type="password" required value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })}/></label>
      <label className="field"><span>{t('newPw')}</span><input type="password" required value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })}/><small>{t('pwHint')}</small></label>
      {perr && <p className="err full" role="alert">{perr}</p>}
      <button className="btn alt2 full">{t('changePw')}</button></form></>;
}
