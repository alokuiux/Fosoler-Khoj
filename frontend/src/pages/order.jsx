import React, { useEffect, useState } from 'react'; import { Link } from 'react-router-dom';
import { api } from '../api.js'; import { useApp } from '../context.jsx';
import { Icon, PageHead, Stat, useLoad, Skeleton, Empty, fmtWhen, ago } from '../components.jsx';

const STEPS = ['pending', 'accepted', 'shipped', 'delivered'];
const FILTERS = ['all', ...STEPS, 'rejected', 'cancelled'];
const tone = (s) => (s === 'pending' ? 'warn' : s === 'rejected' || s === 'cancelled' ? 'danger' : s === 'delivered' ? '' : 'info');
const money = (n) => '৳' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
const code = (id) => '#FK-' + String(id).padStart(5, '0');

function Stepper({ status }) {
  const { t } = useApp(); const idx = STEPS.indexOf(status);
  return <ol className="stepper" aria-label={t('stepsHelp')}>{STEPS.map((s, i) => <li key={s} className={(i <= idx ? 'done ' : '') + (i === idx ? 'cur' : '')} aria-current={i === idx ? 'step' : undefined}>
    <span className="dot2">{i < idx ? <Icon n="check" /> : i + 1}</span><small>{t('os_' + s)}</small></li>)}</ol>;
}

function Timeline({ id }) {
  const { t, lang } = useApp(); const [o] = useLoad(() => api('/orders/' + id), [id]);
  if (!o) return <div className="skeleton" style={{ minHeight: 70 }} />;
  return <div className="tl"><b>{t('timeline')}</b><ul>{o.events.map((e) => <li key={e.id}>
    <span className={'chip ' + tone(e.status)}>{t('os_' + e.status)}</span> <small className="muted">{fmtWhen(e.created_at, lang)}{e.actor_name ? ' · ' + e.actor_name : ''}</small>
    {e.note && e.note !== 'Order placed' && <p>{e.note}</p>}</li>)}</ul></div>;
}

function OrderCard({ o, role, onChanged }) {
  const { t, lang, notify } = useApp();
  const [open, setOpen] = useState(false); const [ask, setAsk] = useState(null); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  const other = role === 'buyer' ? { label: t('farmerLabel'), name: o.farmer_name, phone: o.farmer_phone } : { label: t('buyerLabel'), name: o.buyer_name, phone: o.buyer_phone };
  const move = async (status, why) => {
    setBusy(true);
    try { await api(`/orders/${o.id}/status`, { method: 'PATCH', body: { status, reason: why } }); notify('✓ ' + t('orderUpdated')); setAsk(null); setReason(''); onChanged(); }
    catch (x) { notify(x.message); } finally { setBusy(false); }
  };
  const acts = [];
  if (role === 'farmer') {
    if (o.status === 'pending') acts.push(['accepted', 'acceptOrder', 'check', 'btn'], ['rejected', 'rejectOrder', 'x', 'btn danger', true]);
    if (o.status === 'accepted') acts.push(['shipped', 'markShipped', 'truck', 'btn'], ['cancelled', 'cancelOrder', 'x', 'btn alt2', true]);
    if (o.status === 'shipped') acts.push(['delivered', 'markDelivered', 'check', 'btn']);
  }
  if (role === 'buyer') {
    if (o.status === 'pending' || o.status === 'accepted') acts.push(['cancelled', 'cancelOrder', 'x', 'btn alt2', true]);
    if (o.status === 'shipped') acts.push(['delivered', 'confirmReceived', 'check', 'btn']);
  }
  const final = o.status === 'rejected' || o.status === 'cancelled';
  return <article className={'card ord st-' + o.status}>
    <header className="ord-head">
      <div><h3>{o.crop_name} <small className="muted">{code(o.id)}</small></h3><small className="muted">{fmtWhen(o.created_at, lang)} · {ago(o.created_at, lang)}</small></div>
      <span className={'chip ' + tone(o.status)}>{t('os_' + o.status)}</span></header>
    <div className="ord-grid">
      <div><span className="muted">{t('orderQty')}</span><b>{Number(o.quantity)} {o.unit} × {money(o.price)}</b></div>
      <div><span className="muted">{t('orderTotal')}</span><b className="price" style={{ fontSize: '1.3rem' }}>{money(o.total)}</b></div>
      <div><span className="muted">{role === 'admin' ? t('buyerLabel') + ' / ' + t('farmerLabel') : other.label}</span>
        <b>{role === 'admin' ? `${o.buyer_name} → ${o.farmer_name}` : other.name}</b>
        {role !== 'admin' && other.phone && <a className="tel" href={'tel:' + other.phone}><Icon n="phone" /> {other.phone}</a>}</div>
      <div><span className="muted">{t('deliveryMethod')}</span><b>{t('m_' + o.delivery_method)}</b>{o.delivery_method === 'delivery' && o.delivery_address && <small>{o.delivery_address}</small>}</div>
      <div><span className="muted">{t('paymentMethod')}</span><b>{t('pay_' + o.payment_method)}</b></div>
      {o.note && <div><span className="muted">{t('orderNote').replace(/ \(.*\)/, '')}</span><b style={{ fontWeight: 500 }}>{o.note}</b></div>}
    </div>
    {final ? <div className={'alert-line danger'} style={{ marginTop: '.7rem' }}><Icon n="x" /> {t('reasonIs')}: {o.reason || '—'}</div> : <Stepper status={o.status} />}

    {ask ? <div className="reason">
      <label className="field"><span>{t('reasonLabel')}</span><textarea autoFocus rows="2" maxLength="300" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('reasonHint')} /></label>
      <div className="row" style={{ marginTop: 0 }}><button className="btn danger sm" disabled={busy || reason.trim().length < 3} onClick={() => move(ask, reason)}>{t('confirmAction')}</button>
        <button className="btn alt2 sm" onClick={() => { setAsk(null); setReason(''); }}>{t('goBack')}</button></div></div>
      : <div className="row">{acts.map(([to, label, ic, cls, needReason]) => <button key={to} className={cls + ' sm'} disabled={busy} onClick={() => (needReason ? setAsk(to) : move(to))}><Icon n={ic} /> {t(label)}</button>)}
        <button className="ghost" onClick={() => setOpen(!open)} aria-expanded={open}><Icon n="package" /> {open ? t('hideTimeline') : t('showTimeline')}</button></div>}
    {open && <Timeline id={o.id} />}
  </article>;
}

