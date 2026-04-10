/**
 * @jest-environment jsdom
 */
import {
  getToken,
  setToken,
  clearToken,
  parseJwt,
  isTokenExpired,
  safeNextPath,
} from "@/lib/auth";

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(payload));
  return `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${encoded}.fakesig`;
}

beforeEach(() => {
  localStorage.clear();
});

describe("auth helpers", () => {
  it("returns null when no token stored", () => {
    expect(getToken()).toBeNull();
  });

  it("stores and retrieves token", () => {
    setToken("test-token-123");
    expect(getToken()).toBe("test-token-123");
  });

  it("clears token", () => {
    setToken("test-token-123");
    clearToken();
    expect(getToken()).toBeNull();
  });

  it("parses a valid JWT payload", () => {
    // Create a minimal JWT: header.payload.signature
    const payload = { sub: "1", role: "admin", exp: 9999999999 };
    const encoded = btoa(JSON.stringify(payload));
    const fakeJwt = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${encoded}.fakesig`;

    const result = parseJwt(fakeJwt);
    expect(result).toEqual(payload);
  });

  it("returns null for invalid JWT", () => {
    expect(parseJwt("not-a-jwt")).toBeNull();
    expect(parseJwt("")).toBeNull();
  });

  it("treats tokens with a past exp claim as expired", () => {
    const expired = makeJwt({ sub: "1", exp: 1 }); // epoch 1 = 1970
    expect(isTokenExpired(expired)).toBe(true);
  });

  it("treats tokens with a future exp claim as valid", () => {
    const fresh = makeJwt({ sub: "1", exp: 9999999999 });
    expect(isTokenExpired(fresh)).toBe(false);
  });

  it("treats tokens with no exp claim as valid", () => {
    const noExp = makeJwt({ sub: "1" });
    expect(isTokenExpired(noExp)).toBe(false);
  });

  it("getToken auto-clears expired tokens", () => {
    const expired = makeJwt({ sub: "1", exp: 1 });
    setToken(expired);
    expect(getToken()).toBeNull();
    // and it should be wiped from storage, not just filtered on read
    expect(localStorage.getItem("gisc_token")).toBeNull();
  });

  describe("safeNextPath", () => {
    it("returns / when next is missing", () => {
      expect(safeNextPath(null)).toBe("/");
      expect(safeNextPath(undefined)).toBe("/");
      expect(safeNextPath("")).toBe("/");
    });

    it("accepts same-origin absolute paths", () => {
      expect(safeNextPath("/my-events")).toBe("/my-events");
      expect(safeNextPath("/admin/dashboard")).toBe("/admin/dashboard");
      expect(safeNextPath("/events/detail?id=42")).toBe("/events/detail?id=42");
    });

    it("rejects protocol-relative URLs", () => {
      expect(safeNextPath("//evil.com")).toBe("/");
      expect(safeNextPath("//evil.com/path")).toBe("/");
    });

    it("rejects backslash tricks", () => {
      expect(safeNextPath("/\\evil.com")).toBe("/");
    });

    it("rejects absolute URLs to other origins", () => {
      expect(safeNextPath("https://evil.com")).toBe("/");
      expect(safeNextPath("http://evil.com/path")).toBe("/");
      expect(safeNextPath("javascript:alert(1)")).toBe("/");
    });

    it("rejects relative paths without a leading slash", () => {
      expect(safeNextPath("my-events")).toBe("/");
      expect(safeNextPath("../admin")).toBe("/");
    });
  });
});
