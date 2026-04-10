"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AUTH_CHANGE_EVENT, getToken } from "@/lib/auth";

type AuthStatus = "checking" | "authed" | "anon";

// Client-side guard for user-only routes (/my-events, /notifications).
// Redirects to /login?next=<current> whenever the token goes missing or
// expires — including mid-session, because getToken() auto-clears expired
// tokens and api.ts clears on any 401 response. The backend remains the
// source of truth for authorization; this layout just prevents rendering
// stale UI over an anonymous session.
export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuthStatus();

  useEffect(() => {
    if (status === "anon") {
      const next = encodeURIComponent(pathname || "/");
      router.replace(`/login?next=${next}`);
    }
  }, [status, pathname, router]);

  if (status !== "authed") {
    return <p className="p-6 text-gray-500">Checking session...</p>;
  }

  return <>{children}</>;
}

function useAuthStatus(): AuthStatus {
  return useSyncExternalStore(subscribe, getClientStatus, getServerStatus);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(AUTH_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(AUTH_CHANGE_EVENT, onChange);
  };
}

function getClientStatus(): AuthStatus {
  return getToken() ? "authed" : "anon";
}

function getServerStatus(): AuthStatus {
  return "checking";
}
