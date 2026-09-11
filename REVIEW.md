# Part 1 — Code Review

## Scope

Reviewed the Meridian Helpdesk application with focus on:
- tenant isolation
- authentication and authorization
- data integrity
- security
- application behaviour

The findings below are ranked from highest to lowest risk.

## Ranked Findings

| Rank | Finding | Severity | Status |
|------|---------|----------|--------|
| 1 | Cross-organisation ticket access | Critical | FIXED |
| 2 | Cross-organisation ticket assignment | Critical | FIXED |
| 3 | Plaintext password storage during invite acceptance | Critical | FIXED |
| 4 | Unauthorized ticket deletion | Critical | FIXED |
| 5 | Stored XSS in ticket comments | High | FIXED |
| 6 | Unsafe dynamic ORDER BY | High | Not fixed |
| 7 | Ticket filters/search/sort do not reload | Medium | Not fixed |

---

## 1. Cross-organisation ticket access

**Severity:** Critical  
**Status:** FIXED

**Where:**  
`server/src/routes/tickets.js:33` — `const ticket = await`  
`server/src/services/ticketService.js:57` — `getTicketById()`

**What is wrong:**  
The ticket detail query looks up a ticket using only its ID and does not restrict the result to the authenticated user's organisation.

**Why it matters here:**  
Northwind Trading and Cobalt Logistics are separate customers. An authenticated user who knows another organisation's ticket ID can retrieve that ticket and its comments.

**How to fix:**  
Pass the authenticated user's `orgId` into the ticket lookup and require both the ticket ID and organisation ID:

```sql
WHERE t.id = ? AND t.org_id = ?
```
This ensures that a user can only access tickets belonging to their own organisation.


## 2. Cross-organisation ticket assignment

**Severity:** Critical  
**Status:** FIXED

**Where:**  
`server/src/routes/tickets.js:67` — `const result = await`  
`server/src/services/ticketService.js:89` — `assignTicket()`

**What is wrong:**  
The assignment API checks the ticket only by its ID. It does not verify that the ticket belongs to the logged-in user's organisation before assigning it.

**Why it matters here:**  
Northwind Trading and Cobalt Logistics are separate customers. An agent could send another organisation's ticket ID and assign that ticket to themselves.

**How to fix:**  
Pass the logged-in user's `orgId` to `assignTicket()` and make sure the ticket belongs to that organisation before updating it.


## 3. Plaintext password storage during invite acceptance

**Severity:** Critical  
**Status:** FIXED

**Where:**  
`server/src/routes/auth.js:49` — `await query('UPDATE users`  


**What is wrong:**  
The password received during invite acceptance is directly stored in the `password_hash` column without hashing.

**Why it matters here:**  
If the database is accessed, the user's actual password would be exposed. Also, the login code uses `bcrypt.compare()`, which expects a bcrypt hash.

**How to fix:**  
Hash the password using bcrypt before saving it.


## 4. Unauthorized ticket deletion

**Severity:** Critical  
**Status:** FIXED

**Where:**  
`server/src/routes/tickets.js:82` — `router.delete('/:id'`  


**What is wrong:**  
The delete endpoint only checks whether the user is logged in. It does not check whether the user has the required `admin` role.

**Why it matters here:**  
According to the application rules, only admins can delete tickets. Currently, a requester or agent can directly call the DELETE API and delete a ticket.

**How to fix:**  
Require the `admin role` on the delete endpoint and scope the ticket lookup to the authenticated user's organisation. This ensures that only an admin can delete a ticket and only when the ticket belongs to the admin's own organisation.


## 5. Stored XSS — Ticket Comments

**Severity:** Critical  
**Status:** FIXED

**Where:**  
`client/src/features/tickets/TicketDetail.jsx:65` — `<div dangerouslySetInnerHTML={{ __html: c.body }} />`  


**What is wrong:**  
Ticket comments are rendered using `dangerouslySetInnerHTML`, which treats the comment body as HTML instead of plain text. A malicious user could store HTML or JavaScript content in a comment, which could execute when another user opens the ticket.

**Why it matters here:**  
Ticket comments are user-controlled content and can be viewed by other users. An attacker could submit a malicious comment and potentially execute JavaScript in another user's browser when the ticket is opened.

**How to fix:**  
Render the comment body as normal React text instead of using `dangerouslySetInnerHTML:`

<div>{c.body}</div>

This makes React escape HTML characters and prevents the comment content from being interpreted as executable HTML.


## 6. Unsafe Dynamic SQL in Ticket Sorting

**Severity:** High 
**Status:** NOT FIXED — Documented only

**Where:**  
`server/src/services/ticketService.js` — `listTickets()
ORDER BY t.${sortBy} ${order}`  


**What is wrong:**  
The `sortBy` and `order` values come from request query parameters and are directly inserted into the SQL query. They are not restricted to a known list of allowed column names and sort directions.

**Why it matters here:**  
A user can control these query parameters through the ticket list API. Since the values are inserted directly into the SQL statement, unexpected SQL fragments could affect the generated query and create a SQL injection risk.

**How to fix:**  
Use an allowlist for the supported sort fields and sort directions. For example, allow only created_at, updated_at, priority, and status for sortBy, and only asc or desc for order.


## 7. Ticket Filters and Sorting Do Not Reload the List

**Severity:** Medium  
**Status:** NOT FIXED — Documented only

**Where:**  
`client/src/features/tickets/TicketList.jsx` — ticket list useEffect() 


**What is wrong:**  
The ticket list request is triggered only when the page changes. The effect does not depend on the search, status, priority, or sorting values used by the request.

**Why it matters here:**  
When a user changes a filter, search term, or sort option, the ticket list can continue showing the previous results because no new API request is made.

**How to fix:**  
Include the ticket search, filter, and sorting values in the useEffect dependency list so that changing them triggers a new request. The page can also be reset when a new filter or search is selected.



`Review Summary`

The review identified seven issues in the existing application.

The five highest-priority issues were fixed:

1. Cross-organisation ticket access
2. Cross-organisation ticket assignment
3. Plaintext password storage during invite acceptance
4. Unauthorized ticket deletion
5. Stored XSS in ticket comments

The remaining two issues were documented but intentionally not fixed as part of the top-five scope:

6. Unsafe dynamic SQL in ticket sorting
7. Ticket filters and sorting not reloading the list
