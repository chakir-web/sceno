import Image from "next/image";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export function Media({ src, alt, className, priority = false, sizes }: { src: string | null; alt: string; className?: string; priority?: boolean; sizes?: string }) {
  if (!src) {
    return (
      <div className={cn("grid h-full w-full place-items-center bg-mist", className)}>
        <Logo className="h-7 w-auto max-w-[72%] sm:h-9" />
      </div>
    );
  }
  if (src.endsWith(".svg") || src.startsWith("/")) {
    return (
      // Les visuels SVG de la maison et les fichiers locaux ne passent pas par l'optimiseur distant.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} className={cn("h-full w-full object-cover", className)} />
    );
  }
  return <Image src={src} alt={alt} fill priority={priority} sizes={sizes ?? "(max-width: 768px) 50vw, 25vw"} className={cn("object-cover", className)} />;
}
