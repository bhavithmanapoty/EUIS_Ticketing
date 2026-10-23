// Pure ticket-row logic shared by the browser (preview) and server (insert).

export type TicketRow = {
  studentId: string;
  name: string;
  email: string;
  dietaryRequirements: string;
  membership: string;
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

export const COLUMN_LABELS: Record<keyof TicketRow, string> = {
  studentId: "Student ID",
  name: "Name",
  email: "Purchaser Email",
  dietaryRequirements: "Dietary requirements",
  membership: "Membership",
};

// Exactly one plain address: rejects "a@x.com,b@y.com", "a@x.com; b@y.com",
// "Name <a@x.com>" which nodemailer would treat as several/other recipients.
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

export const MAX_ROWS = 1000;

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
    for (const { field } of COLUMNS) {
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
