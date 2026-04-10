"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, isAbortError } from "@/lib/api";
import { getToken, parseJwt } from "@/lib/auth";

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

export default function EventDetail() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<
    "register" | "unregister" | null
  >(null);
  const isLoggedIn = typeof window !== "undefined" && !!getToken();

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const token = getToken();

    // Fetch event and registration status in parallel so first paint isn't
    // gated on both round trips sequentially.
    Promise.all([
      api.get<Event>(`/events/${id}`, undefined, controller.signal),
      token
        ? api
            .get<{ registered: boolean }>(
              `/events/${id}/registration-status`,
              token,
              controller.signal,
            )
            .catch((err) => {
              if (isAbortError(err)) throw err;
              return { registered: false };
            })
        : Promise.resolve({ registered: false }),
    ])
      .then(([eventData, regStatus]) => {
        setEvent(eventData);
        setRegistered(regStatus.registered);
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(true);
      });

    return () => controller.abort();
  }, [id]);

  async function doRegister() {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setMessage("");
    setConfirmAction(null);
    try {
      await api.post(`/events/${id}/register`, {}, token);
      setRegistered(true);
      setMessage("Successfully registered!");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  }

  async function doUnregister() {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setMessage("");
    setConfirmAction(null);
    try {
      await api.post(`/events/${id}/unregister`, {}, token);
      setRegistered(false);
      setMessage("Registration cancelled.");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Failed to unregister"
      );
    } finally {
      setLoading(false);
    }
  }

  if (!id) return <p className="p-6 text-red-500">No event ID provided.</p>;
  if (error) return <p className="p-6 text-red-500">Event not found.</p>;
  if (!event) return <p className="p-6">Loading...</p>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      {event.cover_image && (
        <img
          src={event.cover_image}
          alt={event.title}
          width={1200}
          height={400}
          className="w-full h-64 object-cover rounded-xl mb-6"
        />
      )}
      <h1 className="text-3xl font-bold mb-2">{event.title}</h1>
      <div className="flex gap-2 text-sm text-gray-500 mb-4">
        <span>{event.category}</span>
        <span>&middot;</span>
        <span>{event.location}</span>
        <span>&middot;</span>
        <span>{event.status}</span>
      </div>
      <div className="text-sm text-gray-400 mb-6">
        {new Date(event.start_time).toLocaleString()} &mdash;{" "}
        {new Date(event.end_time).toLocaleString()}
        {event.capacity && <span> &middot; Capacity: {event.capacity}</span>}
      </div>
      <div className="prose mb-8">
        <p>{event.description}</p>
        {event.location_details && (
          <p className="text-sm text-gray-500">{event.location_details}</p>
        )}
        {event.tags && event.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {event.tags.map((tag) => (
              <span
                key={tag}
                className="inline-block text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Registration */}
      {event.status === "published" && (
        <div className="border-t pt-6">
          {!isLoggedIn ? (
            <p className="text-sm text-gray-500">
              <a href="/login" className="text-blue-600 hover:underline">
                Log in
              </a>{" "}
              to register for this event.
            </p>
          ) : registered ? (
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-green-600 font-medium">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                You are registered
              </span>
              <button
                onClick={() => setConfirmAction("unregister")}
                disabled={loading}
                className="text-sm text-red-600 hover:underline disabled:opacity-50"
              >
                Unregister
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmAction("register")}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {loading ? "Processing..." : "Register for Event"}
            </button>
          )}
          {message && (
            <p
              className={`text-sm mt-2 ${
                message.includes("Success") || message.includes("cancelled")
                  ? "text-green-600"
                  : "text-red-500"
              }`}
            >
              {message}
            </p>
          )}
        </div>
      )}

      {/* Comments */}
      <CommentsSection eventId={event.id} />

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) =>
            e.target === e.currentTarget && setConfirmAction(null)
          }
        >
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold mb-2">
              {confirmAction === "register"
                ? "Confirm Registration"
                : "Confirm Unregistration"}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {confirmAction === "register"
                ? `Are you sure you want to register for "${event.title}"?`
                : `Are you sure you want to unregister from "${event.title}"? You may lose your spot.`}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={
                  confirmAction === "register" ? doRegister : doUnregister
                }
                className={`px-4 py-2 rounded-lg text-sm text-white font-medium ${
                  confirmAction === "register"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {confirmAction === "register" ? "Register" : "Unregister"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Comments Section ---

interface Comment {
  id: number;
  event_id: number;
  user_id: number;
  user_name: string;
  parent_id: number | null;
  body: string;
  is_hidden: boolean;
  created_at: string;
}

// Extend the fetched shape with a pre-formatted date so we don't call
// toLocaleDateString on every render inside each CommentThread.
interface CommentView extends Comment {
  formatted_date: string;
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

function toView(c: Comment): CommentView {
  return {
    ...c,
    formatted_date: new Date(c.created_at).toLocaleDateString(
      undefined,
      DATE_FORMAT,
    ),
  };
}

function CommentsSection({ eventId }: { eventId: number }) {
  const [comments, setComments] = useState<CommentView[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const token = getToken();
  const isLoggedIn = !!token;
  const claims = token ? parseJwt(token) : null;
  const isAdmin = claims?.role === "admin";

  useEffect(() => {
    const controller = new AbortController();
    const params = isAdmin ? "?include_hidden=true" : "";
    api
      .get<Comment[]>(
        `/events/${eventId}/comments${params}`,
        undefined,
        controller.signal,
      )
      .then((data) => setComments(data.map(toView)))
      .catch((err) => {
        if (!isAbortError(err)) {
          // eslint-disable-next-line no-console
          console.error(err);
        }
      });
    return () => controller.abort();
  }, [eventId, isAdmin]);

  // Reload after mutations (hide/unhide/new comment). Not cancelable by
  // design — these are user-initiated and short.
  async function reload() {
    const params = isAdmin ? "?include_hidden=true" : "";
    const data = await api.get<Comment[]>(
      `/events/${eventId}/comments${params}`,
    );
    setComments(data.map(toView));
  }

  // Build the parent -> children index once per comments change so typing
  // in the textarea doesn't rebuild the tree on every keystroke.
  const repliesMap = useMemo(() => {
    const m = new Map<number | null, CommentView[]>();
    for (const c of comments) {
      const arr = m.get(c.parent_id) || [];
      arr.push(c);
      m.set(c.parent_id, arr);
    }
    return m;
  }, [comments]);
  const topLevel = repliesMap.get(null) || [];

  async function toggleHide(commentId: number, currentlyHidden: boolean) {
    if (!token) return;
    const action = currentlyHidden ? "unhide" : "hide";
    await api.post(
      `/events/${eventId}/comments/${commentId}/${action}`,
      {},
      token,
    );
    reload();
  }

  async function submitComment(body: string, parentId: number | null = null) {
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      await api.post(
        `/events/${eventId}/comments`,
        { body: body.trim(), parent_id: parentId },
        token!,
      );
      setNewComment("");
      setReplyingToId(null);
      await reload();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-t pt-6 mt-8">
      <h2 className="text-xl font-bold mb-4">
        Comments ({comments.length})
      </h2>

      {/* New top-level comment form */}
      {isLoggedIn ? (
        <div className="mb-6">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Leave a comment..."
            rows={3}
            className="w-full border-b px-1 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => submitComment(newComment)}
            disabled={submitting || !newComment.trim()}
            className="mt-2 bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Posting..." : "Comment"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-6">
          <a href="/login" className="text-blue-600 hover:underline">
            Log in
          </a>{" "}
          to leave a comment.
        </p>
      )}

      {/* Comment tree */}
      {topLevel.length === 0 ? (
        <p className="text-sm text-gray-400">No comments yet.</p>
      ) : (
        <div>
          {topLevel.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              repliesMap={repliesMap}
              depth={0}
              isAdmin={isAdmin}
              isLoggedIn={isLoggedIn}
              replyingToId={replyingToId}
              setReplyingToId={setReplyingToId}
              onSubmitReply={submitComment}
              onToggleHide={toggleHide}
              submitting={submitting}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const MAX_INDENT_DEPTH = 6;

// Memoized so typing in the new-comment textarea doesn't re-render the
// entire tree. Parent passes a stable `repliesMap` (via useMemo) and stable
// handlers (defined in component scope — acceptable because we compare
// props shallowly and the callbacks only change if the parent remounts).
const CommentThread = memo(function CommentThread({
  comment,
  repliesMap,
  depth,
  isAdmin,
  isLoggedIn,
  replyingToId,
  setReplyingToId,
  onSubmitReply,
  onToggleHide,
  submitting,
}: {
  comment: CommentView;
  repliesMap: Map<number | null, CommentView[]>;
  depth: number;
  isAdmin: boolean;
  isLoggedIn: boolean;
  replyingToId: number | null;
  setReplyingToId: (id: number | null) => void;
  onSubmitReply: (body: string, parentId: number | null) => void;
  onToggleHide: (commentId: number, currentlyHidden: boolean) => void;
  submitting: boolean;
}) {
  const [replyText, setReplyText] = useState("");
  const [collapsed, setCollapsed] = useState(true);
  const children = repliesMap.get(comment.id) || [];
  const isReplying = replyingToId === comment.id;
  const indent = Math.min(depth, MAX_INDENT_DEPTH);

  return (
    <div style={{ marginLeft: indent > 0 ? 24 : 0 }}>
      {/* Comment */}
      <div className={`py-3 ${comment.is_hidden ? "opacity-40" : ""}`}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{comment.user_name}</span>
          <span className="text-xs text-gray-400">{comment.formatted_date}</span>
          {comment.is_hidden && (
            <span className="text-xs text-red-400">(hidden)</span>
          )}
        </div>
        <p className="text-sm text-gray-800 mt-1">{comment.body}</p>
        <div className="flex items-center gap-4 mt-2">
          {isLoggedIn && !isReplying && !comment.is_hidden && (
            <button
              onClick={() => setReplyingToId(comment.id)}
              className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Reply
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => onToggleHide(comment.id, comment.is_hidden)}
              className={`text-xs hover:underline ${
                comment.is_hidden ? "text-green-600" : "text-red-500"
              }`}
            >
              {comment.is_hidden ? "Unhide" : "Hide"}
            </button>
          )}
        </div>
      </div>

      {/* Inline reply form */}
      {isReplying && (
        <div className="pb-3" style={{ marginLeft: 24 }}>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={`Reply to ${comment.user_name}...`}
            rows={2}
            className="w-full border-b px-1 py-2 text-sm focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                onSubmitReply(replyText, comment.id);
                setReplyText("");
              }}
              disabled={submitting || !replyText.trim()}
              className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs hover:bg-blue-700 disabled:opacity-50"
            >
              Reply
            </button>
            <button
              onClick={() => {
                setReplyingToId(null);
                setReplyText("");
              }}
              className="text-xs text-gray-500 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Collapsible replies (depth >= 2 starts collapsed) */}
      {children.length > 0 && (
        <>
          {depth >= 0 && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 pb-2"
            >
              <svg
                className={`w-3 h-3 transition-transform ${collapsed ? "" : "rotate-180"}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              {collapsed
                ? `See ${children.length} ${children.length === 1 ? "Reply" : "Replies"}`
                : `Hide ${children.length} ${children.length === 1 ? "Reply" : "Replies"}`}
            </button>
          )}
          {!collapsed && (
            <div>
              {children.map((child) => (
                <CommentThread
                  key={child.id}
                  comment={child}
                  repliesMap={repliesMap}
                  depth={depth + 1}
                  isAdmin={isAdmin}
                  isLoggedIn={isLoggedIn}
                  replyingToId={replyingToId}
                  setReplyingToId={setReplyingToId}
                  onSubmitReply={onSubmitReply}
                  onToggleHide={onToggleHide}
                  submitting={submitting}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
});
