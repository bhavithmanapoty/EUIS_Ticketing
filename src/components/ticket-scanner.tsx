"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { IDetectedBarcode, IScannerError } from "@yudiel/react-qr-scanner";
import { AlertTriangle, CameraOff, CheckCircle2, Loader2, ScanLine, XCircle } from "lucide-react";
import { DietBadge, MemberBadge, TicketTypeBadge } from "@/components/attendee-badges";
import { Button } from "@/components/ui/button";
import { formatScanTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AttendeeDetails, VerifyResult } from "@/lib/types";

// Camera APIs only exist in the browser. The QR decoder (zxing WebAssembly)
// is served from /public (copied on npm install) instead of the default
// jsDelivr CDN, so scanning doesn't depend on a third-party CDN at the venue.
const Scanner = dynamic(
  () =>
    import("@yudiel/react-qr-scanner").then((m) => {
      m.setZXingModuleOverrides({
        locateFile: (path: string, prefix: string) =>
          path.endsWith(".wasm") ? "/zxing_reader.wasm" : prefix + path,
      });
      return m.Scanner;
    }),
  {
    ssr: false,
    loading: () => <div className="aspect-square w-full animate-pulse bg-zinc-900" />,
  }
);

async function postJson(url: string, body: unknown): Promise<VerifyResult> {
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
  return data as VerifyResult;
}

export function TicketScanner({ eventId }: { eventId: string }) {
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const locked = useRef(false); // blocks duplicate detections while a request is in flight

  const paused = busy || result !== null || error !== null;

  async function onScan(codes: IDetectedBarcode[]) {
    const token = codes[0]?.rawValue;
    if (!token || locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      setResult(await postJson("/api/tickets/verify", { token, eventId }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function checkIn(ticketId: string) {
    setBusy(true);
    try {
      setResult(await postJson("/api/tickets/checkin", { ticketId, eventId }));
    } catch (e) {
      // The check-in may have saved even if the response was lost.
      setError(`${(e as Error).message}. Not sure it saved: scan the ticket again to check.`);
    } finally {
      setBusy(false);
    }
  }

  function scanNext() {
    setResult(null);
    setError(null);
    locked.current = false;
  }

  function onCameraError(e: IScannerError) {
    console.error("Scanner error", e.kind, e.message, e.cause);
    setCameraError(
      e.kind === "permission-denied"
        ? "Camera access was blocked. Allow camera access for this site in your browser settings, then reload."
        : e.kind === "insecure-context"
          ? "The camera only works over https."
          : `Camera problem (${e.kind})${e.message ? `: ${e.message}` : ""}. Try reloading the page.`
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-black pb-[env(safe-area-inset-bottom)]">
      <div className="relative mx-auto w-full max-w-xl">
        <Scanner
          onScan={onScan}
          onError={onCameraError}
          paused={paused}
          formats={["qr_code"]}
          // "ideal" only: the library's default min 640px height and plain
          // facingMode reject some cameras (e.g. 640x480 webcams).
          constraints={{
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }}
          allowMultiple
          scanDelay={1000}
          sound={false}
          components={{ finder: true, torch: true }}
          styles={{ container: { width: "100%", aspectRatio: "1 / 1" } }}
        />
        {busy && !result && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="size-10 animate-spin text-white" />
          </div>
        )}
      </div>

      <div
        className={cn(
          "px-safe mx-auto flex w-full max-w-xl items-start justify-center gap-2 py-5 text-center text-base",
          cameraError ? "text-red-200" : "text-zinc-200"
        )}
      >
        {cameraError ? (
          <CameraOff className="mt-0.5 size-5 shrink-0 text-red-300" />
        ) : (
          <ScanLine className="mt-0.5 size-5 shrink-0 text-gold" />
        )}
        <span>{cameraError ?? "Point the camera at a ticket QR code"}</span>
      </div>

      {(result || error) && (
        <div className="fixed inset-x-0 bottom-0 z-20 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_rgba(0,0,0,0.45)] animate-in slide-in-from-bottom-8 fade-in-0 duration-200">
          <div className="mx-auto max-w-xl">
            {error ? (
              <Banner tone="red" icon={<XCircle />} title="Couldn't check ticket" subtitle={error} />
            ) : (
              <ResultBody result={result!} />
            )}
            <div className="px-safe grid gap-2.5 pt-5 pb-4">
              {result?.status === "VALID" && (
                <Button
                  className="h-14 bg-green-700 text-lg text-white shadow-green-900/20 hover:bg-green-800 active:bg-green-800 [&_svg:not([class*='size-'])]:size-5"
                  disabled={busy}
                  onClick={() => checkIn(result.attendee.id)}
                >
                  {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Check in
                </Button>
              )}
              <Button
                variant={result?.status === "VALID" ? "outline" : "default"}
                className="h-14 text-lg"
                disabled={busy}
                onClick={scanNext}
              >
                {result?.status === "VALID" ? "Cancel" : "Scan next ticket"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultBody({ result }: { result: VerifyResult }) {
  switch (result.status) {
    case "INVALID":
      return (
        <Banner
          tone="red"
          icon={<XCircle />}
          title="Invalid ticket"
          subtitle="This QR code is not a valid ticket."
        />
      );
    case "WRONG_EVENT":
      return (
        <>
          <Banner tone="red" icon={<XCircle />} title="Wrong event" subtitle={`This ticket is for ${result.eventName}.`} />
          <Details attendee={result.attendee} />
        </>
      );
    case "ALREADY_CHECKED_IN":
      return (
        <>
          <Banner
            tone="amber"
            icon={<AlertTriangle />}
            title="Already checked in"
            subtitle={`Scanned at ${formatScanTime(result.checkedInAt)}`}
          />
          <Details attendee={result.attendee} />
        </>
      );
    case "VALID":
      return (
        <>
          <Banner tone="green" icon={<CheckCircle2 />} title="Valid ticket" subtitle="Tap “Check in” to confirm entry." />
          <Details attendee={result.attendee} />
        </>
      );
    case "CHECKED_IN":
      return (
        <>
          <Banner tone="green" icon={<CheckCircle2 />} title="Checked in!" subtitle={formatScanTime(result.checkedInAt)} />
          <Details attendee={result.attendee} />
        </>
      );
  }
}

const TONES = {
  green: "bg-green-700 text-white",
  amber: "bg-amber-400 text-amber-950",
  red: "bg-red-600 text-white",
};

function Banner(props: { tone: keyof typeof TONES; icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div
      className={cn(
        "px-safe flex items-center gap-3.5 rounded-t-3xl py-5 [&_svg]:size-10 [&_svg]:shrink-0",
        TONES[props.tone]
      )}
    >
      {props.icon}
      <div className="min-w-0">
        <div className="text-2xl leading-tight font-bold">{props.title}</div>
        {props.subtitle && (
          <div className="mt-0.5 text-base font-medium break-words opacity-95">{props.subtitle}</div>
        )}
      </div>
    </div>
  );
}

function Details({ attendee }: { attendee: AttendeeDetails }) {
  return (
    <div className="px-safe grid gap-3 pt-5">
      <div>
        <div className="text-2xl leading-tight font-bold break-words text-foreground">{attendee.name}</div>
        <div className="mt-1 text-lg tracking-wide tabular-nums text-muted-foreground">{attendee.studentId}</div>
      </div>
      <div className="flex flex-wrap gap-2 empty:hidden">
        <DietBadge value={attendee.dietaryRequirements} large />
        <MemberBadge value={attendee.membership} large />
        <TicketTypeBadge value={attendee.ticketType} large />
      </div>
    </div>
  );
}
