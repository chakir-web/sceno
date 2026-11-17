import { cn } from "@/lib/utils";

const sources = {
  dark: "/brand/logo-sceno.png",
  light: "/brand/logo-sceno-light.png",
} as const;

export function Logo({
  variant = "horizontal",
  tone = "dark",
  className,
}: {
  variant?: "horizontal" | "vertical" | "icon";
  tone?: "dark" | "light";
  className?: string;
}) {
  const size = variant === "vertical" ? "h-14 w-auto max-w-full" : variant === "icon" ? "h-8 w-auto max-w-full" : "h-8 w-auto";
  return (
    <img
      src={sources[tone]}
      alt="SCENO"
      width={509}
      height={97}
      className={cn(size, "object-contain", className)}
    />
  );
}
