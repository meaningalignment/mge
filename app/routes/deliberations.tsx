import {
  Outlet,
  NavLink,
  useLoaderData,
  redirect,
  useParams,
} from "@remix-run/react"
import type { LoaderFunctionArgs } from "@remix-run/node"
import { auth, db } from "~/config.server"
import { Button } from "~/components/ui/button"
import { ScrollArea } from "~/components/ui/scroll-area"
import { cn } from "~/lib/utils"

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
  const params = useParams()

  return (
    <div className="h-screen w-screen bg-white dark:bg-slate-900">
      <aside
        id="sidebar"
        className="fixed left-0 top-0 z-40 h-screen w-64 transition-transform"
        aria-label="Sidebar"
      >
        <div className="flex h-full flex-col overflow-y-auto border-r border-slate-200 bg-white px-3 py-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-10 flex items-center rounded-lg px-3 py-2 text-slate-900 dark:text-white">
            <svg
              className="h-5 w-5"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
            </svg>
            <span className="ml-3 text-base font-semibold">Deliberations</span>
          </div>
          <ScrollArea className="flex-grow">
            <ul className="space-y-2 text-sm font-medium">
              {deliberations.map((delib: any) => (
                <li key={delib.id}>
                  <NavLink
                    to={`/deliberations/${delib.id}`}
                    className={({ isActive, isPending }) =>
                      cn(
                        "flex items-center rounded-lg px-3 py-2 text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-700",
                        isPending && "bg-slate-50 dark:bg-slate-800",
                        isActive && "bg-slate-100 dark:bg-slate-700"
                      )
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="ml-3 flex-1 whitespace-nowrap">
                      {delib.title}
                    </span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </ScrollArea>
          <div className="mt-auto pt-4">
            <Button variant="outline" className="w-full">
              <NavLink
                to="/deliberations/new"
                prefetch="intent"
                className="w-full flex items-center justify-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                New Deliberation
              </NavLink>
            </Button>
          </div>
        </div>
      </aside>
      <main className="ml-64 p-4 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
