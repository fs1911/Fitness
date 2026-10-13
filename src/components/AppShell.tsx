"use client";
import { BarChart3, ClipboardList, Dumbbell, History, Home, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { db } from "@/data";
import { ensureSeeded } from "@/data/seed/seed";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Start", icon: Home },
  { href: "/plan/", label: "Trainingsplan", icon: ClipboardList },
  { href: "/geraete/", label: "Geräte", icon: Dumbbell },
  { href: "/fortschritt/", label: "Fortschritt", icon: BarChart3 },
  { href: "/verlauf/", label: "Verlauf", icon: History },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href.replace(/\/$/, ""));
}

type InitState = "loading" | "ready" | { error: string };

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [state, setState] = React.useState<InitState>("loading");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await db.open();
        await ensureSeeded(db);
        if (!cancelled) setState("ready");
      } catch (e) {
        if (!cancelled) {
          setState({
            error:
              e instanceof Error
                ? e.message
                : "Der lokale Speicher (IndexedDB) ist nicht verfügbar.",
          });
        }
      }
      // Persistente Speicherung anfragen, damit der Browser Daten nicht automatisch löscht.
      try {
        await navigator.storage?.persist?.();
      } catch {
        /* nicht unterstützt */
      }
    })();
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const inTraining = pathname.startsWith("/training");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Dumbbell className="size-5" aria-hidden />
          </span>
          <span>Zweier-Split</span>
        </Link>
        <Link
          href="/einstellungen/"
          aria-label="Einstellungen"
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-xl hover:bg-surface-2",
            pathname.startsWith("/einstellungen") && "text-accent",
          )}
        >
          <Settings className="size-5" />
        </Link>
      </header>

      <main className={cn("flex-1 px-4 pt-4", inTraining ? "pb-40" : "pb-28")}>
        {state === "loading" && <p className="py-10 text-center text-muted">Daten werden geladen …</p>}
        {typeof state === "object" && (
          <div role="alert" className="rounded-2xl border border-danger/60 p-4">
            <p className="font-semibold text-danger">Lokaler Speicher nicht verfügbar</p>
            <p className="mt-1 text-sm text-muted">
              Die App speichert alle Daten in diesem Browser (IndexedDB). Im privaten Modus oder bei
              blockiertem Website-Speicher funktioniert das nicht. Details: {state.error}
            </p>
          </div>
        )}
        {state === "ready" && children}
      </main>

      {!inTraining && (
        <nav
          aria-label="Hauptnavigation"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        >
          <ul className="mx-auto grid max-w-3xl grid-cols-5">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                      active ? "text-accent" : "text-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
