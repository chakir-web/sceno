import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const path = request.nextUrl.pathname;

  const redirectTo = (pathname: string) => {
    const target = request.nextUrl.clone();
    target.pathname = pathname;
    target.search = "";
    response.cookies.getAll().forEach((cookie) => target && response.cookies.set(cookie));
    const redirected = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    return redirected;
  };

  if (!url || !anon) {
    if (path.startsWith("/admin") || path.startsWith("/confirmer")) {
      const target = request.nextUrl.clone();
      target.pathname = "/auth/login";
      target.searchParams.set("reason", "setup");
      return NextResponse.redirect(target);
    }
    return response;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  let role: string | null = null;
  let active = false;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
    role = profile?.role ?? null;
    active = Boolean(profile?.is_active);
  }

  const staff = path.startsWith("/admin") || path.startsWith("/confirmer");
  const authPage = path.startsWith("/auth") && !path.startsWith("/auth/callback");

  if (staff) {
    if (!user || !active) {
      const target = request.nextUrl.clone();
      target.pathname = "/auth/login";
      target.searchParams.set("next", path);
      const redirected = NextResponse.redirect(target);
      response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
      return redirected;
    }
    if (path.startsWith("/admin") && role !== "admin") return redirectTo(role === "confirmer" ? "/confirmer/dashboard" : "/auth/login");
    if (path.startsWith("/confirmer") && role !== "confirmer") return redirectTo(role === "admin" ? "/admin/dashboard" : "/auth/login");
  }

  if (authPage && user && active && path !== "/auth/reset-password" && (role === "admin" || role === "confirmer")) {
    return redirectTo(role === "admin" ? "/admin/dashboard" : "/confirmer/dashboard");
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/confirmer/:path*", "/auth/:path*"],
};
