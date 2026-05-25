# jjcs 竞迹

jjcs is a browser-based athletics timing prototype for training sessions and lightweight meets. It provides start-device timing, finish-device video detection, observer results, WebSocket room sync, local result history, CSV/XLS export, and PWA installation.

## Current Status

This repository is a productization fork of a public prototype. It can run locally and can be deployed as a small Node service, but it should be treated as an MVP rather than a certified competition timing system.

Key constraints:

- Finish detection is pixel-motion based, not a trained computer-vision model.
- Local browser storage is still used for part of the results workflow.
- Server-side storage currently uses JSON files under `data/`.
- Authentication is optional and must be enabled before public production use.
- No official timing certification is implied.

## Quick Start

```bash
npm install
npm run dev
```

Open:

- App: `http://localhost:8080`
- Admin: `http://localhost:8080/admin`
- Health: `http://localhost:8080/ping`

Camera and microphone access normally require HTTPS on phones. For local field testing, use either localhost, a trusted HTTPS reverse proxy, or local certificates in `certs/key.pem` and `certs/cert.pem`.

## Scripts

```bash
npm run dev        # full app: static files, REST API, WebSocket
npm start          # same as dev, intended for deployment
npm run ws         # WebSocket-only server for split static hosting
npm test           # node:test suite
npm run check      # syntax checks plus tests
npm run audit:prod # production dependency audit
```

## Configuration

Copy `.env.example` to `.env` for local reference. The app reads environment variables directly when launched.

Important variables:

- `PORT`: HTTP port, default `8080`.
- `HTTPS_PORT`: HTTPS port when local certificates exist, default `8443`.
- `DATA_DIR`: server-side JSON data directory, default `./data`.
- `ADMIN_TOKEN`: optional token protecting mutating API calls.
- `ALLOWED_ORIGINS`: optional comma-separated CORS allowlist.
- `MAX_WS_MESSAGE_BYTES`: inbound WebSocket payload limit.

## Deployment Shape

Recommended first production shape:

1. Run `node serve.js` as one service.
2. Put it behind HTTPS.
3. Set `ADMIN_TOKEN`.
4. Set `ALLOWED_ORIGINS` to the deployed app origin.
5. Back up the `data/` directory until the storage layer is replaced.

The `docs/` folder exists for GitHub Pages/static hosting compatibility. The full Node server is the simpler path while the product is still evolving.

## Data And Backups

The current server storage is JSON based. Core records live in:

- `meets.json`
- `events.json`
- `athletes.json`
- `results.json`

By default these files are stored in `./data`. Set `DATA_DIR` to move them elsewhere, for example to a mounted disk on a server.

Download a complete JSON backup:

```text
GET /api/backup
```

The backup contains all core collections and is intended for manual safekeeping and future database migration. Do not rely on browser `localStorage` as the only copy of official results.

## Product Roadmap

See [ROADMAP.md](ROADMAP.md).

## Provenance And Licensing

See [PROVENANCE.md](PROVENANCE.md) before treating this as a commercial product.
