import { json } from "@remix-run/node"
import { NavLink, Outlet, useLoaderData, useParams } from "@remix-run/react"
import { db } from "~/config.server"
import { cn } from "~/lib/utils"

export async function loader() {
  const chats = await db.chat.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      copiedFromId: true,
      evaluation: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      ValuesCard: {
        select: { id: true },
      },
    },
  })

  return json({ chats })
}

function StatusBadge({ hasValuesCard }: { hasValuesCard: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        hasValuesCard
          ? "bg-green-100 text-green-800"
          : "bg-yellow-100 text-yellow-800"
      )}
    >
      {hasValuesCard ? "Submitted Card" : "No Card"}
    </span>
  )
}

export default function AdminChats() {
  const data = useLoaderData<typeof loader>()
  const { deliberationId } = useParams()

  return (
    <div className="grid grid-cols-4 h-screen">
      <div className="col-span-1 border-r overflow-y-auto bg-white dark:bg-slate-900 px-3 py-4">
        <div className="mb-10 flex items-center rounded-lg px-3 py-2 text-slate-900 dark:text-white">
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
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="ml-3 text-base font-semibold">Chats</span>
        </div>
        <ul className="space-y-2 text-sm font-medium">
          {data.chats.map((chat) => (
            <NavLink
              to={`/deliberations/${deliberationId}/chats/${chat.id}`}
              key={chat.id}
              className={({ isActive, isPending }) =>
                cn(
                  "block rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700",
                  isPending && "bg-slate-50 dark:bg-slate-800",
                  isActive && "bg-slate-100 dark:bg-slate-700"
                )
              }
            >
              <li className="px-3 py-2">
                <div className="font-medium">{chat.user.name}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {chat.user.email}
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {chat.createdAt}
                </div>
                {chat.evaluation && (
                  <div className="mt-1">
                    <span className="text-sm text-red-500">
                      {(chat.evaluation as any).worst_score}
                    </span>
                  </div>
                )}
                {chat.copiedFromId && (
                  <div className="text-xs font-bold mt-1 text-slate-500">
                    Copied from {chat.copiedFromId}
                  </div>
                )}
                <div className="mt-2">
                  <StatusBadge hasValuesCard={chat.ValuesCard !== null} />
                </div>
              </li>
            </NavLink>
          ))}
        </ul>
      </div>
      <div className="col-span-3 p-4 overflow-y-auto h-screen">
        <Outlet />
      </div>
    </div>
  )
}
