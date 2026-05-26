# Public Zero-Config Timing Design

## Goal

Make jjcs usable from any phone network through one public HTTPS URL, while keeping normal users away from server configuration and keeping admin visibility over active rooms and devices.

## Product Shape

The public app should behave like a field tool, not an IT setup page. A starter opens the app, chooses the start role, and receives ready-to-share links for finish and results devices. Finish and results devices open those links with `role` and `room` query parameters, join the correct room automatically, and only interact with race-specific controls.

Administrators keep a separate `/admin` surface. When `ADMIN_TOKEN` is configured, admin-only actions and live monitoring use the stored admin token. Normal race users never need that token.

## Timing And Accuracy

All devices connect to the same public server over HTTPS and WebSocket. Each client keeps using the existing lightweight clock calibration against `/ping`, then exchanges race events through the server room. The live room snapshot stores connection metadata so later phases can show network health and flag high-latency devices.

This does not turn the system into a certified photo-finish device. It improves operational reliability and creates the monitoring foundation needed for serious event use.

## Scope For This Iteration

- Remove the ordinary user's need to enter a server address.
- Support `?role=finish&room=1234` and `?role=observer&room=1234` links.
- Generate shareable finish/results links from the start device.
- Add server-side live room snapshots for admin monitoring.
- Show active rooms/devices in the admin overview.
- Document the long-term deployment requirement: fixed domain, HTTPS, WebSocket-capable Node hosting, persistent data directory, and admin token.

## Out Of Scope

- Certified timing guarantees.
- Database migration from JSON storage.
- Local QR generation library.
- Identity accounts for every school.
