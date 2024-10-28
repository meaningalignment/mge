import { PrismaClient, Prisma } from "@prisma/client"
import { cowpunkify } from "cowpunk-auth"
import { Inngest } from "inngest"
import { OpenAI } from "openai"
import { redirect } from "@remix-run/node"
import { configureValuesTools, PromptCache } from "values-tools"

export const db = new PrismaClient()

export const auth = cowpunkify({
  site: "Moral Graph Elicitation",
  loginFrom: "Moral Graph Elicitation <info@meaningalignment.org>",
  users: db.user,
  emailCodes: db.emailCodes,
})

export async function ensureLoggedIn(request: Request, extraParams = {}) {
  const userId = (await auth.getUserId(request)) as number | undefined
  if (!userId) {
    const params = new URLSearchParams({
      redirect: request.url,
      ...extraParams,
    })
    throw redirect(`/auth/login?${params.toString()}`)
  } else {
    return userId
  }
}

export const inngest = new Inngest({
  name: process.env.INNGEST_NAME ?? "Moral Graph Elicitation",
  apiKey: process.env.INNGEST_API_KEY,
  eventKey: process.env.INNGEST_EVENT_KEY,
})

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})
