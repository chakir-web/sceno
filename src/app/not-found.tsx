import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="text-center">
        <Logo className="mx-auto h-12 w-auto max-w-full sm:h-16" />
        <h1 className="mt-8 font-display text-5xl">404</h1>
        <Link className="btn btn-primary mt-6" href="/">SCENO</Link>
      </div>
    </main>
  );
}
