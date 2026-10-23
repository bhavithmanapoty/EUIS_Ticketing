import { cn } from "@/lib/utils";

export function DietBadge({ value, large }: { value: string; large?: boolean }) {
  const veg = /^(veg|vegetarian|vegan)$/i.test(value.trim());
  const none = /^(none|n\/a|-)?$/i.test(value.trim());
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-semibold",
        large ? "px-3 py-1.5 text-lg" : "px-2 py-0.5 text-xs",
        none
          ? "bg-zinc-200 text-zinc-800"
          : veg
            ? "bg-green-100 text-green-900"
            : "bg-amber-100 text-amber-900"
      )}
    >
      {value}
    </span>
  );
}

export function MemberBadge({ value, large }: { value: string; large?: boolean }) {
  const member = value.trim().toLowerCase() === "member";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-semibold",
        large ? "px-3 py-1.5 text-lg" : "px-2 py-0.5 text-xs",
        member ? "bg-blue-100 text-blue-900" : "bg-zinc-200 text-zinc-800"
      )}
    >
      {value}
    </span>
  );
}
