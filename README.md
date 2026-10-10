# Fosoler Khoj — Production-ready React + Node.js + MySQL

## Roles and direct login URLs

- `/login` — common login
- `/farmer/login` — Farmer login
- `/buyer/login` — Buyer login
- `/expert/login` — Expert login
- `/supplier/login` — Supplier login
- `/admin/login` — Admin login
- `/register` — public registration

After login, the dashboard and protected routes are selected by the authenticated role.

## Local development

### 1. MySQL/XAMPP
Start MySQL from XAMPP. Copy `backend/.env.example` to `backend/.env` and set your credentials.

### 2. Backend
```bash
cd backend
npm install
npm start
```

Health:
`http://localhost:4000/api/health`

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Production / one-domain deployment

Build the frontend:
```bash
cd frontend
npm install
npm run build
```

Then start the backend with:
```bash
cd ../backend
NODE_ENV=production npm start
```

The Express server serves `frontend/dist` and provides SPA fallback routing, so direct URLs and browser refreshes work on the same domain.

For example:
```text
https://your-domain.com/
https://your-domain.com/farmer/login
https://your-domain.com/buyer/login
https://your-domain.com/admin/login
https://your-domain.com/profile
https://your-domain.com/admin/users
```

Set a strong `JWT_SECRET` in production. Do not commit `.env`.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@fosolerkhoj.com | Admin@123 |
| Farmer | farmer@demo.com | Demo@1234 |
| Buyer | buyer@demo.com | Demo@1234 |

The demo accounts are seeded only when the database has no users.

## Important deployment note

If a reverse proxy such as Nginx or Apache is used, proxy the domain to the Node.js backend port. Do not configure the frontend as a separate static-only site unless you also provide `/api` proxying and SPA fallback.

Database: MySQL/MariaDB, `utf8mb4`, InnoDB.
