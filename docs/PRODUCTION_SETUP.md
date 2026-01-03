# Production Setup Guide

This guide ensures your AI Receptionist is secure and robust for production use.

## 1. Environment Variables (Backend)

In production (Railway, Heroku, etc.), you **MUST** set the following environment variables. The application will fail to start or warn you if these are missing.

| Variable | Description | Example / Note |
|----------|-------------|----------------|
| `NODE_ENV` | Set to `production` | `production` |
| `ADMIN_PASSWORD` | Secure password for Admin Dashboard | **Required**. Do not use "admin123". |
| `JWT_SECRET` | Secret key for signing session tokens | **Required**. Generate with `openssl rand -hex 32` |
| `DATABASE_URL` | PostgreSQL Connection String | `postgres://user:pass@host:5432/dbname` |
| `FRONTEND_URL` | URL of your deployed Frontend | `https://your-app.vercel.app` (No trailing slash) |
| `BREVO_API_KEY` | Key for email service | `xkeysib-...` |
| `BREVO_FROM_EMAIL` | Sender email address | `noreply@yourdomain.com` |
| `BREVO_FROM_NAME` | Sender name | `My Spa Reception` |
| `GROQ_API_KEY` | AI Service Key | `gsk_...` |

## 2. Database (PostgreSQL)

The application automatically switches to PostgreSQL when `DATABASE_URL` is detected effectively.
- **Why**: SQLite is a local file and will be wiped on every deployment in serverless/container environments.
- **Setup**:
  1. Provision a PostgreSQL database (e.g., Railway Plugin, Supabase, Neon).
  2. Get the `DATABASE_URL`.
  3. Set it in your backend variables.
  4. The app will automatically create tables on first run.

## 3. Security Checklist

- [ ] **Strong Passwords**: Ensure `ADMIN_PASSWORD` is long and complex.
- [ ] **Strict CORS**: Ensure `FRONTEND_URL` is set to your exact frontend domain to prevent unauthorized API access.
- [ ] **Rate Limiting**: Rate limiting is active by default. You can tune it in `src/middleware/rateLimiter.ts`.
- [ ] **HTTPS**: Ensure your deployment platform provides HTTPS (Railway/Vercel do this automatically).

## 4. Frontend Deployment

- Set `VITE_API_URL` to your deployed Backend URL (e.g., `https://your-backend.railway.app`).
- Set `VITE_WS_URL` to the same URL (e.g., `wss://your-backend.railway.app` or `https` usually works with Socket.io client auto-upgrade).

## 5. Troubleshooting

- **Login Fails in Prod**: Check `JWT_SECRET` is set. Check if `FRONTEND_URL` matches your browser origin (CORS).
- **Data Disappears**: You are likely still using SQLite. Set `DATABASE_URL`.
