import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { dict } from './i18n.js'; import { api } from './api.js';
const Ctx = createContext(); export const useApp = () => useContext(Ctx);
export function AppProvider({ children }) {
  const [user, setUser] = useState(null); const [ready, setReady] = useState(false);
  const [lang, setLang] = useState(localStorage.getItem('fk_lang') || 'en');
  const [toast, setToast] = useState('');
  const t = k => dict[lang][k] ?? dict.en[k] ?? k;
  const changeLang = l => { setLang(l); localStorage.setItem('fk_lang', l); document.documentElement.lang = l; };
  const notify = useCallback(m => { setToast(m); setTimeout(() => setToast(''), 2800); }, []);
  const login = ({ token, user }) => { localStorage.setItem('fk_token', token); setUser(user); if (user.language) changeLang(user.language); };
  const logout = () => { localStorage.removeItem('fk_token'); setUser(null); };
  useEffect(() => { if (!localStorage.getItem('fk_token')) return setReady(true);
    api('/profile').then(setUser).catch(logout).finally(() => setReady(true)); }, []);
  return <Ctx.Provider value={{ user, setUser, ready, lang, changeLang, t, login, logout, notify }}>
    {children}{toast && <div className="toast" role="status">{toast}</div>}</Ctx.Provider>;
}
