import { Link } from "@remix-run/react"
import React from "react"

export default function DeliberationsIndex() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h1 className="text-3xl font-bold mb-4">Welcome!</h1>
      <p className="text-lg mb-6">To get started, create a new deliberation.</p>
      {/* New Deliberation Button in Empty Screen */}
      <Link
        to="/deliberations/new"
        className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
      >
        New Deliberation
      </Link>
    </div>
  )
}
