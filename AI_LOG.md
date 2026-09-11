# AI Log

AI assistance was used during the development of this practical exercise for code review, identifying security issues, discussing implementation approaches, and debugging.

## AI Assistant Used

- **AI Assistant:** ChatGPT

## Part 1 — Code Review

AI was used to help review the existing codebase and identify potential issues.

The review helped identify:
1. Cross-organisation ticket access
2. Cross-organisation ticket assignment
3. Plaintext password storage during invite acceptance
4. Unauthorized ticket deletion
5. Stored XSS in ticket comments
6. Unsafe dynamic SQL in ticket sorting
7. Ticket filters and sorting not reloading the list

Only the five highest-priority issues were fixed as required by the assignment. The remaining two were documented in `REVIEW.md` and intentionally left unfixed.

AI suggestions were reviewed against the existing code before implementation.

## Part 2 — SLA Breach Tracking

AI was used to discuss the SLA calculation and implementation approach.

The implemented decisions were:
- P1 SLA = 4 hours
- P2 SLA = 24 hours
- P3 SLA = 72 hours
- SLA starts from the ticket `created_at` timestamp.
- The backend calculates the SLA deadline and breach state.
- The first response from an agent or admin counts as the staff response.
- Requester comments do not count as a staff response.
- A response exactly at the deadline is considered within SLA.
- A response after the deadline is considered breached.
- If there is no staff response, the current time is compared with the SLA deadline.
- `breached=true` is handled as a backend filter.
- The frontend displays the SLA state provided by the backend.

## Validation

AI-generated suggestions were not accepted blindly. The existing code, application behaviour, and assignment requirements were considered before making changes.

Final implementation and decisions were reviewed manually.