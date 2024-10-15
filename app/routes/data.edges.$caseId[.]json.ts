import { LoaderFunctionArgs, json } from "@remix-run/node"
import { summarizeGraph } from "values-tools"
import { db } from "~/config.server"

export async function loader({ params }: LoaderFunctionArgs) {
  const questionId = params.questionId! // TODO!
  const values = await db.valuesCard.findMany()
  const edges = await db.edge.findMany()
  const graph = await summarizeGraph(values, edges)
  return json(graph)
}
