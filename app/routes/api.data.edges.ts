import { Prisma } from "@prisma/client"
import { LoaderFunctionArgs } from "@remix-run/node"
import { summarizeGraph } from "values-tools"
import { db } from "~/config.server"

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const contextId = url.searchParams.get("contextId")
  const hypothesisRunId = url.searchParams.get("hypothesisRunId")
  const includePageRank = url.searchParams.get("includePageRank") !== null

  let edgeWhere: Prisma.EdgeWhereInput = {}

  if (hypothesisRunId) {
    edgeWhere = edgeWhere || {}
    edgeWhere.user = {}
  }

  if (contextId) {
    edgeWhere = edgeWhere || {}
    edgeWhere.context = { ContextsForQuestions: { some: { contextId } } }
  }

  const values = await db.canonicalValuesCard.findMany()
  const edges = await db.edge.findMany({ where: edgeWhere })

  return summarizeGraph(values, edges, { includePageRank })
}
