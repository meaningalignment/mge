import { json } from "@remix-run/node"
import { summarizeGraph } from "values-tools"
import { MoralGraph as MoralGraphSummary } from "values-tools"
import { db } from "~/config.server"

type WiseValue = MoralGraphSummary["values"][0] & {
  wisdom: number
  contexts: Set<string>
}

export async function loader() {
  const allValues = await db.valuesCard.findMany()
  const allEdges = await db.edge.findMany()
  const { edges, values } = await summarizeGraph(allValues, allEdges)

  edges.forEach((link) => {
    const t = values.find((node) => node.id === link.wiserValueId) as
      | WiseValue
      | undefined
    if (t) {
      if (!t.wisdom) t.wisdom = link.summary.wiserLikelihood
      else t.wisdom += link.summary.wiserLikelihood
    }
  })

  const sorted = (values as WiseValue[])
    .sort((a, b) => {
      if (!a.wisdom) return 1
      if (!b.wisdom) return -1
      return b.wisdom - a.wisdom
    })
    .filter((v) => v.wisdom > 1)
    .map((v) => ({
      id: v.id,
      title: v.title,
      attentionalPolicies: v.policies,
      pageRank: v.pageRank,
      contexts: [...v.contexts],
    }))

  return json(sorted)
}
