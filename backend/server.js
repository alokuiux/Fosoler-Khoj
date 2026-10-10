require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const SECRET = process.env.JWT_SECRET || 'change-this-secret';
const PORT = Number(process.env.PORT || 4000);
const app = express();
const path = require('path');

app.use(cors());
app.use(express.json({ limit: '100kb' }));

const ROLES = ['farmer', 'buyer', 'expert', 'supplier'];
const fail = (res, code, msg) => res.status(code).json({ error: msg });
const publicUser = (u) => {
  if (!u) return u;
  const { password_hash, ...r } = u;
  return r;
};
const sign = (u) => jwt.sign({ id: u.id, role: u.role }, SECRET, { expiresIn: '7d' });
const phoneOk = (p) => /^(\+?88)?01\d{9}$/.test(p || '');
const passOk = (p) => !!p && p.length >= 8 && /\d/.test(p) && /[a-zA-Z]/.test(p);

async function auth(req, res, next) {
  try {
    const raw = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const p = jwt.verify(raw, SECRET);
    const u = await db.get('SELECT * FROM users WHERE id=?', [p.id]);
    if (!u) return fail(res, 401, 'Account not found. Please log in again.');
    if (u.status !== 'active') return fail(res, 403, 'Your account is suspended. Please contact admin.');
    req.user = u;
    next();
  } catch {
    fail(res, 401, 'Please log in to continue.');
  }
}
const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : fail(res, 403, 'You do not have permission for this action.');

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body || {};
    if (!name?.trim() || name.trim().length < 2) return fail(res, 400, 'Please enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(email || '')) return fail(res, 400, 'Please enter a valid email address.');
    if (!phoneOk(phone)) return fail(res, 400, 'Enter a valid Bangladeshi mobile number (e.g. 01712345678).');
    if (!passOk(password)) return fail(res, 400, 'Password needs 8+ characters with letters and numbers.');
    if (!ROLES.includes(role)) return fail(res, 400, 'Please choose your role.');

    const normalizedEmail = email.toLowerCase().trim();
    if (await db.get('SELECT 1 FROM users WHERE email=?', [normalizedEmail]))
      return fail(res, 409, 'This email is already registered. Try logging in.');

    const result = await db.run(
      'INSERT INTO users(name,email,phone,password_hash,role) VALUES(?,?,?,?,?)',
      [name.trim(), normalizedEmail, phone, bcrypt.hashSync(password, 10), role]
    );
    const u = await db.get('SELECT * FROM users WHERE id=?', [result.insertId]);
    res.status(201).json({ token: sign(u), user: publicUser(u) });
  } catch (e) {
    console.error(e);
    fail(res, 500, 'Could not create account. Please try again.');
  }
});

app.post('/api/auth/login',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, message: { error: 'Too many attempts. Try again in 15 minutes.' } }),
  async (req, res) => {
    try {
      const { email, password, role } = req.body || {};
      const u = await db.get('SELECT * FROM users WHERE email=?', [(email || '').toLowerCase().trim()]);
      if (!u || !bcrypt.compareSync(password || '', u.password_hash))
        return fail(res, 401, 'Email or password is incorrect.');
      if (role && u.role !== role)
        return fail(res, 403, `This account is registered as ${u.role}. Please use the correct login panel.`);
      if (u.status !== 'active') return fail(res, 403, 'Your account is suspended. Please contact admin.');
      res.json({ token: sign(u), user: publicUser(u) });
    } catch (e) {
      console.error(e);
      fail(res, 500, 'Login failed. Please try again.');
    }
  }
);

app.get('/api/profile', auth, (req, res) => res.json(publicUser(req.user)));

app.put('/api/profile', auth, async (req, res) => {
  const { name, phone, division, district, village, bio, language } = req.body || {};
  if (!name?.trim()) return fail(res, 400, 'Name cannot be empty.');
  if (!phoneOk(phone)) return fail(res, 400, 'Enter a valid mobile number.');

  await db.run(
    'UPDATE users SET name=?,phone=?,division=?,district=?,village=?,bio=?,language=? WHERE id=?',
    [name.trim(), phone, division || '', district || '', village || '', (bio || '').slice(0, 500), language === 'bn' ? 'bn' : 'en', req.user.id]
  );
  res.json(publicUser(await db.get('SELECT * FROM users WHERE id=?', [req.user.id])));
});

app.put('/api/profile/password', auth, async (req, res) => {
  const { current, next } = req.body || {};
  if (!bcrypt.compareSync(current || '', req.user.password_hash))
    return fail(res, 400, 'Current password is incorrect.');
  if (!passOk(next))
    return fail(res, 400, 'New password needs 8+ characters with letters and numbers.');
  await db.run('UPDATE users SET password_hash=? WHERE id=?', [bcrypt.hashSync(next, 10), req.user.id]);
  res.json({ ok: true });
});

const LST = `SELECT l.*, u.name AS farmer_name, u.phone AS farmer_phone
             FROM listings l JOIN users u ON u.id=l.farmer_id`;

