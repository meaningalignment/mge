import { LoaderFunctionArgs } from "@remix-run/node"
import {
  Options,
  summarizeGraph,
} from "~/values-tools-legacy/generate-moral-graph"

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const choiceTypeId = url.searchParams.get("choiceTypeId")
  const runId = url.searchParams.get("runId")
  const includePageRank = url.searchParams.get("includePageRank")

  const options: Options = {}

  if (runId) {
    options.edgeWhere = options.edgeWhere || {}
    options.edgeWhere.user = {}
  }

  if (choiceTypeId) {
    options.edgeWhere = options.edgeWhere || {}
    options.edgeWhere.choiceType = {
      ChoiceTypesOnCases: { some: { choiceTypeId } },
    }
  }

  if (includePageRank) {
    options.includePageRank = true
  }

  return summarizeGraph(options)
}
