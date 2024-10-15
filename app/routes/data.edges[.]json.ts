import { LoaderFunctionArgs, json } from "@remix-run/node"
import { summarizeGraph } from "values-tools"
import { db } from "~/config.server"

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)

  const options: any = {}

  const hypothesisRunId = url.searchParams.get("hypothesisRunId")
  if (hypothesisRunId) {
    options.edgeWhere = options.edgeWhere || {}
    options.edgeWhere.user = {}
  }

  const questionId = url.searchParams.get("questionId")
  if (questionId) {
    options.edgeWhere = options.edgeWhere || {}
    options.edgeWhere.context = {
      ContextsOnCases: { some: { questionId } },
    }
  }

  options.includeAllEdges = url.searchParams.get("includeAllEdges") === "true"
  options.includePageRank = url.searchParams.get("includePageRank") === "true"

  const edges = await db.edge.findMany({
    where: options.edgeWhere,
  })
  const values = await db.valuesCard.findMany()
  const graph = await summarizeGraph(values, edges, options)

  return json(graph)
}
