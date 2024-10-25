import { json, LoaderFunctionArgs, redirect } from "@remix-run/node"
import { useLoaderData, Link } from "@remix-run/react"
import { Button } from "~/components/ui/button"
import { auth, db } from "~/config.server"

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await auth.getUserId(request)
  const deliberation = await db.deliberation.findFirst({
    where: { createdBy: userId },
  })

  if (deliberation) {
    return redirect(`/deliberations/${deliberation.id}`)
  }

  return json({ hasDeliberations: false })
}

export default function DeliberationsIndex() {
  const { hasDeliberations } = useLoaderData<typeof loader>()

  if (hasDeliberations) {
    return null // This shouldn't render, as we're redirecting
  }

  return (
    <div className="container mx-auto flex flex-col items-center justify-center h-screen space-y-6">
      <h1 className="text-3xl font-bold text-center">Welcome</h1>
      <p className="text-center text-gray-600">
        To get started, create a new type of deliberation.
      </p>
      <Button asChild>
        <Link prefetch="intent" to="/deliberations/new">
          New Deliberation
        </Link>
      </Button>
    </div>
  )
}
