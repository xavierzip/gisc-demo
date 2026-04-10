"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { api, isAbortError } from "@/lib/api";
import { getToken } from "@/lib/auth";

interface Event {
  id: number;
  title: string;
  description: string;
  category: string;
  location: string;
  location_details: string;
  start_time: string;
  end_time: string;
  capacity: number | null;
  status: string;
  cover_image: string | null;
  tags: string[];
}

interface EventListResponse {
  items: Event[];
  total: number;
}

export default function AdminEventsPage() {
  // null = still loading; [] = loaded and genuinely empty. This distinction
  // matters because the pre-existing silent .catch(() => {}) was hiding 401s
  // behind a fake "empty list" — now we surface errors explicitly.
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const token = getToken();
    // Shouldn't happen — admin layout guard would have redirected — but
    // bail out of the fetch rather than firing an unauthenticated request.
    // Leaving `events` as null keeps the "Loading..." state until the
    // redirect lands.
    if (!token) return;
    api
      .get<EventListResponse>(
        "/events?all=true&per_page=100",
        token,
        controller.signal,
      )
      .then((data) => {
        setEvents(data.items);
        setError(null);
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        // 401 already triggered clearToken() in api.ts, which wakes the
        // admin layout guard's subscription and fires a redirect. Don't
        // flash a scary error on the way out.
        if (!getToken()) return;
        setError(err instanceof Error ? err.message : "Failed to load events");
      });
    return () => controller.abort();
  }, []);

  async function cancelEvent(id: number) {
    const token = getToken();
    if (!token) return;
    try {
      await api.post(`/events/${id}/cancel`, {}, token);
      setEvents((prev) =>
        prev
          ? prev.map((e) => (e.id === id ? { ...e, status: "cancelled" } : e))
          : prev,
      );
      setError(null);
    } catch (err) {
      if (!getToken()) return; // redirect already in flight
      setError(err instanceof Error ? err.message : "Failed to cancel event");
    }
  }

  function handleSaved(updated: Event) {
    setEvents((prev) =>
      prev ? prev.map((e) => (e.id === updated.id ? updated : e)) : prev,
    );
    setEditingEvent(null);
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Manage Events</h1>
        <Link
          href="/admin/events/create"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          Create Event
        </Link>
      </div>
      {error && (
        <div className="mb-4 p-3 border border-red-200 bg-red-50 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}
      {events === null ? (
        <p className="text-gray-500">Loading...</p>
      ) : events.length === 0 && !error ? (
        <p className="text-gray-500">No events yet.</p>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => (
          <div
            key={event.id}
            className="p-4 border rounded-lg flex justify-between items-center"
          >
            <div className="flex items-center gap-4">
              {event.cover_image && (
                <img
                  src={event.cover_image}
                  alt=""
                  width={80}
                  height={40}
                  loading="lazy"
                  className="w-20 h-10 object-cover rounded"
                />
              )}
              <div>
                <h2 className="font-semibold">{event.title}</h2>
                <p className="text-sm text-gray-500">
                  {event.category} &middot;{" "}
                  <span
                    className={
                      event.status === "cancelled"
                        ? "text-red-500"
                        : event.status === "draft"
                        ? "text-yellow-600"
                        : "text-green-600"
                    }
                  >
                    {event.status}
                  </span>{" "}
                  &middot; {new Date(event.start_time).toLocaleDateString()}
                </p>
                {event.tags && event.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
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
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setEditingEvent(event)}
                className="text-sm text-blue-600 hover:underline"
              >
                Edit
              </button>
              {event.status !== "cancelled" && (
                <button
                  onClick={() => cancelEvent(event.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
          ))}
        </div>
      )}

      {editingEvent && (
        <EditEventDialog
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function EditEventDialog({
  event,
  onClose,
  onSaved,
}: {
  event: Event;
  onClose: () => void;
  onSaved: (updated: Event) => void;
}) {
  const [form, setForm] = useState({
    title: event.title,
    description: event.description || "",
    category: event.category || "",
    location: event.location || "",
    location_details: event.location_details || "",
    start_time: event.start_time?.slice(0, 16) || "",
    end_time: event.end_time?.slice(0, 16) || "",
    capacity: event.capacity ?? "",
    status: event.status,
  });
  const [tagsInput, setTagsInput] = useState(
    (event.tags || []).join(", "),
  );
  const [coverPreview, setCoverPreview] = useState<string | null>(
    event.cover_image
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = getToken();
    if (!token) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/events/${event.id}/cover`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCoverPreview(data.cover_image);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to upload cover image"
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const token = getToken();
    if (!token) return;

    try {
      const updated = await api.put<Event>(
        `/events/${event.id}`,
        {
          ...form,
          capacity: form.capacity === "" ? null : Number(form.capacity),
          tags: tagsInput
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
        token
      );
      // Use the latest cover preview in case it was updated
      if (coverPreview !== event.cover_image) {
        updated.cover_image = coverPreview;
      }
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">Edit Event</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Cover Image */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Cover Image
            </label>
            <div className="flex items-center gap-4">
              {coverPreview ? (
                <img
                  src={coverPreview}
                  alt="Cover"
                  width={160}
                  height={80}
                  className="w-40 h-20 object-cover rounded-lg border"
                />
              ) : (
                <div className="w-40 h-20 bg-gray-100 rounded-lg border flex items-center justify-center text-gray-400 text-sm">
                  No cover
                </div>
              )}
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="text-sm bg-gray-100 px-3 py-1.5 rounded hover:bg-gray-200 disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : "Change Image"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Title</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Category
              </label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="workshop">Workshop</option>
                <option value="conference">Conference</option>
                <option value="seminar">Seminar</option>
                <option value="meetup">Meetup</option>
                <option value="social">Social</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Tags</label>
            <input
              type="text"
              data-testid="tags-input"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="beginner, kubernetes, q1-2026"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Comma-separated. Up to 20 tags, 50 chars each.
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Location
              </label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Location Details
              </label>
              <input
                name="location_details"
                value={form.location_details}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Start Time
              </label>
              <input
                type="datetime-local"
                name="start_time"
                value={form.start_time}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                End Time
              </label>
              <input
                type="datetime-local"
                name="end_time"
                value={form.end_time}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Capacity
              </label>
              <input
                type="number"
                name="capacity"
                value={form.capacity}
                onChange={handleChange}
                placeholder="Unlimited"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Status</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="border rounded-lg px-3 py-2 text-sm md:w-48"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="border px-6 py-2 rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
