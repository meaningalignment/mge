import { json } from "@remix-run/node"
import { NavLink, Outlet, useLoaderData, useParams } from "@remix-run/react"
import { db } from "~/config.server"
import { cn } from "~/lib/utils"

export async function loader() {
  const edges = await db.edge.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      userId: true,
      createdAt: true,
      fromId: true,
      toId: true,
      comment: true,
      type: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  return json({ edges })
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        status === "upgrade"
          ? "bg-green-100 text-green-800"
          : status === "not_sure"
          ? "bg-yellow-100 text-yellow-800"
          : "bg-red-100 text-red-800"
      )}
    >
      {status === "upgrade"
        ? "Upgrade"
        : status === "not_sure"
        ? "Not sure"
        : "No Upgrade"}
    </span>
  )
}

export default function AdminLinks() {
  const data = useLoaderData<typeof loader>()
  const { deliberationId } = useParams()

  return (
    <div className="flex h-screen">
      <div className="w-64 flex-shrink-0 border-r overflow-y-auto bg-white  px-3 py-4">
        <div className="mb-10 flex items-center rounded-lg px-3 py-2 text-slate-900 ">
          <svg
            className="h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
          <span className="ml-3 text-base font-semibold">Links</span>
        </div>
        <ul className="space-y-2 text-sm font-medium">
          {data.edges.map((edge) => (
            <NavLink
              prefetch="intent"
              to={`/dashboard/${deliberationId}/links/${edge.userId}/${edge.fromId}/${edge.toId}`}
              key={edge.userId + edge.fromId + edge.toId}
              className={({ isActive, isPending }) =>
                cn(
                  "block rounded-lg hover:bg-slate-100 ",
                  isPending && "bg-slate-50 ",
                  isActive && "bg-slate-100 "
                )
              }
            >
              <li className="px-3 py-2">
                <div className="font-medium">{edge.user.name}</div>
                <div className="text-sm text-slate-500 ">{edge.user.email}</div>
                <div className="text-xs text-slate-400  mt-1">
                  {edge.createdAt}
                </div>
                <StatusBadge status={edge.type} />
              </li>
            </NavLink>
          ))}
        </ul>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
