"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { LogIn, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AuthBadge() {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setReady(true);
      return;
    }
    const supabase = createBrowserClient(url, key);
    let unsub: (() => void) | undefined;
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setReady(true);
    });
    const sub = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    unsub = () => sub.data.subscription.unsubscribe();
    return () => unsub?.();
  }, []);

  if (!ready) return null;

  const onSignOut = async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const supabase = createBrowserClient(url, key);
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (!email) {
    return (
      <Button asChild variant="outline" size="sm" className="h-8 text-xs">
        <Link href="/signin">
          <LogIn className="h-3.5 w-3.5" />
          <span className="ml-1.5">Sign in</span>
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <User className="h-3.5 w-3.5" />
        <span className="font-mono">{email}</span>
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onSignOut}
        className="h-7 px-2 text-[11px]"
      >
        <LogOut className="h-3 w-3" />
        <span className="ml-1">Sign out</span>
      </Button>
    </div>
  );
}
