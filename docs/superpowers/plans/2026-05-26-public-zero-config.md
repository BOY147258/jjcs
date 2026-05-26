# Public Zero-Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first public-use flow where ordinary users join by link and admins can see active rooms.

**Architecture:** Keep one Node service as the authority for static files, REST, WebSocket rooms, clock sync, and admin monitoring. Add small client helpers inside the existing browser app instead of restructuring the timing core. Expose live room state from the WebSocket room map through an admin-protected endpoint.

**Tech Stack:** Node.js, native browser modules, WebSocket `ws`, existing JSON data store, `node:test`.

---

### Task 1: Live Room Snapshot Model

**Files:**
- Create: `lib/live-rooms.js`
- Test: `tests/live-rooms.test.js`

- [x] Add `buildLiveRoomSnapshot(rooms, now)` that converts the server room map into serializable room summaries.
- [x] Test role counts, client metadata, and empty room behavior with `node --test tests/live-rooms.test.js`.

### Task 2: Admin Live Rooms Endpoint

**Files:**
- Modify: `serve.js`
- Test: `tests/live-rooms.test.js`

- [x] Track `joinedAt`, `lastSeenAt`, and message count per WebSocket client.
- [x] Add `GET /api/live-rooms`.
- [x] Protect it with `ADMIN_TOKEN` when the token is configured.

### Task 3: Zero-Config Public Links

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `css/app.css`

- [x] Replace the visible server address control with copyable finish/results links.
- [x] Parse `role` and `room` query parameters.
- [x] Auto-select and join linked finish/results devices without asking for server details.

### Task 4: Admin Monitoring UI

**Files:**
- Modify: `admin.html`
- Modify: `js/admin.js`

- [x] Add active-room cards in overview.
- [x] Fetch `/api/live-rooms` with stored admin headers.
- [x] Show room code, role counts, connected devices, joined time, last seen time, and message count.

### Task 5: Verification And Publish

**Files:**
- Modify: `README.md`

- [x] Document public deployment and user flow.
- [x] Run `npm run check`.
- [x] Run full browser JS syntax checks.
- [x] Smoke test local HTTP and public tunnel.
- [ ] Commit and push to `origin/main`.
