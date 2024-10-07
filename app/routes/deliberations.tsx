import { Outlet, Link, useLoaderData, redirect } from "@remix-run/react"
import type { LoaderFunctionArgs } from "@remix-run/node"
import { useState } from "react"
import { auth, db } from "~/config.server"
import { Button } from "~/components/ui/button"
import { ScrollArea } from "~/components/ui/scroll-area"

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
  const [selectedDeliberation, setSelectedDeliberation] = useState<
    string | null
  >(null)

  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r border-slate-200 bg-slate-50">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-2">Your Deliberations</h2>
              <ul className="space-y-1">
                {deliberations.map((delib: any) => (
                  <li key={delib.id}>
                    <Link
                      to={String(delib.id)}
                      className={`block text-sm p-2 rounded ${
                        selectedDeliberation === delib.id
                          ? "bg-blue-100 text-blue-700"
                          : "hover:bg-gray-100"
                      }`}
                      onClick={() => setSelectedDeliberation(delib.id)}
                    >
                      {delib.title}
                    </Link>
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full mt-8">
                <Link to="/deliberations/new">New Deliberation</Link>
              </Button>
            </div>
          </div>
        </ScrollArea>
      </aside>
      <main className="flex-1 p-4 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
