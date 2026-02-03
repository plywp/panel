
# PlyWP Panel

A modern control panel for managing WordPress sites.  
It’s built for developers/hosting operators who want a clean UI to connect to a daemon, manage sites, and handle auth securely.

>[!CAUTION]
> This project is currently in development and may not be stable

- **Framework:** SvelteKit
- **Database:** Drizzle ORM (SQL)
- **Auth:** Better Auth
- **Goal:** A fast, practical panel you can deploy on a VPS or run locally for development.

---

## Features (high level)

- Better Auth-powered authentication (sessions, providers, etc.)
- Drizzle-based database layer (migrations + typed queries)
- Environment-driven configuration for safe deployments
- Designed to work with a WordPress management daemon (your connector/agent)

> Your exact features may vary depending on what modules you’ve enabled in the repo.

---

## Prerequisites

Before you deploy, make sure you have:

- **Node.js** (LTS recommended)
- **npm / pnpm / bun** (pick one package manager and stick to it)
- A supported SQL database (commonly **PostgreSQL** or **MySQL/MariaDB**)  
  *(Your project’s Drizzle setup determines which one you’re using.)*
- A server/VPS for production (optional for local dev)
- Basic familiarity with `.env` configuration.

---

## Setup

### 1) Install dependencies

Using **npm**:
```bash
npm install
```

Using **pnpm**:

```bash
pnpm install
```

Using **bun**:

```bash
bun install
```

---

### 2) Configure environment variables (`.env`)

Create your `.env` file:

```bash
cp .env.example .env
# or create it manually:
# touch .env
```

A solid baseline `.env` (edit values to match your environment):

```env
# Replace with your DB credentials!
DATABASE_USER=panel
DATABASE_PASSWORD=password
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=panel
BETTER_AUTH_SECRET=your_secret
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_ENABLED=true
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM="Your App <no-reply@example.com>"
```

#### Notes on `.env`

* **Never commit `.env`** (make sure it’s in `.gitignore`).
* Production should use **HTTPS** and a real domain for `ORIGIN` / `BETTER_AUTH_URL`.
* Use long random secrets for `SESSION_SECRET` and `BETTER_AUTH_SECRET`.

---

### 3) Database: migrations + schema

Your project likely uses **drizzle-kit**. Common commands:

```bash
# generate migrations from schema changes
npm run db:generate

# apply migrations to the database
npm run db:migrate

# (optional) open Drizzle Studio,
npm run db:studio
```

If your repo uses different names, check `package.json` scripts and use those.

---

## Running Locally

Start the dev server:

```bash
npm run dev
```

Then open:

* `http://localhost:5173`

Common useful commands:

```bash
# typecheck
npm run check

# lint 
npm run lint

# build for production
npm run build

# preview the production build locally
npm run preview
```

---

## Deployment (Production)

### Recommended production setup

* Reverse proxy: **nginx** or **caddy**
* Node runtime: **node** (or **bun** if you’ve tested it)
* Process manager: **systemd** / **pm2** / container runtime
* Use **real domain + TLS** (HTTPS)

### Basic deploy steps

1. Copy repo to your server
2. Install dependencies (`npm ci` recommended on servers)
3. Create `.env`
4. Run migrations against your prod database
5. Build and run:

   ```bash
   npm run build
   npm run preview
   ```

   For real production, you’ll usually run the built output with a process manager instead of preview.

> If you’re deploying to platforms like Vercel/Netlify, follow their [SvelteKit adapter](https://svelte.dev/docs/kit/adapters) requirements and set env vars in the platform dashboard.

---

## Best Practices

* **Use a dedicated DB user** with least privileges (don’t run as root DB user).
* **Rotate secrets** if they leak; treat them like passwords.
* Enable **HTTPS** in production. Cookies + auth without TLS is asking for chaos.
* Keep `ORIGIN` / `BETTER_AUTH_URL` correct—auth breaks in weird ways when these mismatch.
* Log carefully: avoid printing secrets or full connection strings.

---

## Troubleshooting

### “DATABASE_URL is not set”

Your `.env` isn’t being loaded or the variable name doesn’t match what your code expects.

* Confirm `.env` exists at project root
* Confirm `DATABASE_URL=...` is present
* Check your SvelteKit env usage (e.g. `$env/static/private` vs `$env/dynamic/private`)

### “Auth redirect loop” / “Invalid callback URL”

Usually an `ORIGIN` / `BETTER_AUTH_URL` mismatch.

* Local dev should match exactly: `http://localhost:5173`
* Production must match your real domain + protocol: `https://...`

### “Migration fails” / “Table not found”

* Make sure the DB exists
* Run migrations: `npm run db:migrate`
* Confirm your schema + drizzle config points to the correct database

### Cookies not working in production

* You’re likely missing HTTPS or the correct cookie/domain settings.
* Ensure your app is served over `https://` and your `ORIGIN` is correct.

---

## Security Notes

* Do not expose internal admin endpoints publicly without auth.
* Keep your database private (bind to localhost or private network).
* If the panel connects to a daemon, treat the daemon token/connector keys like secrets.

---

## License

> [CC-BY](https://creativecommons.org/licenses/by/4.0/legalcode.txt)

---

## Contributing

* Fork the repo
* Create a feature branch
* Open a PR with a clear explanation and screenshots if it affects UI

---

## Support / Community

[Discord](https://discord.gg/9KH5GAPTJY)
