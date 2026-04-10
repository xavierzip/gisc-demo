"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

interface DashboardData {
  events_by_status: Record<string, number>;
  total_registrations: number;
  total_comments: number;
  visible_comments: number;
  total_users: number;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api.get<DashboardData>("/admin/dashboard", token).then(setData).catch(() => {});
  }, []);

  if (!data) return <p className="p-6">Loading...</p>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(data.events_by_status).map(([status, count]) => (
          <div key={status} className="p-4 border rounded-lg text-center">
            <p className="text-2xl font-bold">{count}</p>
            <p className="text-sm text-gray-500 capitalize">{status}</p>
          </div>
        ))}
        <div className="p-4 border rounded-lg text-center">
          <p className="text-2xl font-bold">{data.total_users}</p>
          <p className="text-sm text-gray-500">Users</p>
        </div>
        <div className="p-4 border rounded-lg text-center">
          <p className="text-2xl font-bold">{data.total_registrations}</p>
          <p className="text-sm text-gray-500">Registrations</p>
        </div>
        <div className="p-4 border rounded-lg text-center">
          <p className="text-2xl font-bold">{data.total_comments}</p>
          <p className="text-sm text-gray-500">Comments</p>
        </div>
      </div>
    </div>
  );
}
