const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('fk_token');
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (err) {
    const e = new Error('Backend server is not reachable. Make sure the backend is running on port 4000.');
    e.cause = err;
    throw e;
  }
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    const e = new Error(data.error || `Request failed (${res.status}). Please check the backend terminal.`);
    e.status = res.status;
    throw e;
  }
  return data;
}
