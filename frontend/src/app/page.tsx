import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">GISC Event Management</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Browse upcoming events, register to attend, and stay updated with
          real-time notifications.
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <Link
            href="/events"
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium"
          >
            Browse Events
          </Link>
          <Link
            href="/search"
            className="border border-gray-300 px-6 py-2.5 rounded-lg hover:bg-gray-50 font-medium"
          >
            Search
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="p-6 border rounded-xl">
          <div className="text-2xl mb-3">&#128197;</div>
          <h2 className="font-semibold text-lg mb-2">Discover Events</h2>
          <p className="text-sm text-gray-600">
            Browse and search events by name, category, or location. Find
            conferences, workshops, and meetups near you.
          </p>
        </div>
        <div className="p-6 border rounded-xl">
          <div className="text-2xl mb-3">&#9997;&#65039;</div>
          <h2 className="font-semibold text-lg mb-2">Register & Comment</h2>
          <p className="text-sm text-gray-600">
            Sign up for events with one click. Ask questions and share feedback
            in the comments section.
          </p>
        </div>
        <div className="p-6 border rounded-xl">
          <div className="text-2xl mb-3">&#128276;</div>
          <h2 className="font-semibold text-lg mb-2">Stay Updated</h2>
          <p className="text-sm text-gray-600">
            Receive notifications when events you registered for are updated,
            rescheduled, or cancelled.
          </p>
        </div>
      </div>
    </div>
  );
}
