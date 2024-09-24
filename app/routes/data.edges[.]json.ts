import { LoaderFunctionArgs, json } from "@remix-run/node"
import { Options, summarizeGraph } from "~/values-tools/generate-moral-graph"

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)

  const options: Options = {}

  const runId = url.searchParams.get("runId")
  if (runId) {
    options.edgeWhere = options.edgeWhere || {}
    options.edgeWhere.user = {}
  }

  const questionId = url.searchParams.get("questionId")
  if (questionId) {
    options.edgeWhere = options.edgeWhere || {}
    options.edgeWhere.choiceType = {
      ChoiceTypesOnCases: { some: { questionId } },
    }
  }

  options.includeAllEdges = url.searchParams.get("includeAllEdges") === "true"
  options.includePageRank = url.searchParams.get("includePageRank") === "true"

  const graph = await summarizeGraph(options)

  return json(graph)
}
