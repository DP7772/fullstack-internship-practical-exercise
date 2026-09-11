# Decisions

## SLA calculation

- SLA targets are defined in `server/src/config.js`.
- P1 has a 4-hour SLA.
- P2 has a 24-hour SLA.
- P3 has a 72-hour SLA.
- SLA uses elapsed hours on a 24/7 basis. No business-hours calendar is applied.
- SLA starts from the ticket `created_at` timestamp.
- The SLA deadline is derived from `created_at + priority SLA hours`.
- The deadline is calculated by the backend rather than stored as a separate database field.

## First response

- The SLA measures the first staff response.
- A comment from an `agent` or `admin` is treated as a staff response.
- A requester comment does not count as the first staff response.
- If staff responds before or exactly at the SLA deadline, the ticket is not breached.
- If staff responds after the SLA deadline, the ticket is breached.
- If there is no staff response and the current time has passed the SLA deadline, the ticket is breached.

## Frontend and backend responsibilities

- The backend calculates `sla_deadline` and `breached`.
- The frontend does not calculate SLA state.
- The ticket list and ticket detail display the backend-provided SLA state.
- `breached=true` is handled as a server-side filter.
- The frontend only sends the filter value through the API.

## SLA badge

- A breached ticket is displayed with a red `SLA Breached` badge.
- A ticket still within its SLA is displayed with a `Within SLA` badge.