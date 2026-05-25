# jjcs Productization Roadmap

## Phase 1: Stabilize The Prototype

- Fix branding and encoding issues across app, admin, PWA, and deployment scripts.
- Keep one documented primary deployment path.
- Add health checks, dependency audit, syntax checks, and basic automated tests.
- Add optional API token protection and CORS allowlisting.
- Document field-test limitations clearly.

## Phase 2: Make Results Durable

- Replace mixed `localStorage` and JSON storage with a single database-backed model. The current `DATA_DIR` and `/api/backup` support are an interim safety layer, not the final storage architecture.
- Introduce meets, events, heats/groups, athletes, results, and audit logs as first-class records.
- Make admin pages read from the server, not only from the current browser.
- Add import/export flows for athlete rosters and official result sheets.

## Phase 3: Make Field Operation Reliable

- Add a pre-race device checklist for camera, microphone, latency, room sync, and finish-line calibration.
- Save finish-frame evidence for every detected crossing.
- Add manual review states: pending, confirmed, corrected, DNF, DNS, false trigger.
- Improve reconnection behavior and show operator-facing warnings for stale devices.

## Phase 4: Prepare For Real Customers

- Add authentication, roles, organizations, and per-meet permissions.
- Add cloud deployment, backups, and monitoring.
- Add public result pages and shareable meet links.
- Package a repeatable on-site setup guide for schools and clubs.

## Timing Accuracy Positioning

Until hardware timing, calibrated camera workflows, and repeatable validation are complete, jjcs should be positioned as a training and lightweight-event timing assistant, not as a certified official timing system.
