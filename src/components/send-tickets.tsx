"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Clock,
  FileSpreadsheet,
  Info,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { DietBadge, MemberBadge, TicketTypeBadge } from "@/components/attendee-badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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

const BATCH_SIZE = 10; // one Gmail login per batch, so keep it at the server's MAX_BATCH
// Gmail daily limit / bad credentials: every further attempt would fail too.
const FATAL_SMTP = /5\.4\.5|Daily user sending limit|5\.7\.8|GMAIL_USER/i;
// Gmail login throttling: clears after a while, so wait and retry the batch.
const THROTTLED_SMTP = /454|4\.7\.0|Too many login attempts/i;
const RETRY_DELAYS_S = [60, 120, 240];
const GMAIL_DAILY_SAFE_LIMIT = 450;

type SendResult = { id: string; ok: boolean; error?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const [retryIn, setRetryIn] = useState<number | null>(null);
  const [stopped, setStopped] = useState<string | null>(null);
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
    setStopped(null);
    try {
      const { unsent } = await postJson<{ unsent: { id: string; name: string; email: string }[] }>(
        `/api/events/${eventId}/tickets`,
        { rows: preview.rows }
      );
      let list: SendItem[] = unsent.map((t) => ({ ...t, status: "pending" }));
      setItems(list);

      let stopReason: string | null = null;
      for (let i = 0; i < list.length && !stopReason; i += BATCH_SIZE) {
        let ids = list.slice(i, i + BATCH_SIZE).map((b) => b.id);
        for (let attempt = 0; ; attempt++) {
          let results: SendResult[];
          try {
            ({ results } = await postJson<{ results: SendResult[] }>("/api/tickets/send", {
              ticketIds: ids,
            }));
          } catch (e) {
            results = ids.map((id) => ({ id, ok: false, error: (e as Error).message }));
          }
          list = list.map((item) => {
            const r = results.find((x) => x.id === item.id);
            return r ? { ...item, status: r.ok ? "sent" : "failed", error: r.error } : item;
          });
          setItems(list);

          const errors = results.filter((r) => !r.ok).map((r) => r.error ?? "");
          const fatal = errors.find((e) => FATAL_SMTP.test(e));
          if (fatal) {
            stopReason = fatal;
            break;
          }
          const throttled = results.filter((r) => !r.ok && THROTTLED_SMTP.test(r.error ?? ""));
          if (throttled.length === 0) break;
          if (attempt >= RETRY_DELAYS_S.length) {
            stopReason = throttled[0].error!;
            break;
          }
          for (let s = RETRY_DELAYS_S[attempt]; s > 0; s--) {
            setRetryIn(s);
            await sleep(1000);
          }
          setRetryIn(null);
          // Retry only the throttled ones; failures already released their send claim.
          ids = throttled.map((r) => r.id);
          list = list.map((item) =>
            ids.includes(item.id) ? { ...item, status: "pending", error: undefined } : item
          );
          setItems(list);
        }
      }

      if (stopReason) {
        setStopped(stopReason);
        toast.error(`Stopped sending: ${stopReason}`, { duration: 15000 });
      }
      const notSent = list.filter((x) => x.status !== "sent").length;
      if (notSent) toast.error(`${notSent} email(s) not sent. Re-upload the sheet later to retry them.`);
      else toast.success(`Sent ${list.length} ticket(s)`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
      setRetryIn(null);
      setPreview(null);
      sendStarted.current = false;
    }
  }

  // ---- Sending / done ----
  if (items) {
    const done = items.filter((x) => x.status !== "pending").length;
    const sent = items.filter((x) => x.status === "sent").length;
    const failed = items.filter((x) => x.status === "failed").length;
    const notAttempted = sending ? 0 : items.length - done;
    return (
      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardContent className="grid gap-3">
            <div className="flex items-center gap-2 text-lg font-semibold text-navy">
              {sending ? (
                <Loader2 className="size-5 animate-spin text-saffron-ink" />
              ) : failed || notAttempted ? (
                <AlertTriangle className="size-5 text-amber-600" />
              ) : (
                <CheckCircle2 className="size-5 text-success" />
              )}
              {sending
                ? retryIn
                  ? `Gmail is throttling, retrying in ${retryIn}s…`
                  : `Sending ${done} / ${items.length}…`
                : stopped
                  ? `Stopped: ${failed + notAttempted} not sent`
                  : "Finished"}
            </div>
            {stopped && !sending && (
              <p className="text-sm break-words text-red-800">
                {stopped}. Wait a while, then re-upload the same sheet to send the rest. Nobody
                gets a second email.
              </p>
            )}
            <Progress value={items.length ? (done / items.length) * 100 : 100} />
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              <span className="font-medium text-success">{sent} sent</span>
              <span className={cn("font-medium", failed ? "text-red-700" : "text-muted-foreground")}>
                {failed} failed
              </span>
              {sending && (
                <span className="text-muted-foreground">Keep this page open and the screen on</span>
              )}
            </div>
          </CardContent>
        </Card>
        {items.length === 0 && <p className="text-muted-foreground">Nothing to send.</p>}
        <ul className="grid grid-cols-1 gap-2">
          {items.map((it) => (
            <li
              key={it.id}
              className={cn(
                "flex items-start gap-2.5 rounded-xl border bg-card px-3.5 py-3 text-sm shadow-xs",
                it.status === "failed" && "border-red-200 bg-red-50/60"
              )}
            >
              {it.status === "pending" &&
                (sending ? (
                  <Clock className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                ) : (
                  <CircleSlash className="mt-0.5 size-5 shrink-0 text-amber-600" />
                ))}
              {it.status === "sent" && <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />}
              {it.status === "failed" && <XCircle className="mt-0.5 size-5 shrink-0 text-red-600" />}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{it.name}</div>
                <div className="truncate text-muted-foreground">{it.email}</div>
                {it.error && <div className="mt-1 text-red-800 break-words">{it.error}</div>}
                {it.status === "pending" && !sending && (
                  <div className="mt-1 text-amber-800">Not attempted. Re-upload the sheet later to send.</div>
                )}
              </div>
            </li>
          ))}
        </ul>
        {!sending && (
          <Link href={`/events/${eventId}`} className={buttonVariants({ className: "h-12 w-full text-base" })}>
            Back to event
          </Link>
        )}
      </div>
    );
  }

  const toSend = preview ? preview.newRows.length + preview.unsentCount : 0;
  const overGmailLimit = preview && preview.sentLast24h + toSend > GMAIL_DAILY_SAFE_LIMIT;

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* ---- Upload ---- */}
      <label
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-gold/70 bg-card px-4 text-center transition-colors hover:bg-gold-soft/40 active:bg-gold-soft/60 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 has-[:disabled]:cursor-default has-[:disabled]:opacity-70",
          preview ? "py-4" : "py-7"
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-gold-soft text-saffron-ink">
          {loading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : preview ? (
            <Upload className="size-6" />
          ) : (
            <FileSpreadsheet className="size-6" />
          )}
        </span>
        <span className="text-base font-semibold text-navy">{loading ? "Reading…" : preview ? "Choose a different file" : "Choose Excel file (.xlsx)"}</span>
        <span className="max-w-xs text-xs leading-relaxed text-muted-foreground">
          Required: Student ID, Name, Purchaser Email. Optional: Dietary requirements,
          Membership, Ticket Type
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
            <CardContent className="grid gap-2 text-sm">
              <div className="mb-1 flex min-w-0 items-center gap-2 border-b pb-3 font-semibold">
                <FileSpreadsheet className="size-4 shrink-0 text-india-green" />
                <span className="truncate">{preview.fileName}</span>
              </div>
              <Row label="Rows in sheet" value={preview.rows.length} />
              <Row label="Already have tickets (skipped)" value={preview.rows.length - preview.newRows.length} />
              <Row label="New tickets" value={preview.newRows.length} strong />
              {preview.unsentCount > 0 && (
                <Row label="Earlier unsent / failed (will retry)" value={preview.unsentCount} />
              )}
            </CardContent>
          </Card>

          {preview.warnings.length > 0 && (
            <Alert className="border-amber-300 bg-amber-50 text-amber-950 *:[svg]:text-amber-600">
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
            <Alert className="border-blue-200 bg-blue-50 text-blue-950 *:[svg]:text-blue-700">
              <Info />
              <AlertTitle>Close to Gmail’s daily limit</AlertTitle>
              <AlertDescription className="text-blue-900">
                {preview.sentLast24h} emails were sent in the last 24 hours. Gmail allows about 500
                a day; sending {toSend} more may fail part way. Failed ones can be retried tomorrow by
                re-uploading.
              </AlertDescription>
            </Alert>
          )}

          {preview.newRows.length > 0 && (
            <ul className="grid grid-cols-1 gap-2">
              {preview.newRows.map((r, i) => (
                <li key={i} className="rounded-xl border bg-card px-3.5 py-3 text-sm shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-semibold">{r.name}</span>
                    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                      {r.studentId}
                    </span>
                  </div>
                  <div className="truncate text-muted-foreground">{r.email}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5 empty:hidden">
                    <DietBadge value={r.dietaryRequirements} />
                    <MemberBadge value={r.membership} />
                    <TicketTypeBadge value={r.ticketType} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur supports-backdrop-filter:bg-background/85">
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
                <DialogClose render={<Button variant="outline" className="h-12 text-base sm:h-11" />}>Cancel</DialogClose>
                <Button className="h-12 text-base sm:h-11" onClick={send}>
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

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className={strong ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={cn("font-semibold tabular-nums", strong && "text-base text-navy")}>{value}</span>
    </div>
  );
}
