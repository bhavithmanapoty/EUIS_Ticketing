import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid, type EventRecord } from "@/lib/types";

/** Loads an event for a page, or renders the 404 page. */
export async function getEventOr404(id: string) {
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return { supabase, event: data as EventRecord };
}
