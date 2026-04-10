"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Event {
  id: number;
  title: string;
  category: string;
  location: string;
  start_time: string;
}

interface SearchResponse {
  items: Event[];
  total: number;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    try {
      const data = await api.get<SearchResponse>(
        `/search/events?q=${encodeURIComponent(query)}`
      );
      setResults(data.items);
      setTotal(data.total);
    } catch {
      setResults([]);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Search Events</h1>
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, description, location..."
          className="flex-1 border rounded-lg px-4 py-2"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          Search
        </button>
      </form>
      {total > 0 && (
        <p className="text-sm text-gray-500 mb-4">{total} result(s) found</p>
      )}
      <div className="grid gap-4">
        {results.map((event) => (
          <Link
            key={event.id}
            href={`/events/detail?id=${event.id}`}
            className="block p-4 border rounded-lg hover:shadow-md"
          >
            <h2 className="font-semibold">{event.title}</h2>
            <p className="text-sm text-gray-500">
              {event.category} &middot; {event.location}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