app.get('/api/listings', auth, async (req, res) => {
  const q = `%${req.query.q || ''}%`;
  const mine = req.query.mine === '1' && req.user.role === 'farmer';
  const where = ['(l.crop_name LIKE ? OR l.location LIKE ?)'];
  const args = [q, q];

  if (mine) {
    where.push('l.farmer_id=?');
    args.push(req.user.id);
  } else if (req.user.role !== 'admin') {
    where.push("l.status='available'");
  }

  res.json(await db.all(`${LST} WHERE ${where.join(' AND ')} ORDER BY l.id DESC`, args));
});

const validListing = (b) => {
  if (!b.crop_name?.trim()) return 'Please enter the crop name.';
  if (!(Number(b.quantity) > 0)) return 'Quantity must be more than 0.';
  if (!(Number(b.price) > 0)) return 'Price must be more than 0.';
  return null;
};

app.post('/api/listings', auth, allow('farmer'), async (req, res) => {
  const b = req.body || {};
  const err = validListing(b);
  if (err) return fail(res, 400, err);

  const result = await db.run(
    'INSERT INTO listings(farmer_id,crop_name,quantity,unit,price,location,selling_info) VALUES(?,?,?,?,?,?,?)',
    [req.user.id, b.crop_name.trim(), Number(b.quantity), b.unit || 'kg', Number(b.price), b.location || '', (b.selling_info || '').slice(0, 500)]
  );
  res.status(201).json(await db.get(`${LST} WHERE l.id=?`, [result.insertId]));
});

async function getListing(id) {
  return db.get('SELECT * FROM listings WHERE id=?', [id]);
}
async function ownListing(req, res, next) {
  const l = await getListing(req.params.id);
  if (!l) return fail(res, 404, 'Listing not found.');
  if (l.farmer_id !== req.user.id && req.user.role !== 'admin')
    return fail(res, 403, 'This is not your listing.');
  req.listing = l;
  next();
}

app.put('/api/listings/:id', auth, allow('farmer'), ownListing, async (req, res) => {
  const b = req.body || {};
  const err = validListing(b);
  if (err) return fail(res, 400, err);

  await db.run(
    'UPDATE listings SET crop_name=?,quantity=?,unit=?,price=?,location=?,selling_info=?,status=? WHERE id=?',
    [b.crop_name.trim(), Number(b.quantity), b.unit || 'kg', Number(b.price), b.location || '', (b.selling_info || '').slice(0, 500),
      b.status === 'sold' ? 'sold' : 'available', req.params.id]
  );
  res.json(await db.get(`${LST} WHERE l.id=?`, [req.params.id]));
});

app.delete('/api/listings/:id', auth, allow('farmer', 'admin'), ownListing, async (req, res) => {
  await db.run('DELETE FROM listings WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/admin/stats', auth, allow('admin'), async (req, res) => {
  // mysql2 returns an object for SELECT ... AS n
  const c = async (sql) => {
    const row = await db.get(sql);
    return Number(row?.n || 0);
  };
  res.json({
    users: await c("SELECT COUNT(*) AS n FROM users WHERE role!='admin'"),
    farmers: await c("SELECT COUNT(*) AS n FROM users WHERE role='farmer'"),
    buyers: await c("SELECT COUNT(*) AS n FROM users WHERE role='buyer'"),
    listings: await c('SELECT COUNT(*) AS n FROM listings'),
    active: await c("SELECT COUNT(*) AS n FROM listings WHERE status='available'")
  });
});

app.get('/api/admin/users', auth, allow('admin'), async (req, res) => {
  const q = `%${req.query.q || ''}%`;
  const users = await db.all('SELECT * FROM users WHERE name LIKE ? OR email LIKE ? ORDER BY id DESC', [q, q]);
  res.json(users.map(publicUser));
});

app.patch('/api/admin/users/:id', auth, allow('admin'), async (req, res) => {
  if (Number(req.params.id) === req.user.id) return fail(res, 400, 'You cannot change your own account status.');
  const s = req.body?.status;
  if (!['active', 'suspended'].includes(s)) return fail(res, 400, 'Invalid status.');
  await db.run('UPDATE users SET status=? WHERE id=?', [s, req.params.id]);
  res.json({ ok: true });
});

app.patch('/api/admin/listings/:id', auth, allow('admin'), async (req, res) => {
  const s = req.body?.status;
  if (!['available', 'sold', 'hidden'].includes(s)) return fail(res, 400, 'Invalid status.');
  await db.run('UPDATE listings SET status=? WHERE id=?', [s, req.params.id]);
  res.json({ ok: true });
});

app.get('/api/health', async (req, res) => {
  try {
    await db.get('SELECT 1 AS ok');
    res.json({ ok: true, database: 'mysql' });
  } catch {
    res.status(503).json({ ok: false, database: 'mysql' });
  }
});

// Production: serve the React SPA from the same domain.
// API routes always stay under /api, while every frontend route falls back to index.html.
const FRONTEND_DIST = path.resolve(__dirname, '../frontend/dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(FRONTEND_DIST, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'), err => {
      if (err) next(err);
    });
  });
}

app.use((req, res) => fail(res, 404, 'Not found.'));

app.use((err, req, res, next) => {
  console.error(err);
  if (!res.headersSent) fail(res, 500, 'Internal server error.');
});

(async () => {
  try {
    await db.init();
    app.listen(PORT, () => console.log(`Fosoler Khoj API running on http://localhost:${PORT}`));
  } catch (e) {
    console.error('\nDatabase connection failed.');
    console.error(e.message);
    process.exit(1);
  }
})();
