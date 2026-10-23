import { cn } from "@/lib/utils";

type BadgeProps = { value: string | null; large?: boolean };

/** Shows the cell's value as-is; renders nothing when the row has no value. */
function ValueBadge({ value, large, color }: BadgeProps & { color: string }) {
  if (!value?.trim()) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-semibold",
        large ? "px-3 py-1.5 text-lg" : "px-2 py-0.5 text-xs",
        color
      )}
    >
      {value}
    </span>
  );
}

export function DietBadge(props: BadgeProps) {
  const veg = /^(veg|vegetarian|vegan)$/i.test(props.value?.trim() ?? "");
  return (
    <ValueBadge {...props} color={veg ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-900"} />
  );
}

export function MemberBadge(props: BadgeProps) {
  const member = props.value?.trim().toLowerCase() === "member";
  return (
    <ValueBadge {...props} color={member ? "bg-blue-100 text-blue-900" : "bg-zinc-200 text-zinc-800"} />
  );
}

export function TicketTypeBadge(props: BadgeProps) {
  return <ValueBadge {...props} color="bg-violet-100 text-violet-900" />;
}
