# Backend Deployment

This backend can be deployed to the VPS at `185.209.228.62` using GitHub Actions.

## Target layout

The deploy pipeline uses:

- `/opt/coined/releases/<git-sha>` for each uploaded release
- `/opt/coined/current` as the active symlink
- `/opt/coined/shared/.env` for production secrets
- `/opt/coined/shared/uploads` for persistent uploaded files
- `/opt/coined/shared/logs` for logs

## One-time VPS setup

Run these on the server after cloning the backend repository once:

```bash
cd /opt
git clone https://github.com/nurmuhammad-fullstack/coined-backend coined-bootstrap
cd coined-bootstrap
chmod +x scripts/bootstrap-vps.sh
./scripts/bootstrap-vps.sh
```

Then edit:

```bash
nano /opt/coined/shared/.env
```

## Required production env

At minimum:

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=replace_me
PORT=5001
CLIENT_URL=https://coined.novdaunion.uz
WEBAPP_URL=https://coined.novdaunion.uz
```

Optional keys:

- `EMAIL_USER`
- `EMAIL_PASS`
- `TELEGRAM_BOT_TOKEN`
- `BOT_PORT`
- `USE_WEBHOOK`
- `WEBHOOK_URL`

## GitHub secrets

Set these in the backend repository settings:

- `VPS_HOST`
- `VPS_PORT`
- `VPS_USER`
- `VPS_SSH_PRIVATE_KEY`

Example values:

- `VPS_HOST`: `185.209.228.62`
- `VPS_PORT`: `22`
- `VPS_USER`: your deploy user on the VPS

## Domain

Backend API domain for this deployment:

- `https://api.coined.novdaunion.uz`

Frontend domain for this deployment:

- `https://coined.novdaunion.uz`

Use this in the Nginx config and SSL setup.

Set these backend env values to the frontend origin:

- `CLIENT_URL=https://coined.novdaunion.uz`
- `WEBAPP_URL=https://coined.novdaunion.uz`

## Deploy flow

Every push to `main` will:

1. Install dependencies in CI
2. Run syntax checks
3. Archive the backend source
4. Upload it to `/opt/coined/releases/<sha>`
5. Install production dependencies on the VPS
6. Start or reload the app with PM2

## PM2 commands

Useful commands on the VPS:

```bash
pm2 list
pm2 logs coined-backend
pm2 restart coined-backend
pm2 save
```
