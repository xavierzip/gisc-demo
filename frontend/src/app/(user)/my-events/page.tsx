"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

interface RegisteredEvent {
  id: number;
  title: string;
  category: string;
  location: string;
  start_time: string;
  end_time: string;
  status: string;
  cover_image: string | null;
  registered_at: string;
  tags?: string[];
}

export default function MyEventsPage() {
  const [events, setEvents] = useState<RegisteredEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<RegisteredEvent[]>("/auth/me/registrations", token)
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-6">Loading...</p>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">My Events</h1>
      {events.length === 0 ? (
        <div>
          <p className="text-gray-500 mb-4">
            You haven&apos;t registered for any events yet.
          </p>
          <Link
            href="/events"
            className="text-blue-600 hover:underline text-sm"
          >
            Browse events
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/events/detail?id=${event.id}`}
              className="block border rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
            >
              {event.cover_image && (
                <img
                  src={event.cover_image}
                  alt={event.title}
                  width={600}
                  height={144}
                  loading="lazy"
                  className="w-full h-36 object-cover"
                />
              )}
              <div className="p-4">
                <h2 className="font-semibold">{event.title}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {event.category} &middot; {event.location}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {new Date(event.start_time).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                  {" "}&mdash;{" "}
                  {new Date(event.end_time).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <p className="text-xs text-green-600 mt-2">
                  Registered {new Date(event.registered_at).toLocaleDateString()}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
