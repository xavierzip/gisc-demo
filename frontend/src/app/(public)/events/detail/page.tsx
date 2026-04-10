import { Suspense } from "react";
import EventDetail from "./event-detail";

export default function EventDetailPage() {
  return (
    <Suspense fallback={<p className="p-6">Loading...</p>}>
      <EventDetail />
    </Suspense>
  );
}
