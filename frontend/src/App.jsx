import React from 'react'; import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { useApp } from './context.jsx';
import { Login, Register } from './pages/Auth.jsx'; import Dashboard from './pages/Dashboard.jsx';
import Profile from './pages/Profile.jsx'; import Listings from './pages/Listings.jsx'; import Admin from './pages/Admin.jsx';

export function LangToggle() {
  const { lang, changeLang } = useApp();
  return <div className="lang" role="group" aria-label="Language">
    {['en', 'bn'].map(l => <button key={l} className={lang === l ? 'on' : ''} onClick={() => changeLang(l)}>{l === 'en' ? 'English' : 'বাংলা'}</button>)}</div>;
}
const menu = {
  farmer: [['/', 'home', '🏠'], ['/my-crops', 'myListings', '🌾'], ['/market', 'market', '🛒'], ['/profile', 'profile', '👤']],
  buyer: [['/', 'home', '🏠'], ['/market', 'market', '🛒'], ['/profile', 'profile', '👤']],
  expert: [['/', 'home', '🏠'], ['/profile', 'profile', '👤']],
  supplier: [['/', 'home', '🏠'], ['/profile', 'profile', '👤']],
  admin: [['/', 'home', '🏠'], ['/admin/users', 'users', '👥'], ['/admin/listings', 'listings', '🌾'], ['/profile', 'profile', '👤']],
};
function Shell({ children }) {
  const { user, t, logout } = useApp();
  return <div className="shell">
    <header className="top"><div className="brand"><img className="brand-logo" src="/fosoler-khoj-icon.png" alt="Fosoler Khoj logo"/><b>{t('app')}</b></div>
      <div className="topr"><LangToggle/><button className="ghost" onClick={logout}>{t('logout')}</button></div></header>
    <nav className="nav" aria-label="Main">{menu[user.role].map(([to, k, ic]) =>
      <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'on' : ''}><span aria-hidden>{ic}</span><span>{t(k)}</span></NavLink>)}</nav>
    <main className="main">{children}</main></div>;
}
const Guard = ({ roles, children }) => { const { user } = useApp(); return roles.includes(user.role) ? children : <Navigate to="/" replace/>; };

export default function App() {
  const { user, ready, t } = useApp();
  if (!ready) return <div className="center">{t('loading')}</div>;
  if (!user) return <Routes>
    <Route path="/register" element={<Register/>}/>
    <Route path="/login" element={<Login/>}/>
    <Route path="/farmer/login" element={<Login role="farmer"/>}/>
    <Route path="/buyer/login" element={<Login role="buyer"/>}/>
    <Route path="/expert/login" element={<Login role="expert"/>}/>
    <Route path="/supplier/login" element={<Login role="supplier"/>}/>
    <Route path="/admin/login" element={<Login role="admin"/>}/>
    <Route path="*" element={<Navigate to="/login" replace/>}/>
  </Routes>;
  return <Shell><Routes>
    <Route path="/" element={<Dashboard/>}/>
    <Route path="/profile" element={<Profile/>}/>
    <Route path="/market" element={<Guard roles={['farmer', 'buyer']}><Listings mode="browse"/></Guard>}/>
    <Route path="/my-crops" element={<Guard roles={['farmer']}><Listings mode="mine"/></Guard>}/>
    <Route path="/admin/users" element={<Guard roles={['admin']}><Admin tab="users"/></Guard>}/>
    <Route path="/admin/listings" element={<Guard roles={['admin']}><Listings mode="admin"/></Guard>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/></Routes></Shell>;
}