export default function Orders() {
  const { t, user } = useApp(); const [status, setStatus] = useState('all'); const [q, setQ] = useState(''); const [qd, setQd] = useState('');
  useEffect(() => { const id = setTimeout(() => setQd(q), 250); return () => clearTimeout(id); }, [q]);
  const [sum, reloadSum] = useLoad(() => api('/orders/summary'), []);
  const [list, reload] = useLoad(() => api(`/orders?status=${status === 'all' ? '' : status}&q=${encodeURIComponent(qd)}`), [status, qd]);
  const changed = () => { reload(); reloadSum(); };
  const sub = user.role === 'farmer' ? t('ordersFarmerSub') : user.role === 'buyer' ? t('ordersBuyerSub') : t('ordersAdminSub');
  return <>
    <PageHead title={t('orders')} sub={sub}>{user.role === 'buyer' && <Link className="btn" to="/market"><Icon n="cart" /> {t('browseMarket')}</Link>}</PageHead>
    {sum && <div className="stats">
      <Stat n={sum.active} label={t('activeOrders')} icon="truck" tone="sky" />
      {user.role === 'farmer' && <Stat n={sum.counts.pending} label={t('waitingOrders')} icon="package" tone="gold" />}
      <Stat n={sum.total} label={t('totalOrders')} icon="list" />
      <Stat n={money(sum.deliveredAmount)} label={t('deliveredValue')} icon="check" /></div>}
    <div className="tabs" role="tablist">{FILTERS.map((f) => <button key={f} role="tab" aria-selected={status === f} className={'tab' + (status === f ? ' on' : '')} onClick={() => setStatus(f)}>
      {f === 'all' ? t('allOrders') : t('os_' + f)}{sum && f !== 'all' && sum.counts[f] > 0 ? ` (${sum.counts[f]})` : ''}</button>)}</div>
    <input className="search" type="search" placeholder={'🔍 ' + t('searchOrders')} value={q} onChange={(e) => setQ(e.target.value)} />
    {!list ? <Skeleton n={2} /> : !list.length
      ? <Empty icon="package" text={status !== 'all' || qd ? t('noOrdersFilter') : user.role === 'farmer' ? t('noOrdersFarmer') : t('noOrdersBuyer')}>
        {user.role === 'buyer' && status === 'all' && !qd && <Link className="btn" to="/market">{t('browseMarket')}</Link>}</Empty>
      : list.map((o) => <OrderCard key={o.id} o={o} role={user.role} onChanged={changed} />)}
  </>;
}
