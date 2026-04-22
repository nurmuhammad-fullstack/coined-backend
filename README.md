# CoinEd Backend

Node.js, Express, MongoDB, Socket.IO, and Telegram bot backend for the CoinEd LMS project.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill in at least:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority
JWT_SECRET=<long-random-secret>
PORT=5001
CLIENT_URL=http://localhost:3000
WEBAPP_URL=http://localhost:3000
RESEND_API_KEY=
SUPPORT_EMAIL=support@novdaunion.uz
```

3. Start the API:

```bash
npm run dev
```

4. Health check:

```text
GET /api/health
```

## Production env

Required:

- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_URL`
- `WEBAPP_URL`

Recommended:

- `RESEND_API_KEY`
- `SUPPORT_EMAIL`

Optional Telegram keys:

- `TELEGRAM_BOT_TOKEN`
- `BOT_PORT`
- `USE_WEBHOOK`
- `WEBHOOK_URL`

## Dev-only scripts

These scripts are intentionally separated from the normal runtime because they modify demo data:

```bash
npm run seed:dev
npm run delete-students:dev
```

They should only be used in local development databases.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the VPS deployment flow and CI/CD setup.
