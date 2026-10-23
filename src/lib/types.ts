export type EventRecord = {
  id: string;
  name: string;
  event_date: string; // YYYY-MM-DD
  created_at: string;
};

export type TicketRecord = {
  id: string;
  event_id: string;
  student_id: string;
  name: string;
  email: string;
  dietary_requirements: string;
  membership: string;
  ticket_type: string | null;
  email_sent_at: string | null;
  email_error: string | null;
  send_claimed_at: string | null;
  checked_in_at: string | null;
  created_at: string;
};

/** Ticket details shown to door staff. */
export type AttendeeDetails = {
  id: string;
  name: string;
  studentId: string;
  dietaryRequirements: string;
  membership: string;
  ticketType: string | null;
};

export type VerifyResult =
  | { status: "INVALID" }
  | { status: "WRONG_EVENT"; eventName: string; attendee: AttendeeDetails }
  | { status: "ALREADY_CHECKED_IN"; checkedInAt: string; attendee: AttendeeDetails }
  | { status: "VALID"; attendee: AttendeeDetails }
  | { status: "CHECKED_IN"; checkedInAt: string; attendee: AttendeeDetails };

export function toAttendee(t: TicketRecord): AttendeeDetails {
  return {
    id: t.id,
    name: t.name,
    studentId: t.student_id,
    dietaryRequirements: t.dietary_requirements,
    membership: t.membership,
    ticketType: t.ticket_type,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
