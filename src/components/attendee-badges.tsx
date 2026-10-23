import { cn } from "@/lib/utils";

type BadgeProps = { value: string | null; large?: boolean };

/** Shows the cell's value as-is; renders nothing when the row has no value. */
function ValueBadge({ value, large, color }: BadgeProps & { color: string }) {
  if (!value?.trim()) return null;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full font-semibold break-words ring-1 ring-inset",
        large ? "px-3.5 py-1.5 text-lg leading-tight" : "px-2.5 py-0.5 text-xs leading-5",
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
    <ValueBadge
      {...props}
      color={
        veg
          ? "bg-green-100 text-green-900 ring-green-300"
          : "bg-amber-100 text-amber-900 ring-amber-300"
      }
    />
  );
}

export function MemberBadge(props: BadgeProps) {
  const member = props.value?.trim().toLowerCase() === "member";
  return (
    <ValueBadge
      {...props}
      color={
        member
          ? "bg-blue-100 text-blue-900 ring-blue-300"
          : "bg-zinc-100 text-zinc-800 ring-zinc-300"
      }
    />
  );
}

export function TicketTypeBadge(props: BadgeProps) {
  return <ValueBadge {...props} color="bg-violet-100 text-violet-900 ring-violet-300" />;
}
