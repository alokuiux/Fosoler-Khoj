import React, { useEffect, useState } from 'react'; import { Link } from 'react-router-dom';
import { useApp } from '../context.jsx'; import { api } from '../api.js';

const Stat = ({ n, label }) => <div className="stat"><b>{n ?? '–'}</b><span>{label}</span></div>;
export default function Dashboard() {
  const { user, t } = useApp(); const [s, setS] = useState(null); const [mine, setMine] = useState(null);
  useEffect(() => {
    if (user.role === 'admin') api('/admin/stats').then(setS).catch(() => {});
    if (user.role === 'farmer') api('/listings?mine=1').then(setMine).catch(() => {});
  }, [user.role]);
  const actions = {
    farmer: [['/my-crops', '🌾', t('addCrop')], ['/market', '🛒', t('market')], ['/profile', '👤', t('profile')]],
    buyer: [['/market', '🛒', t('browse')], ['/profile', '👤', t('profile')]],
    expert: [['/profile', '👤', t('profile')]], supplier: [['/profile', '👤', t('profile')]],
    admin: [['/admin/users', '👥', t('manageUsers')], ['/admin/listings', '🌾', t('manageListings')]],
  }[user.role];
  return <>
    <section className="welcome"><h1>{t('hello')}, {user.name.split(' ')[0]} 👋</h1>
      <p>{t(user.role + 'Help')}</p><span className="chip">{t(user.role)}</span></section>
    {user.role === 'admin' && s && <div className="stats">
      <Stat n={s.users} label={t('totalUsers')}/><Stat n={s.farmers} label={t('farmers')}/><Stat n={s.buyers} label={t('buyers')}/>
      <Stat n={s.listings} label={t('totalListings')}/><Stat n={s.active} label={t('activeListings')}/></div>}
    {user.role === 'farmer' && mine && <div className="stats">
      <Stat n={mine.length} label={t('myListings')}/><Stat n={mine.filter(l => l.status === 'available').length} label={t('available')}/>
      <Stat n={mine.filter(l => l.status === 'sold').length} label={t('sold')}/></div>}
    <h2 className="sec">{t('quick')}</h2>
    <div className="actions">{actions.map(([to, ic, label]) => <Link key={to} to={to} className="action card"><span aria-hidden>{ic}</span>{label}</Link>)}</div></>;
}
