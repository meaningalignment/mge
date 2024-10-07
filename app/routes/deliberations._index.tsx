import { Link } from "@remix-run/react"
import { Button } from "~/components/ui/button"

export default function DeliberationsIndex() {
  return (
    <div className="container mx-auto flex flex-col items-center justify-center h-screen space-y-6">
      <h1 className="text-3xl font-bold text-center">Welcome</h1>
      <p className="text-center text-gray-600">
        To get started, create a new type of deliberation.
      </p>
      <Button asChild>
        <Link to="/deliberations/new">New Deliberation</Link>
      </Button>
    </div>
  )
}
