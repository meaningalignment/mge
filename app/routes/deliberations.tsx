import { Outlet, Link, useLoaderData, redirect } from "@remix-run/react"
import type { LoaderFunctionArgs } from "@remix-run/node"
import React from "react"
import { auth, db } from "~/config.server"
import { Button } from "~/components/ui/button"

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await auth.getCurrentUser(request)
  if (!user) return redirect("/auth/login")
  const deliberations = await db.deliberation.findMany({
    where: { createdBy: user.id },
  })
  const participatingIn = await db.deliberation.findMany({
    where: {
      OR: [
        {
          edges: {
            some: {
              userId: user.id,
            },
          },
        },
        {
          chats: {
            some: {
              userId: user.id,
            },
          },
        },
      ],
    },
  })
  return { deliberations, participatingIn }
}

export default function Deliberations() {
  const { deliberations, participatingIn } = useLoaderData<typeof loader>()

  return (
    <div className="flex">
      <aside className="w-64 h-screen bg-gray-100 p-4 flex flex-col">
        <h2 className="text-xl font-bold mb-4">Your Deliberations</h2>
        <ul className="flex-1">
          {deliberations.map((delib: any) => (
            <li key={delib.id}>
              <Link
                to={String(delib.id)}
                className="text-blue-500 hover:underline"
              >
                {delib.title}
              </Link>
            </li>
          ))}
          {/* New Deliberation Button in Sidebar */}
          <Button variant="link">
            <Link to="/deliberations/new">New Deliberation</Link>
          </Button>
        </ul>
        <h2 className="text-xl font-bold mt-8 mb-4">Participating In</h2>
        <ul className="flex-1">
          {participatingIn.map((delib: any) => (
            <li key={delib.id}>
              <Link
                to={String(delib.id)}
                className="text-blue-500 hover:underline"
              >
                {delib.title}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  )
}
