import { LoaderFunctionArgs, defer } from "@remix-run/node"
import { Suspense } from "react"
import { Await, useLoaderData } from "@remix-run/react"
import { MoralGraph } from "~/components/moral-graph"
import { summarizeGraph } from "values-tools"
import { defaultGraphSettings } from "~/components/moral-graph-settings"
import { db } from "~/config.server"

export async function loader({ params }: LoaderFunctionArgs) {
  const questionId = params.questionId!
  const values = await db.valuesCard.findMany()
  const edges = await db.edge.findMany({
    where: {
      context: {
        ContextsForQuestions: { some: { questionId } },
      },
    },
  })
  const graph = summarizeGraph(values, edges)
  return defer({ graph })
}

export default function DefaultGraphPage() {
  const { graph } = useLoaderData<typeof loader>()
  return (
    <Suspense fallback={<p>Please wait...</p>}>
      <Await resolve={graph}>
        {({ values, edges }) => (
          <MoralGraph
            nodes={values.map((v) => ({ ...v, title: v.title || "" }))}
            edges={edges}
            settings={defaultGraphSettings}
          />
        )}
      </Await>
    </Suspense>
  )
}
