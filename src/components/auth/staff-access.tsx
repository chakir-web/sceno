"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Logo } from "@/components/brand/logo";
import { useI18n } from "@/components/providers";
import { bootstrapAdmin, requestPasswordReset, signIn, updatePassword } from "@/lib/actions/auth";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });

export function LoginForm() {
  const { dict } = useI18n();
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const [error, setError] = useState("");
  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(async (values) => {
      const data = new FormData();
      data.set("email", values.email);
      data.set("password", values.password);
      const result = await signIn(data);
      if (result && !result.ok) {
        const code = result.code === "invalid" ? "invalid" : result.code;
        setError(code === "invalid" ? dict.auth.invalid : code === "inactive" ? dict.auth.inactive : dict.errors.generic);
      }
    })}>
      <label className="grid gap-2 text-sm">{dict.auth.email}<input className="field" type="email" {...form.register("email")} /></label>
      <label className="grid gap-2 text-sm">{dict.auth.password}<input className="field" type="password" {...form.register("password")} /></label>
      {error ? <p className="text-sm text-red-900">{error}</p> : null}
      <button className="btn btn-primary" type="submit">{dict.auth.submit}</button>
      <Link href="/auth/forgot-password" className="text-sm text-stone">{dict.auth.forgot}</Link>
    </form>
  );
}

export function BootstrapForm() {
  const { dict } = useI18n();
  const [error, setError] = useState("");
  return (
    <form className="mt-8 grid gap-3 border-t border-line pt-6" onSubmit={async (event) => {
      event.preventDefault();
      const result = await bootstrapAdmin(new FormData(event.currentTarget));
      if (!result.ok) setError(dict.errors[result.code as keyof typeof dict.errors] ?? dict.auth.invalid);
    }}>
      <h2 className="font-display text-3xl">{dict.auth.bootstrapTitle}</h2>
      <p className="text-sm text-stone">{dict.auth.bootstrapLead}</p>
      <input className="field" name="fullName" placeholder={dict.auth.fullName} required />
      <input className="field" type="email" name="email" placeholder={dict.auth.email} required />
      <input className="field" type="password" name="password" placeholder={dict.auth.password} minLength={10} required />
      <input className="field" name="token" placeholder={dict.auth.bootstrapToken} required />
      {error ? <p className="text-sm text-red-900">{error}</p> : null}
      <button className="btn btn-ghost" type="submit">{dict.auth.createAdmin}</button>
    </form>
  );
}

export function ForgotForm() {
  const { dict } = useI18n();
  const [sent, setSent] = useState(false);
  return (
    <form className="grid gap-4" onSubmit={async (event) => { event.preventDefault(); await requestPasswordReset(new FormData(event.currentTarget)); setSent(true); }}>
      <label className="grid gap-2 text-sm">{dict.auth.email}<input className="field" type="email" name="email" required /></label>
      <button className="btn btn-primary" type="submit">{dict.auth.send}</button>
      {sent ? <p className="text-sm">{dict.auth.sent}</p> : null}
    </form>
  );
}

export function ResetForm() {
  const { dict } = useI18n();
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  return (
    <form className="grid gap-4" onSubmit={async (event) => {
      event.preventDefault();
      const result = await updatePassword(new FormData(event.currentTarget));
      if (!result.ok) setError(dict.errors.password);
      else setDone(true);
    }}>
      <label className="grid gap-2 text-sm">{dict.auth.newPassword}<input className="field" type="password" name="password" minLength={10} required /></label>
      {error ? <p className="text-sm text-red-900">{error}</p> : null}
      {done ? <p className="text-sm">{dict.auth.updated}</p> : null}
      <button className="btn btn-primary" type="submit">{dict.auth.updatePassword}</button>
    </form>
  );
}

export function AuthFrame({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md border border-line bg-ivory p-8">
        <Logo className="h-10 w-auto" />
        <h1 className="mt-8 font-display text-4xl">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-stone">{lead}</p>
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
