import { useEffect, useState } from "react"
import { Card, CardContent, CardFooter } from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { LoaderFunctionArgs } from "@remix-run/node"
import { db } from "~/config.server"
import { useLoaderData, Link, useParams } from "@remix-run/react"
import { MoralGraph } from "values-tools"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { MoralGraphEdge, MoralGraphValue } from "values-tools/src/types"
import { Intervention } from "@prisma/client"

const N_VALUES = 6

type Node = MoralGraphValue & {
  x: number
  y: number
  group: number
  normalizedScore: number
  isWinningValue: boolean
}

type Link = MoralGraphEdge & {
  source: Node
  target: Node
  color: string
}

function categorizeSupportLevel(
  pageRankValues: number[]
): "broadly supported" | "some support" | "contested" {
  if (pageRankValues.length < 2) {
    throw new Error("Need at least 2 values to categorize support level")
  }

  // Sort values in descending order
  const sortedValues = [...pageRankValues].sort((a, b) => b - a)
  const winner = sortedValues[0]
  const runnerUp = sortedValues[1]

  // Calculate statistical measures
  const mean =
    sortedValues.reduce((sum, val) => sum + val, 0) / sortedValues.length
  const variance =
    sortedValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    sortedValues.length
  const stdDev = Math.sqrt(variance)

  // Calculate key metrics
  const standardDeviations = stdDev === 0 ? 0 : (winner - mean) / stdDev
  const gapRatio = runnerUp === 0 ? Infinity : winner / runnerUp

  // Determine category based on stricter metrics
  if (standardDeviations > 2.5 && gapRatio > 2.0) {
    return "broadly supported"
  } else if (standardDeviations > 1.5 || gapRatio > 1.5) {
    return "some support"
  } else {
    return "contested"
  }
}

function convertMoralGraphToForceGraph(moralGraph: MoralGraph) {
  const maxPageRank = Math.max(...moralGraph.values.map((v) => v.pageRank || 0))
  const minPageRank = Math.min(...moralGraph.values.map((v) => v.pageRank || 0))

  // Sort values by pageRank and take top 6
  const topValues = [...moralGraph.values]
    .sort((a, b) => (b.pageRank || 0) - (a.pageRank || 0))
    .slice(0, N_VALUES)
  const topValueIds = new Set(topValues.map((v) => v.id))

  const nodes: Node[] = topValues.map((value) => ({
    ...value,
    x: 0,
    y: 0,
    group: value.pageRank ? Math.floor(value.pageRank * 4) + 1 : 1,
    isWinningValue: value.pageRank === maxPageRank,
    normalizedScore:
      maxPageRank === minPageRank
        ? 1
        : ((value.pageRank || 0) - minPageRank) / (maxPageRank - minPageRank),
  }))

  // Only include edges between top values
  const links: Link[] = moralGraph.edges
    .filter(
      (edge) =>
        topValueIds.has(edge.sourceValueId) &&
        topValueIds.has(edge.wiserValueId)
    )
    .map((edge) => {
      const sourceValue = nodes.find((n) => n.id === edge.sourceValueId)
      const targetValue = nodes.find((n) => n.id === edge.wiserValueId)

      if (!sourceValue || !targetValue) {
        throw new Error("Invalid edge references")
      }

      let color = "gray" // default color

      const dominantAffiliation = edge.summary.dominantPoliticalAffiliation
      if (dominantAffiliation === "Republican") {
        color = "red"
      } else if (dominantAffiliation === "Democrat") {
        color = "blue"
      }

      return {
        ...edge,
        source: sourceValue,
        target: targetValue,
        color,
      }
    })

  return { nodes, links }
}

export async function loader({ params }: LoaderFunctionArgs) {
  const { deliberationId, questionId } = params

  const interventions = await db.intervention.findMany({
    where: {
      deliberationId: Number(deliberationId!),
      questionId: Number(questionId!),
    },
  })

  return { interventions }
}

