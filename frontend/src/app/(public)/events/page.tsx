"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Event {
  id: number;
  title: string;
  description: string;
  category: string;
  location: string;
  start_time: string;
  end_time: string;
  capacity: number | null;
  cover_image: string | null;
  tags: string[];
}

interface EventListResponse {
  items: Event[];
  total: number;
  page: number;
  per_page: number;
}

export default function EventsPage() {
  const [data, setData] = useState<EventListResponse>({
    items: [],
    total: 0,
    page: 1,
    per_page: 20,
  });

  useEffect(() => {
    api.get<EventListResponse>("/events").then(setData).catch(() => {});
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Events</h1>
      {data.items.length === 0 ? (
        <p className="text-gray-500">No events available.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {data.items.map((event) => (
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
                  height={192}
                  loading="lazy"
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-4">
                <h2 className="text-lg font-semibold">{event.title}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {event.category} &middot; {event.location}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {new Date(event.start_time).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                {event.capacity && (
                  <p className="text-xs text-gray-400 mt-1">
                    Capacity: {event.capacity}
                  </p>
                )}
                {event.tags && event.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {event.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-block text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
