import React, { useEffect, useState, useCallback } from 'react'; import { api } from '../api.js'; import { useApp } from '../context.jsx';
export default function Admin() {
  const { t, notify, user } = useApp(); const [users, setUsers] = useState(null); const [q, setQ] = useState('');
  const load = useCallback(() => api('/admin/users?q=' + encodeURIComponent(q)).then(setUsers).catch(x => notify(x.message)), [q, notify]);
  useEffect(() => { const id = setTimeout(load, 200); return () => clearTimeout(id); }, [load]);
  const toggle = async u => { try { await api('/admin/users/' + u.id, { method: 'PATCH', body: { status: u.status === 'active' ? 'suspended' : 'active' } }); load(); } catch (x) { notify(x.message); } };
  return <>
    <h1>{t('users')}</h1>
    <input className="search" type="search" placeholder={'🔍 ' + t('search').replace(/.*/, t('name') + ' / ' + t('email'))} value={q} onChange={e => setQ(e.target.value)}/>
    {!users ? <p>{t('loading')}</p> : <div className="cards">{users.map(u => <article key={u.id} className="card crop">
      <header><h3>{u.name}</h3><span className={'chip s-' + (u.status === 'active' ? 'available' : 'hidden')}>{t(u.status)}</span></header>
      <p>{t(u.role)} · {u.phone}</p><p className="muted">{u.email}</p>{u.district && <p className="muted">📍 {u.village} {u.district}</p>}
      {u.id !== user.id && <div className="row"><button className={'btn sm ' + (u.status === 'active' ? 'danger' : '')} onClick={() => toggle(u)}>{u.status === 'active' ? t('suspend') : t('activate')}</button></div>}
    </article>)}</div>}</>;
}
