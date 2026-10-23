"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, FileSpreadsheet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DietBadge, MemberBadge, TicketTypeBadge } from "@/components/attendee-badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { parseWorkbook } from "@/lib/excel";
import {
  computeNewRows,
  countByStudent,
  findWarnings,
  type ExistingTicket,
  type RowError,
  type TicketRow,
} from "@/lib/tickets";

const BATCH_SIZE = 5;
// Gmail daily limit / throttling / bad login: every further attempt would fail too.
const FATAL_SMTP = /5\.4\.5|Daily user sending limit|454|Too many login attempts|Invalid login|5\.7\.8|GMAIL_USER/i;
const GMAIL_DAILY_SAFE_LIMIT = 450;

type Preview = {
  fileName: string;
  rows: TicketRow[];
  newRows: TicketRow[];
  errors: RowError[];
  warnings: string[];
  unsentCount: number;
  sentLast24h: number;
};

type SendItem = {
  id: string;
  name: string;
  email: string;
  status: "pending" | "sent" | "failed";
  error?: string;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    window.location.replace("/login"); // full reload: drop all client state
    throw new Error("Logged out. Please log in again");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export function SendTickets({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [items, setItems] = useState<SendItem[] | null>(null);
  const [sending, setSending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const sendStarted = useRef(false); // blocks double taps before React re-renders

  // Warn before closing the tab mid-send.
  useEffect(() => {
    if (!sending) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [sending]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    setPreview(null);
    setItems(null);
    try {
      const parsed = parseWorkbook(new Uint8Array(await file.arrayBuffer()));
      const res = await fetch(`/api/events/${eventId}/tickets`);
      const info = await res.json();
      if (!res.ok) throw new Error(info.error ?? "Could not load existing tickets");
      const existing = info.existing as ExistingTicket[];
      const newRows = parsed.errors.length
        ? []
        : computeNewRows(parsed.rows, countByStudent(existing.map((t) => t.studentId)));
      setPreview({
        fileName: file.name,
        rows: parsed.rows,
        errors: parsed.errors,
        newRows,
        warnings: parsed.errors.length ? [] : findWarnings(parsed.rows, newRows, existing),
        unsentCount: info.unsentCount,
        sentLast24h: info.sentLast24h,
      });
    } catch (e) {
      toast.error(`Could not read file: ${(e as Error).message}`);
    } finally {
      setLoading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function send() {
    if (!preview || sendStarted.current) return;
    sendStarted.current = true;
    setConfirmOpen(false);
    setSending(true);
    try {
      const { unsent } = await postJson<{ unsent: { id: string; name: string; email: string }[] }>(
        `/api/events/${eventId}/tickets`,
        { rows: preview.rows }
      );
      let list: SendItem[] = unsent.map((t) => ({ ...t, status: "pending" }));
      setItems(list);

      for (let i = 0; i < list.length; i += BATCH_SIZE) {
        const batch = list.slice(i, i + BATCH_SIZE);
        let results: { id: string; ok: boolean; error?: string }[];
        let fatal: string | null = null;
        try {
          ({ results } = await postJson<{ results: typeof results }>("/api/tickets/send", {
            ticketIds: batch.map((b) => b.id),
          }));
          fatal = results.find((r) => !r.ok && r.error && FATAL_SMTP.test(r.error))?.error ?? null;
        } catch (e) {
          results = batch.map((b) => ({ id: b.id, ok: false, error: (e as Error).message }));
          if (FATAL_SMTP.test((e as Error).message)) fatal = (e as Error).message;
        }
        list = list.map((item) => {
          const r = results.find((x) => x.id === item.id);
          return r ? { ...item, status: r.ok ? "sent" : "failed", error: r.error } : item;
        });
        setItems(list);
        if (fatal) {
          toast.error(`Stopped sending: ${fatal}`, { duration: 15000 });
          break;
        }
      }

      const failed = list.filter((x) => x.status === "failed").length;
      if (failed) toast.error(`${failed} email(s) failed. Re-upload the sheet to retry them.`);
      else toast.success(`Sent ${list.length} ticket(s)`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
      setPreview(null);
      sendStarted.current = false;
    }
  }

  // ---- Sending / done ----
  if (items) {
    const done = items.filter((x) => x.status !== "pending").length;
    const sent = items.filter((x) => x.status === "sent").length;
    const failed = items.filter((x) => x.status === "failed").length;
    return (
      <div className="grid gap-4">
        <Card>
          <CardContent className="grid gap-3">
            <div className="text-lg font-semibold">
              {sending ? `Sending ${done} / ${items.length}…` : "Finished"}
            </div>
            <Progress value={items.length ? (done / items.length) * 100 : 100} />
            <div className="text-sm text-muted-foreground">
              {sent} sent · {failed} failed
              {sending && " · keep this page open and the screen on"}
            </div>
          </CardContent>
        </Card>
        {items.length === 0 && <p className="text-muted-foreground">Nothing to send.</p>}
        <ul className="grid gap-1">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
              {it.status === "pending" && <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
              {it.status === "sent" && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />}
              {it.status === "failed" && <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" />}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{it.name}</div>
                <div className="truncate text-muted-foreground">{it.email}</div>
                {it.error && <div className="text-red-700 break-words">{it.error}</div>}
              </div>
            </li>
          ))}
        </ul>
        {!sending && (
          <Link href={`/events/${eventId}`} className={buttonVariants({ className: "h-12 text-base" })}>
            Back to event
          </Link>
        )}
      </div>
    );
  }

  const toSend = preview ? preview.newRows.length + preview.unsentCount : 0;
  const overGmailLimit = preview && preview.sentLast24h + toSend > GMAIL_DAILY_SAFE_LIMIT;

  return (
    <div className="grid gap-4">
      {/* ---- Upload ---- */}
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center hover:bg-muted">
        <FileSpreadsheet className="size-8 text-muted-foreground" />
        <span className="font-medium">{loading ? "Reading…" : preview ? "Choose a different file" : "Choose Excel file (.xlsx)"}</span>
        <span className="text-xs text-muted-foreground">
          Columns: Student ID, Name, Purchaser Email, Dietary requirements, Membership,
          optional Ticket Type (dietary, membership and ticket type may be blank)
        </span>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          disabled={loading || sending}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>

      {/* ---- Errors block the upload ---- */}
      {preview && preview.errors.length > 0 && (
        <Alert variant="destructive">
          <XCircle />
          <AlertTitle>Fix these problems in the sheet and upload it again</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 grid gap-1">
              {preview.errors.slice(0, 100).map((e, i) => (
                <li key={i}>
                  {e.row > 0 && <strong>Row {e.row}: </strong>}
                  {e.message}
                </li>
              ))}
              {preview.errors.length > 100 && <li>…and {preview.errors.length - 100} more</li>}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* ---- Preview ---- */}
      {preview && preview.errors.length === 0 && (
        <>
          <Card>
            <CardContent className="grid gap-1 text-sm">
              <div className="mb-1 truncate font-medium">{preview.fileName}</div>
              <Row label="Rows in sheet" value={preview.rows.length} />
              <Row label="Already have tickets (skipped)" value={preview.rows.length - preview.newRows.length} />
              <Row label="New tickets" value={preview.newRows.length} />
              {preview.unsentCount > 0 && (
                <Row label="Earlier unsent / failed (will retry)" value={preview.unsentCount} />
              )}
            </CardContent>
          </Card>

          {preview.warnings.length > 0 && (
            <Alert className="border-amber-300 bg-amber-50 text-amber-950">
              <AlertTriangle />
              <AlertTitle>Check these rows (they look edited since the last upload)</AlertTitle>
              <AlertDescription className="text-amber-900">
                <ul className="mt-1 grid gap-1">
                  {preview.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
                <p className="mt-2">
                  You can still send. To fix an existing ticket, edit it in Supabase.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {overGmailLimit && (
            <Alert>
              <AlertTitle>Close to Gmail’s daily limit</AlertTitle>
              <AlertDescription>
                {preview.sentLast24h} emails were sent in the last 24 hours. Gmail allows about 500
                a day; sending {toSend} more may fail part way. Failed ones can be retried tomorrow by
                re-uploading.
              </AlertDescription>
            </Alert>
          )}

          {preview.newRows.length > 0 && (
            <ul className="grid gap-1">
              {preview.newRows.map((r, i) => (
                <li key={i} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{r.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{r.studentId}</span>
                  </div>
                  <div className="truncate text-muted-foreground">{r.email}</div>
                  <div className="mt-1 flex gap-1">
                    <DietBadge value={r.dietaryRequirements} />
                    <MemberBadge value={r.membership} />
                    <TicketTypeBadge value={r.ticketType} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="sticky bottom-0 -mx-4 border-t bg-background p-4">
            <Button
              className="h-12 w-full text-base"
              disabled={toSend === 0 || sending}
              onClick={() => setConfirmOpen(true)}
            >
              {toSend === 0 ? "Nothing new to send" : `Confirm & send ${toSend} ticket${toSend === 1 ? "" : "s"}`}
            </Button>
          </div>

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send {toSend} ticket email{toSend === 1 ? "" : "s"}?</DialogTitle>
                <DialogDescription>
                  Emails for “{eventName}” go out immediately and can’t be unsent.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" className="h-11" />}>Cancel</DialogClose>
                <Button className="h-11" onClick={send}>
                  Send now
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
