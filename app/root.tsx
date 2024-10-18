import { json, SerializeFrom, type LoaderFunctionArgs } from "@remix-run/node"
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "@remix-run/react"
import { auth, db } from "./config.server"
import { Deliberation, User, ValuesCard } from "@prisma/client"

import "./globals.css"
import { TooltipProvider } from "@radix-ui/react-tooltip"
import { d } from "node_modules/vite/dist/node/types.d-aGj9QkWt"

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await auth.getUserId(request)

  const user =
    userId &&
    ((await db.user.findUnique({
      where: { id: userId },
    })) as User | null)

  const values =
    userId &&
    ((await db.valuesCard.findMany({
      where: { chat: { userId } },
    })) as ValuesCard[] | null)

  const deliberation =
    params.deliberationId &&
    ((await db.deliberation.findFirst({
      where: {
        id: Number(params.deliberationId),
      },
    })) as Deliberation | null)

  return json({ user, values, deliberation })
}

export function useCurrentUser(): User | null {
  const { user } = useRouteLoaderData("root") as SerializeFrom<typeof loader>
  return user
}

export function useCurrentUserValues(): ValuesCard[] | null {
  const { values } = useRouteLoaderData("root") as SerializeFrom<typeof loader>
  return values
}

export function useCurrentDeliberation(): Deliberation | null {
  const { deliberation } = useRouteLoaderData("root") as SerializeFrom<
    typeof loader
  >
  return deliberation as Deliberation | null
}

export default function App() {
  return (
    <TooltipProvider>
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <Meta />
          <Links />
        </head>
        <body>
          <Outlet />
          <ScrollRestoration />
          <Scripts />
        </body>
      </html>
    </TooltipProvider>
  )
}
