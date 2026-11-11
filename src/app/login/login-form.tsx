"use client";

import { FormEvent, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { homePathForPermissions } from "@/lib/permissions";

export function LoginForm({
  schoolName,
  shortName,
  logoUrl,
}: {
  schoolName: string;
  shortName?: string | null;
  logoUrl?: string | null;
}) {
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() =>
    searchParams.get("error") === "access"
      ? "Your account has no usable permissions. Ask an admin to assign a role."
      : null
  );
  const [loading, setLoading] = useState(false);

  async function waitForSessionPermissions() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const session = await getSession();
      if (session?.user?.permissions?.length) return session;
      await new Promise((resolve) => setTimeout(resolve, 75));
    }
    return getSession();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      identifier,
      password,
      redirect: false,
    });

    if (result?.error) {
      setLoading(false);
      setError("Invalid email/phone or password.");
      return;
    }

    const session = await waitForSessionPermissions();
    const destination = homePathForPermissions(session?.user?.permissions);
    // Hard navigation so the auth cookie is always used on the next request.
    window.location.assign(destination);
  }

  const initials = (shortName || schoolName || "SMS")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at top left, color-mix(in srgb, var(--brand-primary) 18%, transparent), transparent 40%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--brand-accent) 16%, transparent), transparent 35%), var(--background)",
        }}
      />

      <div className="relative w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:rounded-2xl sm:p-8">
        <div className="mb-6 text-center sm:mb-8">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-[var(--brand-primary)] text-base font-bold text-white sm:mb-4 sm:h-16 sm:w-16 sm:rounded-2xl sm:text-lg">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={schoolName}
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
            {schoolName}
          </h1>
          <p className="mt-2 text-xs text-[var(--muted-foreground)] sm:text-sm">
            Sign in with email and password. Parents may use phone if they have
            no email.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 sm:space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium sm:text-sm">Email or phone</label>
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="admin@school.local or 024XXXXXXX"
              required
              autoComplete="username"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium sm:text-sm">Password</label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
