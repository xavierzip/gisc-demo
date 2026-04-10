"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    api.get<Notification[]>("/notifications", token).then(setNotifications).catch(() => {});
  }, []);

  async function markRead(id: number) {
    const token = getToken();
    if (!token) return;
    await api.post(`/notifications/${id}/read`, {}, token);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Notifications</h1>
      {notifications.length === 0 ? (
        <p className="text-gray-500">No notifications.</p>
      ) : (
        <div className="grid gap-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 border rounded-lg cursor-pointer ${
                n.is_read ? "opacity-60" : "bg-blue-50"
              }`}
              onClick={() => !n.is_read && markRead(n.id)}
            >
              <p className="font-semibold">{n.title}</p>
              {n.body && <p className="text-sm text-gray-600">{n.body}</p>}
              <p className="text-xs text-gray-400">
                {new Date(n.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
