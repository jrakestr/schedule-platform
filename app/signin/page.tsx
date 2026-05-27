"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setStatus("error");
      setError("Supabase env vars are missing");
      return;
    }

    const supabase = createBrowserClient(url, key);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/")}`;

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });

    if (signInError) {
      setStatus("error");
      setError(signInError.message);
      return;
    }
    setStatus("sent");
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm space-y-4">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Sign in</h1>
          <p className="text-xs text-muted-foreground">
            Enter your work email. We&apos;ll send you a one-time magic link.
          </p>
        </div>

        {status === "sent" ? (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-3 text-xs text-emerald-700 dark:text-emerald-300">
            Check <span className="font-mono">{email}</span> for a sign-in link.
            You can close this tab.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="you@mjminnovations.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "sending"}
              className="text-sm"
            />
            <Button
              type="submit"
              className="w-full"
              disabled={status === "sending" || !email.trim()}
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </Button>
            {status === "error" && error && (
              <div className="text-xs text-red-700 dark:text-red-300">{error}</div>
            )}
          </form>
        )}

        <p className="text-[10px] text-muted-foreground border-t pt-3">
          Signing in lets you save scheduler edits and delete optimization runs.
          Read-only views work without signing in.
        </p>
      </div>
    </main>
  );
}
