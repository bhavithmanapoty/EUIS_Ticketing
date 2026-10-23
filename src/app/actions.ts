"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string } | undefined;

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (error) return { error: "Wrong email or password" };
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  // "local": only this phone. The default ("global") would log out every
  // device using the shared committee login, including door scanners.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

export async function createEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "");
  if (!name) return { error: "Enter an event name" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return { error: "Pick a date" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({ name, event_date: eventDate })
    .select("id")
    .single();
  if (error) return { error: error.message };
  redirect(`/events/${data.id}`);
}
