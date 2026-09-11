import { query } from '../db/pool.js';
import { config } from '../config.js';

const PAGE_SIZE = 20;

/**
 * Paginated ticket list for the current organisation.
 *
 * Supports free-text search on subject, filtering by status and priority,
 * and sorting by any column the UI exposes in its dropdown.
 */
export async function listTickets({
  orgId,
  page = 1,
  search = '',
  status,
  priority,
  sortBy = 'created_at',
  order = 'desc',
  breached
}) {
  const where = ['t.org_id = ?'];
  const params = [orgId];

  if (search) {
    where.push('t.subject LIKE ?');
    params.push(`%${search}%`);
  }

  if (status) {
    where.push('t.status = ?');
    params.push(status);
  }

  if (priority) {
    where.push('t.priority = ?');
    params.push(priority);
  }

  const whereSql = where.join(' AND ');

  const rows = await query(
    `SELECT t.id, t.subject, t.status, t.priority, t.created_at, t.updated_at,
            t.assignee_id, u.name AS assignee_name, r.name AS requester_name
       FROM tickets t
       LEFT JOIN users u ON u.id = t.assignee_id
       JOIN users r ON r.id = t.requester_id
      WHERE ${whereSql}
      ORDER BY t.${sortBy} ${order}`,
    params
  );

  for (const row of rows) {
    const [{ c }] = await query(
      'SELECT COUNT(*) AS c FROM comments WHERE ticket_id = ?',
      [row.id]
    );

    row.comment_count = c;

    await addSlaState(row);
  }

  const filteredRows =
    breached === 'true'
      ? rows.filter((row) => row.breached)
      : rows;

  const total = filteredRows.length;

  const offset = (page - 1) * PAGE_SIZE;

  const paginatedRows = filteredRows.slice(
    offset,
    offset + PAGE_SIZE
  );

  return {
    rows: paginatedRows,
    total,
    page,
    pageSize: PAGE_SIZE
  };
}

export async function getTicketById(id, orgId) {
  const rows = await query(
    `SELECT t.*, u.name AS assignee_name, r.name AS requester_name, r.email AS requester_email
       FROM tickets t
       LEFT JOIN users u ON u.id = t.assignee_id
       JOIN users r ON r.id = t.requester_id
      WHERE t.id = ? AND t.org_id = ?`,
    [id, orgId]
  );

  if (!rows[0]) return null;

  await addSlaState(rows[0]);

  return rows[0];
}

export async function listComments(ticketId) {
  return query(
    `SELECT c.id, c.body, c.is_internal, c.created_at, u.name AS author_name, u.role AS author_role
       FROM comments c
       JOIN users u ON u.id = c.author_id
      WHERE c.ticket_id = ?
      ORDER BY c.created_at ASC`,
    [ticketId]
  );
}

export async function createTicket({ orgId, subject, body, priority, requesterId }) {
  const result = await query(
    `INSERT INTO tickets (org_id, subject, body, priority, requester_id)
     VALUES (?, ?, ?, ?, ?)`,
    [orgId, subject, body, priority, requesterId]
  );
 return getTicketById(result.insertId, orgId);
}

export async function assignTicket(ticketId, assigneeId, orgId) {
  const ticket = await getTicketById(ticketId, orgId);
  if (!ticket) return null;

  if (ticket.assignee_id) {
    return { conflict: true, ticket };
  }

  const [agent] = await query(
    'SELECT id, name FROM users WHERE id = ? AND org_id = ?',
    [assigneeId, orgId]
  );

  await query(
    'UPDATE tickets SET assignee_id = ?, status = ? WHERE id = ? AND org_id = ?',
    [assigneeId, 'pending', ticketId, orgId]
  );

  return {
    conflict: false,
    assignedTo: agent,
    ticket: await getTicketById(ticketId, orgId)
  };
}

export async function deleteTicket(id) {
  await query('DELETE FROM tickets WHERE id = ?', [id]);
}


function calculateSlaDeadline(createdAt, priority) {
  const hours = config.slaTargets[priority] ?? config.slaTargets.P3;

  return new Date(
    new Date(createdAt).getTime() + hours * 60 * 60 * 1000
  );
}

async function getFirstStaffResponse(ticketId) {
  const rows = await query(
    `SELECT c.created_at
       FROM comments c
       JOIN users u ON u.id = c.author_id
      WHERE c.ticket_id = ?
        AND u.role IN ('agent', 'admin')
      ORDER BY c.created_at ASC
      LIMIT 1`,
    [ticketId]
  );

  return rows[0]?.created_at || null;
}

async function addSlaState(ticket) {
  const slaDeadline = calculateSlaDeadline(
    ticket.created_at,
    ticket.priority
  );

  const firstStaffResponse = await getFirstStaffResponse(ticket.id);

  const comparisonTime = firstStaffResponse
    ? new Date(firstStaffResponse)
    : new Date();

  ticket.sla_deadline = slaDeadline;
  ticket.breached = comparisonTime >= slaDeadline;

  return ticket;
}