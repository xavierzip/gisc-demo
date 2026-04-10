"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

// Matches the shape returned by POST /events and used by the admin list.
interface CreatedEvent {
  id: number;
}

// Keep this in lockstep with the edit dialog's validation — backend
// enforces the real limit, but giving fast client-side feedback matters
// when a user picks a 20MB file.
const MAX_COVER_BYTES = 5 * 1024 * 1024;

// Split a comma-separated tag input into a clean string[]. Backend
// normalizes again (trim, dedup, length cap) so we just need to produce
// a reasonable list here — no need to mirror every rule.
function parseTagsInput(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function CreateEventPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  // If the create call succeeded but cover upload failed, we remember the
  // new event's id so re-submitting retries only the upload — no duplicate
  // event rows.
  const [createdId, setCreatedId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "workshop",
    location: "",
    location_details: "",
    start_time: "",
    end_time: "",
    capacity: "",
    status: "draft",
  });
  // Comma-separated tag input. Parsed to a string[] on submit. Backend
  // validates and normalizes (dedup, trim, length caps).
  const [tagsInput, setTagsInput] = useState("");

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleCoverPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Cover must be an image");
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      setError("Cover image must be under 5MB");
      return;
    }
    setError("");
    setCoverFile(file);
    // Object URL for the preview — revoked when the component unmounts or
    // the user picks a different file (see below).
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function clearCover() {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const token = getToken();
    if (!token) return;

    setSubmitting(true);
    try {
      // Step 1: create the event, unless a previous submit already created
      // it and only the cover upload failed. Skipping the create on retry
      // prevents duplicate event rows.
      let eventId = createdId;
      if (eventId === null) {
        const created = await api.post<CreatedEvent>(
          "/events",
          {
            ...form,
            capacity: form.capacity === "" ? null : Number(form.capacity),
            tags: parseTagsInput(tagsInput),
          },
          token,
        );
        eventId = created.id;
        setCreatedId(eventId);
      }

      // Step 2: upload the cover if the user picked one. Separate endpoint,
      // separate failure mode — the event already exists either way.
      if (coverFile) {
        const fd = new FormData();
        fd.append("file", coverFile);
        const res = await fetch(`/api/events/${eventId}/cover`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Cover upload failed");
        }
      }

      router.push("/admin/events");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
      setSubmitting(false);
    }
  }

  function finishWithoutCover() {
    router.push("/admin/events");
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Create Event</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Cover Image
          </label>
          <div className="flex items-center gap-4">
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverPreview}
                alt="Cover preview"
                width={160}
                height={80}
                className="w-40 h-20 object-cover rounded-lg border"
              />
            ) : (
              <div className="w-40 h-20 bg-gray-100 rounded-lg border flex items-center justify-center text-gray-400 text-sm">
                No cover
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleCoverPick}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-sm bg-gray-100 px-3 py-1.5 rounded hover:bg-gray-200"
              >
                {coverPreview ? "Change Image" : "Choose Image"}
              </button>
              {coverPreview && (
                <button
                  type="button"
                  onClick={clearCover}
                  className="text-sm text-gray-500 hover:text-gray-800"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            PNG or JPEG, up to 5MB. Optional.
          </p>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Title</label>
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={4}
            className="w-full border rounded-lg px-4 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Tags</label>
          <input
            type="text"
            data-testid="tags-input"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="beginner, kubernetes, q1-2026"
            className="w-full border rounded-lg px-4 py-2"
          />
          <p className="text-xs text-gray-400 mt-1">
            Comma-separated. Up to 20 tags, 50 chars each. Optional.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Category</label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="w-full border rounded-lg px-4 py-2"
            >
              <option value="workshop">Workshop</option>
              <option value="conference">Conference</option>
              <option value="seminar">Seminar</option>
              <option value="meetup">Meetup</option>
              <option value="social">Social</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Status</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="w-full border rounded-lg px-4 py-2"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Location</label>
            <input
              name="location"
              value={form.location}
              onChange={handleChange}
              className="w-full border rounded-lg px-4 py-2"
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
              className="w-full border rounded-lg px-4 py-2"
            />
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Start Time</label>
            <input
              type="datetime-local"
              name="start_time"
              value={form.start_time}
              onChange={handleChange}
              className="w-full border rounded-lg px-4 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">End Time</label>
            <input
              type="datetime-local"
              name="end_time"
              value={form.end_time}
              onChange={handleChange}
              className="w-full border rounded-lg px-4 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Capacity</label>
            <input
              type="number"
              name="capacity"
              value={form.capacity}
              onChange={handleChange}
              placeholder="Unlimited"
              className="w-full border rounded-lg px-4 py-2"
            />
          </div>
        </div>
        {error && (
          <div className="p-3 border border-red-200 bg-red-50 rounded-lg text-sm text-red-700">
            {error}
            {createdId !== null && (
              <p className="mt-1 text-xs text-red-600">
                The event was created — retry the cover upload or finish
                without one.
              </p>
            )}
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
          >
            {submitting
              ? "Saving..."
              : createdId !== null
              ? "Retry Cover Upload"
              : "Create"}
          </button>
          {createdId !== null ? (
            <button
              type="button"
              onClick={finishWithoutCover}
              className="border px-6 py-2 rounded-lg hover:bg-gray-50"
            >
              Finish without cover
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/admin/events")}
              className="border px-6 py-2 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
