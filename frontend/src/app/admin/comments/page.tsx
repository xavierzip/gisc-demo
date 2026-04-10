"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

interface Comment {
  id: number;
  event_id: number;
  event_title: string;
  user_id: number;
  user_name: string;
  body: string;
  is_hidden: boolean;
  created_at: string;
}

interface CommentsResponse {
  items: Comment[];
  total: number;
  page: number;
}

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<"all" | "visible" | "hidden">("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComments();
  }, [filter, search]);

  async function loadComments() {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ show: filter });
      if (search) params.set("q", search);
      const data = await api.get<CommentsResponse>(
        `/admin/comments?${params}`,
        token
      );
      setComments(data.items);
      setTotal(data.total);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
  }

  async function toggleHide(comment: Comment) {
    const token = getToken();
    if (!token) return;
    const action = comment.is_hidden ? "unhide" : "hide";
    await api.post(
      `/events/${comment.event_id}/comments/${comment.id}/${action}`,
      {},
      token
    );
    // Reload to get fresh ES data
    loadComments();
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Manage Comments</h1>

      {/* Search bar — powered by Elasticsearch */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search comments by content, user, or event..."
          className="flex-1 border rounded-lg px-4 py-2 text-sm"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 text-sm"
        >
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setSearchInput("");
            }}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Clear
          </button>
        )}
      </form>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {(["all", "visible", "hidden"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              filter === f
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-400 self-center">
          {total} result{total !== 1 && "s"}
          {search && (
            <span>
              {" "}
              for &ldquo;<span className="text-gray-600">{search}</span>&rdquo;
            </span>
          )}
        </span>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : comments.length === 0 ? (
        <p className="text-gray-400">No comments found.</p>
      ) : (
        <div className="divide-y">
          {comments.map((c) => (
            <div
              key={c.id}
              className={`py-4 ${c.is_hidden ? "opacity-50" : ""}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">{c.user_name}</span>
                    <span className="text-gray-400">on</span>
                    <Link
                      href={`/events/detail?id=${c.event_id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {c.event_title}
                    </Link>
                    <span className="text-xs text-gray-400">
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                    {c.is_hidden && (
                      <span className="text-xs text-red-400">(hidden)</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{c.body}</p>
                </div>
                <button
                  onClick={() => toggleHide(c)}
                  className={`text-xs ml-4 hover:underline whitespace-nowrap ${
                    c.is_hidden ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {c.is_hidden ? "Unhide" : "Hide"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
