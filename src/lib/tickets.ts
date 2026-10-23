// Pure ticket-row logic shared by the browser (preview) and server (insert).

export type TicketRow = {
  studentId: string;
  name: string;
  email: string;
  dietaryRequirements: string;
  membership: string;
  /** Optional column; "" when the column is absent or the cell is blank. */
  ticketType: string;
};

export type RowError = { row: number; message: string };

/** Spreadsheet headers (normalised to lowercase, single spaces) -> fields. */
export const COLUMNS: { header: string; field: keyof TicketRow }[] = [
  { header: "student id", field: "studentId" },
  { header: "name", field: "name" },
  { header: "purchaser email", field: "email" },
  { header: "dietary requirements", field: "dietaryRequirements" },
  { header: "membership", field: "membership" },
];

/** Columns that may be missing from the sheet entirely. */
export const OPTIONAL_COLUMNS: { header: string; field: keyof TicketRow }[] = [
  { header: "ticket type", field: "ticketType" },
];

export const COLUMN_LABELS: Record<keyof TicketRow, string> = {
  studentId: "Student ID",
  name: "Name",
  email: "Purchaser Email",
  dietaryRequirements: "Dietary requirements",
  membership: "Membership",
  ticketType: "Ticket Type",
};

// Exactly one plain address: rejects "a@x.com,b@y.com", "a@x.com; b@y.com",
// "Name <a@x.com>" which nodemailer would treat as several/other recipients.
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

export const MAX_ROWS = 1000;

/** Fields that must be filled in; the others default to BLANK_VALUE. */
export const REQUIRED_FIELDS: (keyof TicketRow)[] = ["studentId", "name", "email"];
export const BLANK_VALUE = "None";

/** Trims all fields and fills blank optional ones with "None". */
export function normaliseRow(r: Partial<Record<keyof TicketRow, unknown>>): TicketRow {
  const get = (f: keyof TicketRow) => String(r[f] ?? "").trim();
  return {
    studentId: get("studentId"),
    name: get("name"),
    email: get("email"),
    dietaryRequirements: get("dietaryRequirements") || BLANK_VALUE,
    membership: get("membership") || BLANK_VALUE,
    ticketType: get("ticketType"),
  };
}

export function normaliseHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Key used to count tickets per person; case-insensitive Student ID. */
export function studentKey(studentId: string): string {
  return studentId.trim().toUpperCase();
}

/**
 * Validates already-mapped rows. `firstRowNumber` is the spreadsheet row of
 * rows[0] so error messages point at the right line in Excel.
 */
export function validateRows(
  rows: TicketRow[],
  firstRowNumber = 2
): RowError[] {
  const errors: RowError[] = [];
  if (rows.length > MAX_ROWS) {
    errors.push({ row: 0, message: `Too many rows (max ${MAX_ROWS})` });
  }
  rows.forEach((r, i) => {
    const row = firstRowNumber + i;
    for (const field of REQUIRED_FIELDS) {
      if (!r[field]?.trim()) {
        errors.push({ row, message: `${COLUMN_LABELS[field]} is empty` });
      }
    }
    if (r.email?.trim() && !EMAIL_RE.test(r.email.trim())) {
      errors.push({ row, message: `Invalid email "${r.email}"` });
    }
  });
  return errors;
}

/**
 * Re-upload dedup: if the sheet has N rows for a Student ID and the event
 * already has M tickets for it, only the last N-M rows are new.
 */
export function computeNewRows(
  rows: TicketRow[],
  existingCounts: Record<string, number>
): TicketRow[] {
  const seen: Record<string, number> = {};
  return rows.filter((r) => {
    const key = studentKey(r.studentId);
    seen[key] = (seen[key] ?? 0) + 1;
    return seen[key] > (existingCounts[key] ?? 0);
  });
}

export function countByStudent(studentIds: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of studentIds) {
    const key = studentKey(id);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export type ExistingTicket = { studentId: string; email: string };

/**
 * Non-blocking preview warnings for rows that look edited since an earlier
 * upload (dedup only matches on Student ID, so these could otherwise lead to
 * a second valid ticket or a corrected email never getting one).
 */
export function findWarnings(
  rows: TicketRow[],
  newRows: TicketRow[],
  existing: ExistingTicket[]
): string[] {
  const warnings: string[] = [];
  const emailKey = (e: string) => e.trim().toLowerCase();
  const idsByEmail = new Map<string, Set<string>>();
  const emailsById = new Map<string, Set<string>>();
  for (const t of existing) {
    const id = studentKey(t.studentId);
    const email = emailKey(t.email);
    if (!idsByEmail.has(email)) idsByEmail.set(email, new Set());
    idsByEmail.get(email)!.add(id);
    if (!emailsById.has(id)) emailsById.set(id, new Set());
    emailsById.get(id)!.add(email);
  }

  // A new ticket going to an email that already has one under another Student ID
  // (e.g. a corrected Student ID) -> the person would hold two valid tickets.
  const warnedNew = new Set<string>();
  for (const r of newRows) {
    const id = studentKey(r.studentId);
    const others = [...(idsByEmail.get(emailKey(r.email)) ?? [])].filter((x) => x !== id);
    const key = `${id}|${emailKey(r.email)}`;
    if (others.length && !warnedNew.has(key)) {
      warnedNew.add(key);
      warnings.push(
        `${r.name} (${r.studentId}): ${r.email} already has a ticket under Student ID ${others.join(", ")}. They may get two tickets.`
      );
    }
  }

  // A Student ID that already has tickets, but the sheet now has an email that
  // none of them were sent to (e.g. a corrected email) -> the new address
  // won't get anything because the row is skipped.
  const warnedChanged = new Set<string>();
  for (const r of rows) {
    const id = studentKey(r.studentId);
    const known = emailsById.get(id);
    if (!known || known.has(emailKey(r.email)) || newRows.includes(r)) continue;
    const key = `${id}|${emailKey(r.email)}`;
    if (warnedChanged.has(key)) continue;
    warnedChanged.add(key);
    warnings.push(
      `${r.name} (${r.studentId}): email is now ${r.email}, but their existing ticket went to ${[...known].join(", ")}. The new address won't be emailed.`
    );
  }
  return warnings;
}
