"use client";

import { useActionState } from "react";
import { createEvent } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewEventForm() {
  const [state, action, pending] = useActionState(createEvent, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>New event</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Event name (as shown in the email)</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="Indian Society Diwali Ball"
              className="h-12 text-base"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="event_date">Date</Label>
            <Input id="event_date" name="event_date" type="date" required className="h-12 text-base" />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="h-12 text-base">
            {pending ? "Creating…" : "Create event"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
