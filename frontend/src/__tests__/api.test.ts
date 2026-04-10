import { api } from "@/lib/api";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("api client", () => {
  it("makes GET requests", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    });

    const result = await api.get("/events");
    expect(result).toEqual({ items: [], total: 0 });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/events",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("makes POST requests with body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "abc123", user_id: 1 }),
    });

    const result = await api.post("/auth/login", {
      email: "test@test.com",
      password: "pass",
    });

    expect(result).toEqual({ token: "abc123", user_id: 1 });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "test@test.com", password: "pass" }),
      })
    );
  });

  it("includes authorization header when token provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([]),
    });

    await api.get("/notifications", "my-token");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my-token",
        }),
      })
    );
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Not Found",
      json: async () => ({ error: "Event not found" }),
    });

    await expect(api.get("/events/999")).rejects.toThrow("Event not found");
  });

  it("makes PUT requests", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1, title: "Updated" }),
    });

    const result = await api.put("/events/1", { title: "Updated" }, "token");
    expect(result).toEqual({ id: 1, title: "Updated" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "PUT" })
    );
  });
});
