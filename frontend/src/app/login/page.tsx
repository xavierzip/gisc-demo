"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { safeNextPath, setToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (isRegister) {
        const res = await api.post<{ token: string }>("/auth/register", {
          email,
          password,
          full_name: fullName,
        });
        setToken(res.token);
      } else {
        const res = await api.post<{ token: string }>("/auth/login", {
          email,
          password,
        });
        setToken(res.token);
      }
      // Read ?next= from the URL in the handler rather than via
      // useSearchParams, so the login page doesn't need a Suspense
      // boundary. Validated to same-origin paths to prevent open
      // redirect.
      const next = safeNextPath(
        new URLSearchParams(window.location.search).get("next"),
      );
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="max-w-sm mx-auto p-6 mt-16">
      <h1 className="text-2xl font-bold mb-6">
        {isRegister ? "Create Account" : "Login"}
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isRegister && (
          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="border rounded-lg px-4 py-2"
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded-lg px-4 py-2"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded-lg px-4 py-2"
          required
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          className="bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
        >
          {isRegister ? "Register" : "Login"}
        </button>
      </form>
      <p className="text-sm text-gray-500 mt-4 text-center">
        {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
        <button
          onClick={() => setIsRegister(!isRegister)}
          className="text-blue-600 hover:underline"
        >
          {isRegister ? "Login" : "Register"}
        </button>
      </p>
    </div>
  );
}
