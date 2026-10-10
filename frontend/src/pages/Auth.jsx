import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import { LangToggle } from '../App.jsx';

const ROLE_META = {
  farmer: { icon: '👨‍🌾', label: 'farmer' },
  buyer: { icon: '🧺', label: 'buyer' },
  expert: { icon: '🎓', label: 'expert' },
  supplier: { icon: '🚜', label: 'supplier' },
  admin: { icon: '🛡️', label: 'admin' },
};

function AuthFrame({ children }) {
  const { t } = useApp();
  return <div className="auth">
    <aside className="hero">
      <div className="auth-brand">
        <img src="/fosoler-khoj-wordmark.png" alt="Fosoler Khoj — Sell your crops directly. Get a fair price."/>
      </div>
    </aside>
    <section className="card authcard">
      <div className="right"><LangToggle /></div>
      {children}
    </section>
  </div>;
}

const Field = ({ label, hint, ...p }) => (
  <label className="field"><span>{label}</span><input {...p}/>{hint && <small>{hint}</small>}</label>
);

function LoginLinks({ current }) {
  const { t } = useApp();
  const roles = ['farmer', 'buyer', 'expert', 'supplier', 'admin'];
  return <div className="login-links">
    {roles.filter(r => r !== current).map(r => (
      <Link key={r} to={`/${r}/login`} className="role-link">
        {ROLE_META[r].icon} {t(ROLE_META[r].label)}
      </Link>
    ))}
  </div>;
}

export function Login({ role = null }) {
  const { t, login } = useApp();
  const location = useLocation();
  const activeRole = role || (location.pathname.match(/^\/(farmer|buyer|expert|supplier|admin)\/login$/)?.[1] || null);
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const set = k => e => setF({ ...f, [k]: e.target.value });

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const result = await api('/auth/login', {
        method: 'POST',
        body: { ...f, ...(activeRole ? { role: activeRole } : {}) }
      });
      login(result);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };

  return <AuthFrame>
    <div className="login-heading">
      <h2>{activeRole ? `${ROLE_META[activeRole].icon} ${t(activeRole)} ${t('login')}` : t('login')}</h2>
      {activeRole && <span className="chip">{t(activeRole)}</span>}
    </div>
    <form onSubmit={submit}>
      <Field label={t('email')} type="email" autoComplete="email" required value={f.email} onChange={set('email')}/>
      <Field label={t('password')} type="password" autoComplete="current-password" required value={f.password} onChange={set('password')}/>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? t('loading') : t('login')}</button>
    </form>
    {!activeRole && <p className="demo">Demo: farmer@demo.com / Demo@1234</p>}
    <LoginLinks current={activeRole}/>
    {activeRole !== 'admin' && <p className="alt">{t('noAccount')} <Link to="/register">{t('register')}</Link></p>}
  </AuthFrame>;
}

export function Register() {
  const { t, login } = useApp();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', role: 'farmer' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      login(await api('/auth/register', { method: 'POST', body: f }));
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };

  return <AuthFrame>
    <h2>{t('register')}</h2>
    <form onSubmit={submit}>
      <span className="lbl">{t('iam')}</span>
      <div className="roles">
        {['farmer', 'buyer', 'expert', 'supplier'].map(r =>
          <button type="button" key={r} className={f.role === r ? 'role on' : 'role'} onClick={() => setF({ ...f, role: r })}>
            <span aria-hidden>{ROLE_META[r].icon}</span>{t(r)}
          </button>
        )}
      </div>
      <Field label={t('name')} required value={f.name} onChange={set('name')} autoComplete="name"/>
      <Field label={t('phone')} type="tel" inputMode="numeric" placeholder="01XXXXXXXXX" required value={f.phone} onChange={set('phone')}/>
      <Field label={t('email')} type="email" required value={f.email} onChange={set('email')}/>
      <Field label={t('password')} type="password" hint={t('pwHint')} required value={f.password} onChange={set('password')} autoComplete="new-password"/>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? t('loading') : t('register')}</button>
    </form>
    <p className="alt">{t('haveAccount')} <Link to="/login">{t('login')}</Link></p>
  </AuthFrame>;
}
