# jjcs Public Deployment Guide

This guide is for a long-running public jjcs service with a fixed HTTPS domain.

## Recommended Architecture

- One Node.js web service serving the app, REST API, `/ping`, and WebSocket `/ws`.
- One fixed HTTPS domain, for example `https://jjcs.example.com`.
- One persistent data directory for JSON storage while the product is still in MVP storage mode.
- One administrator token for `/admin` write actions and live operational monitoring.

Do not use `localhost`, LAN IPs, GitHub Pages, or temporary tunnels for real school usage. Phones on different networks need the same public HTTPS origin.

## Render Deployment

Render is the quickest hosted path for the current codebase because it supports Node web services, WebSocket connections, custom domains, and persistent disks.

One-click entry:

```text
https://render.com/deploy?repo=https://github.com/BOY147258/jjcs
```

1. Push the latest `main` branch to GitHub.
2. In Render, create a new Blueprint from this repository.
3. Use the included `render.yaml`.
4. Set `ADMIN_TOKEN` to a strong private value when Render asks for secret environment variables.
5. Leave `ALLOWED_ORIGINS` empty for same-origin app/API usage, or set it to the final domain, for example `https://jjcs.example.com`.
6. Deploy.
7. Open `/ping` on the Render URL and confirm it returns JSON.
8. Open `/admin`, save the admin token, and check the online-room panel.

The default Blueprint uses Render's free plan so a pilot can be created without payment information. Free services can spin down when idle and their filesystem is not durable. Before real events, upgrade the service plan and add a persistent disk:

- name: `jjcs-data`
- mount path: `/opt/render/project/src/data`
- size: `1 GB` to start
- environment variable: `DATA_DIR=/opt/render/project/src/data`

The service is configured for Singapore by default because most expected early use is in China-adjacent time zones. Change `region` in `render.yaml` if your users are closer to another region.

## Custom Domain

After the Render service is live:

1. Add your custom domain in the Render service settings.
2. Add the DNS record requested by Render at your domain provider.
3. Wait for HTTPS certificate provisioning to finish.
4. Use the custom domain as the only public user link.

The ordinary user flow is:

1. Start device opens the public app URL.
2. Start device chooses "发令端".
3. Start device sends the generated finish/results links to other phones.
4. Finish/results phones open the links and join the correct room automatically.

## Docker / Other Clouds

The included `Dockerfile` runs jjcs on port `8080` and stores data in `/data`.

Required environment variables:

```text
NODE_ENV=production
PORT=8080
DATA_DIR=/data
ADMIN_TOKEN=<strong private token>
MAX_WS_MESSAGE_BYTES=65536
```

Mount a persistent volume at `/data`. The platform must support WebSocket upgrades and HTTPS.

## Operations Checklist

- Keep `ADMIN_TOKEN` private.
- Back up `/api/backup` after events.
- Keep the service region close to the schools using it.
- Watch `/admin` during events for online rooms and device counts.
- Treat high latency, disconnects, or missing finish devices as a race-operation warning.
- Do not market the current MVP as certified electronic timing.
