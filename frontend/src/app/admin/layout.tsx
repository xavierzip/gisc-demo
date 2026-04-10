"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AUTH_CHANGE_EVENT, getToken, parseJwt } from "@/lib/auth";

type AdminStatus = "checking" | "admin" | "not-admin";

// Client-side guard: hides the admin UI shell from non-admin users so it
// never flashes before the backend 403s. The backend remains the source of
// truth for authorization — every /api/admin/* call is re-validated there.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAdminStatus();

  useEffect(() => {
    if (status === "not-admin") {
      // Distinguish "logged in as non-admin" (send home) from "not logged
      // in at all" (send to login, preserve return path). getToken() is
      // authoritative because it auto-clears expired tokens.
      if (getToken()) {
        router.replace("/");
      } else {
        const next = encodeURIComponent(pathname || "/");
        router.replace(`/login?next=${next}`);
      }
    }
  }, [status, pathname, router]);

  if (status !== "admin") {
    return <p className="p-6 text-gray-500">Checking permissions...</p>;
  }

  return <>{children}</>;
}

function useAdminStatus(): AdminStatus {
  return useSyncExternalStore(subscribe, getClientStatus, getServerStatus);
}

function subscribe(onChange: () => void): () => void {
  // `storage` fires for other tabs; AUTH_CHANGE_EVENT fires for same-tab
  // logins/logouts dispatched by setToken/clearToken in @/lib/auth.
  window.addEventListener("storage", onChange);
  window.addEventListener(AUTH_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(AUTH_CHANGE_EVENT, onChange);
  };
}

function getClientStatus(): AdminStatus {
  const token = getToken();
  if (!token) return "not-admin";
  const claims = parseJwt(token);
  return claims?.role === "admin" ? "admin" : "not-admin";
}

function getServerStatus(): AdminStatus {
  return "checking";
}
