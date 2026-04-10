"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { AUTH_CHANGE_EVENT, clearToken, getToken, parseJwt } from "@/lib/auth";

type Role = "admin" | "user" | null;

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const role = useRole();

  function handleLogout() {
    clearToken();
    router.push("/");
  }

  const links = [
    { href: "/events", label: "Events" },
    { href: "/search", label: "Search" },
  ];

  const userLinks = [
    { href: "/my-events", label: "My Events" },
    { href: "/notifications", label: "Notifications" },
  ];

  const adminLinks = [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/events", label: "Manage Events" },
    { href: "/admin/comments", label: "Comments" },
  ];

  return (
    <nav className="border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-lg">
            GISC
          </Link>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm ${
                pathname === link.href
                  ? "text-blue-600 font-medium"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {role &&
            userLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm ${
                  pathname === link.href
                    ? "text-blue-600 font-medium"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {link.label}
              </Link>
            ))}
          {role === "admin" &&
            adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm ${
                  pathname.startsWith(link.href)
                    ? "text-blue-600 font-medium"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {link.label}
              </Link>
            ))}
        </div>
        <div className="flex items-center gap-4">
          {role ? (
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/login"
              className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

// --- Auth store (client-only, reactive to localStorage changes) ---

function useRole(): Role {
  return useSyncExternalStore(subscribe, getClientRole, getServerRole);
}

function getClientRole(): Role {
  const token = getToken();
  if (!token) return null;
  const claims = parseJwt(token);
  return (claims?.role as Role) || "user";
}

function getServerRole(): Role {
  return null;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(AUTH_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(AUTH_CHANGE_EVENT, onChange);
  };
}
