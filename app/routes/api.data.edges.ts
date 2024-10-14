import { LoaderFunctionArgs } from "@remix-run/node"
import {
  Options,
  summarizeGraph,
} from "~/values-tools-legacy/generate-moral-graph"

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const contextId = url.searchParams.get("contextId")
  const runId = url.searchParams.get("runId")
  const includePageRank = url.searchParams.get("includePageRank")

  const options: Options = {}

  if (runId) {
    options.edgeWhere = options.edgeWhere || {}
    options.edgeWhere.user = {}
  }

  if (contextId) {
    options.edgeWhere = options.edgeWhere || {}
    options.edgeWhere.context = {
      ContextsOnCases: { some: { contextId } },
    }
  }

  if (includePageRank) {
    options.includePageRank = true
  }

  return summarizeGraph(options)
}
