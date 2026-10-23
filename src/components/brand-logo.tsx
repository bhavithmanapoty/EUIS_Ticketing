import Image from "next/image";
import { cn } from "@/lib/utils";

/** The society seal. Served from a resized copy, never the original 1750px file. */
export function BrandLogo({
  size,
  className,
  priority,
}: {
  size: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={size > 96 ? "/logo-512.png" : "/logo-192.png"}
      alt="Edinburgh University Indian Society"
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 rounded-full bg-white", className)}
    />
  );
}
