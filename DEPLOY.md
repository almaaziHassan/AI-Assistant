# Deploying to Railway 🚂

Follow this simple guide to deploy your AI Receptionist to Railway.

## 1. Prerequisites

- A GitHub account with this repository pushed to it.
- A [Railway](https://railway.app/) account.

## 2. Deploy Database (PostgreSQL)

1.  Click **New Project** -> **Provision PostgreSQL**.
2.  Wait for it to initialize.
3.  Click on the PostgreSQL card -> **Variables**.
4.  Copy the `DATABASE_URL`. You will need this for the backend.

## 3. Deploy Backend

1.  Click **New** -> **GitHub Repo** -> `Your Repo`.
2.  Select the `backend` folder as the **Root Directory** (in Settings).
3.  Go to **Variables** and add:
    *   `DATABASE_URL`: (Paste from Step 2)
    *   `GROQ_API_KEY`: (Your Groq API Key)
    *   `ADMIN_PASSWORD`: (Choose a strong password)
    *   `JWT_SECRET`: (Run `openssl rand -hex 32` locally to generate one)
    *   `BREVO_API_KEY`: (If using email)
    *   `NPM_CONFIG_PRODUCTION`: `false` (IMPORTANT: keeps devDependencies like `prisma` for build)
4.  Go to **Settings** -> **Build** section:
    *   Build Command: `npm run build`
    *   Start Command: `npm start`
5.  Go to **Settings** -> **Networking** -> **Generate Domain**.
    *   Copy this URL (e.g., `https://backend-production.up.railway.app`).

## 4. Deploy Frontend

1.  Click **New** -> **GitHub Repo** -> `Your Repo` (Same repo).
2.  Select the `frontend` folder as the **Root Directory**.
3.  Go to **Variables** and add:
    *   `VITE_BACKEND_URL`: (Paste the Backend URL from Step 3, e.g., `https://backend-production.up.railway.app`)
4.  Go to **Settings** -> **Build** section:
    *   Build Command: `npm run build`
    *   Start Command: `npm start`
5.  Go to **Settings** -> **Networking** -> **Generate Domain**.
    *   This is your live website URL! 🎉

## 5. Final Check

1.  Visit your Frontend URL.
2.  Try to log in to `/admin` using your `ADMIN_PASSWORD`.
3.  Try to chat with the bot.

## Troubleshooting

-   **"Prisma Client not initialized":** Make sure `NPM_CONFIG_PRODUCTION` is `false` in Backend variables so `prisma generate` runs correctly.
-   **"Network Error":** Check CORS. You might need to add `FRONTEND_URL` to your Backend variables so it allows requests from your new Frontend domain.