function ForceGraphWrapper({ graphData }: { graphData: MoralGraph }) {
  const [ForceGraph, setForceGraph] = useState<any>(null)
  const [selectedValue, setSelectedValue] = useState<Node | null>(null)
  const [selectedLink, setSelectedLink] = useState<Link | null>(null)

  console.log(selectedLink)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    import("react-force-graph-2d").then((module) => {
      setForceGraph(() => module.default)
    })
  }, [])

  if (!ForceGraph) {
    return <div className="h-[200px] bg-muted rounded-lg" />
  }

  const forceGraphData = convertMoralGraphToForceGraph(graphData)

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <ForceGraph
                graphData={forceGraphData}
                nodeAutoColorBy={() => "other"}
                nodeColor={() => "gray"}
                linkColor={(link: { color: string }) => link.color}
                linkDirectionalParticles={4}
                linkDirectionalParticleSpeed={(link: any) => {
                  const targetNode = forceGraphData.nodes.find(
                    (node) => node.id === link.target.id
                  )
                  return targetNode
                    ? 0.001 + targetNode.normalizedScore * 0.009
                    : 0.005
                }}
                linkDirectionalParticleWidth={2}
                d3Force={(d3Force: any) => {
                  d3Force("charge").strength(-200)
                  d3Force("link").distance(100)
                }}
                nodeCanvasObject={(
                  node: Node,
                  ctx: CanvasRenderingContext2D,
                  globalScale: number
                ) => {
                  const label = node.title
                  const fontSize = 12 / globalScale
                  ctx.font = `${
                    node.isWinningValue ? "bold" : ""
                  } ${fontSize}px Sans-Serif`
                  ctx.textAlign = "center"
                  ctx.textBaseline = "middle"
                  ctx.fillStyle = node.isWinningValue
                    ? `rgb(0, 0, 0)`
                    : `rgb(128, 128, 128)`

                  ctx.fillText(String(label), node.x, node.y)
                }}
                width={500}
                height={300}
                enableZoomInteraction={!isDialogOpen}
                enableDragInteraction={!isDialogOpen}
                enableNodeDrag={!isDialogOpen}
                onNodeClick={(node: Node) => {
                  if (!isDialogOpen) {
                    setSelectedValue(node)
                  }
                }}
                onLinkClick={(link: Link) => {
                  if (!isDialogOpen) {
                    setSelectedLink(link)
                  }
                }}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Click on a value or connection to learn more</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog
        open={!!selectedValue}
        onOpenChange={() => setSelectedValue(null)}
      >
        <DialogContent className="max-w-sm">
          {selectedValue && (
            <div key={selectedValue.id} className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant={
                    selectedValue.isWinningValue ? "default" : "secondary"
                  }
                >
                  Score: {selectedValue.pageRank?.toFixed(3)}
                </Badge>
              </div>

              <h3 className="text-md font-bold mb-2 mt-8">
                {selectedValue.title}
              </h3>
              <p className="text-md text-neutral-500 mb-4">
                {selectedValue.description}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedLink} onOpenChange={() => setSelectedLink(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-muted-foreground">
              {graphData?.edges[0]?.contexts[0] || "Context Information"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-base mb-6">
              Is it wiser to follow{" "}
              <em className="font-semibold">{selectedLink?.target.title}</em>{" "}
              rather than{" "}
              <em className="font-semibold">{selectedLink?.source.title}</em>?
            </p>

            <div className="space-y-2">
              <div className="flex justify-between">
                <p className="font-bold">Wiser</p>
                <p className="text-muted-foreground">
                  {selectedLink?.counts?.markedWiser ?? 0} participants
                </p>
              </div>
              <div className="flex justify-between">
                <p className="font-bold">Not Wiser</p>
                <p className="text-muted-foreground">
                  {selectedLink?.counts?.markedNotWiser ?? 0} participants
                </p>
              </div>
              {(selectedLink?.counts?.markedLessWise ?? 0) > 0 && (
                <div className="flex justify-between">
                  <p className="font-bold">Less Wise</p>
                  <p className="text-muted-foreground">
                    {selectedLink?.counts?.markedLessWise ?? 0} participants
                  </p>
                </div>
              )}
              <div className="flex justify-between">
                <p className="font-bold">Unsure</p>
                <p className="text-muted-foreground">
                  {selectedLink?.counts?.markedUnsure ?? 0} participants
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function countVotes(graph: MoralGraph): number {
  return graph.edges
    .map(
      (e) =>
        e.counts.markedLessWise +
        e.counts.markedNotWiser +
        e.counts.markedUnsure +
        e.counts.markedWiser
    )
    .reduce((a, b) => a + b, 0)
}

function countAllVotes(
  interventions: Omit<Intervention, "createdAt" | "updatedAt">[]
): number {
  return interventions
    .map((i) => i.graph as unknown as MoralGraph)
    .map(countVotes)
    .reduce((a, b) => a + b, 0)
}

function countAllValues(
  interventions: Omit<Intervention, "createdAt" | "updatedAt">[]
): number {
  return new Set(
    interventions
      .map((i) => i.graph as unknown as MoralGraph)
      .flatMap((g) => g.values.map((v) => v.id))
  ).size
}

export default function ReportView() {
  const { interventions } = useLoaderData<typeof loader>()
  const { deliberationId, questionId } = useParams()

  return (
    <div className="container mx-auto px-8 py-8">
      <div className="flex justify-center mb-8">
        <h1 className="text-2xl font-bold">
          How could US abortion policy support christian girls considering
          abortion?
        </h1>
      </div>

      <div className="mb-8">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Values</p>
            <p className="text-2xl font-bold">
              {countAllValues(interventions)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Votes</p>
            <p className="text-2xl font-bold">{countAllVotes(interventions)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Interventions</p>
            <p className="text-2xl font-bold">{interventions.length}</p>
          </div>
        </div>
        <Button asChild size="lg">
          <Link
            prefetch="render"
            to={`/deliberation/${deliberationId}/${questionId}/chat-explainer`}
          >
            Add your voice
          </Link>
        </Button>
        <h2 className="text-3xl font-bold mb-4 mt-12">Suggested Actions</h2>
      </div>

      {interventions.map((intervention, index) => (
        <div key={index}>
          {index > 0 && <Separator className="my-8" />}
          <h3 className="text-lg font-semibold mb-4 flex justify-between items-center">
            {intervention.contextId}
            <span className="text-sm text-muted-foreground">
              {countVotes(intervention.graph as unknown as MoralGraph)}{" "}
              {"Votes"}
            </span>
          </h3>
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <p className="text-sm font-normal text-muted-foreground mb-2">
                Intervention
              </p>
              <Card className="h-[300px] flex flex-col">
                <CardContent className="pt-6 flex-1 overflow-auto">
                  <p>{intervention.text}</p>
                </CardContent>
                <CardFooter>
                  {(() => {
                    const supportLevel = categorizeSupportLevel(
                      (intervention.graph as unknown as MoralGraph).values.map(
                        (v) => v.pageRank!
                      )
                    )

                    const variants = {
                      "broadly supported": "default",
                      "some support": "secondary",
                      contested: "outline",
                    } as const

                    const tooltipText = {
                      "broadly supported":
                        "One value is clearly the most important by a large margin",
                      "some support":
                        "One value is leading, but not by a huge margin",
                      contested: "Multiple values are competing for importance",
                    }

                    return (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge
                              variant={variants[supportLevel]}
                              className="capitalize"
                            >
                              {supportLevel}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{tooltipText[supportLevel]}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )
                  })()}
                </CardFooter>
              </Card>
            </div>
            <div className="w-full md:w-[500px]">
              <p className="text-sm font-normal text-muted-foreground mb-2">
                Values
              </p>
              <div className="h-[300px] bg-muted rounded-lg overflow-hidden">
                <ForceGraphWrapper
                  graphData={intervention.graph as unknown as MoralGraph}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
