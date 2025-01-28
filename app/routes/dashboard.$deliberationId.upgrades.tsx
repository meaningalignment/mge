import { json, LoaderFunctionArgs } from "@remix-run/node"
import { NavLink, Outlet, useLoaderData, useParams } from "@remix-run/react"
import { db } from "~/config.server"
import { cn, encodeString } from "~/lib/utils"
import { Alert, AlertTitle, AlertDescription } from "~/components/ui/alert"
import { AlertCircle } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { useState } from "react"

export async function loader({ params }: LoaderFunctionArgs) {
  const { deliberationId } = params

  // Get hypotheses, questions and contexts
  const [hypotheses, questions, contexts] = await Promise.all([
    db.edgeHypothesis.findMany({
      orderBy: { createdAt: "desc" },
      where: {
        deliberationId: Number(deliberationId)!,
      },
      select: {
        fromId: true,
        toId: true,
        story: true,
        hypothesisRunId: true,
        createdAt: true,
        contextId: true,
        from: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
        to: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
      },
    }),
    db.question.findMany({
      where: { deliberationId: Number(deliberationId) },
      select: {
        id: true,
        title: true,
        ContextsForQuestions: {
          select: { contextId: true },
        },
      },
    }),
    db.context.findMany({
      where: { deliberationId: Number(deliberationId) },
      include: {
        ContextsForQuestions: {
          select: { questionId: true },
        },
      },
    }),
  ])

  return json({ hypotheses, questions, contexts })
}

export default function AdminHypotheses() {
  const data = useLoaderData<typeof loader>()
  const { deliberationId } = useParams()
  const [selectedQuestion, setSelectedQuestion] = useState<string>("all")
  const [selectedContext, setSelectedContext] = useState<string>("all")
  const [selectedRunId, setSelectedRunId] = useState<string>("all")

  // Filter hypotheses based on selected question/context
  const filteredHypotheses = data.hypotheses.filter((hypothesis) => {
    if (
      selectedQuestion === "all" &&
      selectedContext === "all" &&
      selectedRunId === "all"
    )
      return true

    if (selectedContext !== "all" && hypothesis.contextId !== selectedContext)
      return false

    if (selectedRunId !== "all" && hypothesis.hypothesisRunId !== selectedRunId)
      return false

    if (selectedQuestion !== "all") {
      // Find if the context is linked to the selected question
      const context = data.contexts.find((c) => c.id === hypothesis.contextId)
      return context?.ContextsForQuestions.some(
        (cq) => cq.questionId.toString() === selectedQuestion
      )
    }

    return true
  })

  // Get unique run IDs with their dates
  const runIdsWithDates = Array.from(
    new Set(data.hypotheses.map((h) => h.hypothesisRunId))
  )
    .filter(Boolean)
    .map((runId) => {
      const firstHypothesis = data.hypotheses.find(
        (h) => h.hypothesisRunId === runId
      )
      return {
        runId,
        date: firstHypothesis
          ? new Date(firstHypothesis.createdAt)
          : new Date(),
      }
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime()) // Sort by date descending

  return (
    <div className="flex h-full">
      <div className="w-64 flex-shrink-0 border-r overflow-y-auto bg-white px-3 py-4">
        <div className="mb-6">
          <div className="flex items-center rounded-lg px-3 py-2 text-slate-900">
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            <span className="ml-3 text-base font-semibold">Hypotheses</span>
          </div>
          <div className="px-3 text-sm text-slate-500">
            {filteredHypotheses.length} upgrade
            {filteredHypotheses.length !== 1 ? "s" : ""} available
          </div>
        </div>

        <div className="mb-6 space-y-4">
          <Select value={selectedQuestion} onValueChange={setSelectedQuestion}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Question" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Questions</SelectItem>
              {data.questions.map((question) => (
                <SelectItem key={question.id} value={question.id.toString()}>
                  {question.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedContext} onValueChange={setSelectedContext}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Context" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Contexts</SelectItem>
              {data.contexts.map((context) => (
                <SelectItem key={context.id} value={context.id}>
                  {context.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedRunId} onValueChange={setSelectedRunId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Run" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Runs</SelectItem>
              {runIdsWithDates.map(({ runId, date }) => (
                <SelectItem key={runId} value={runId}>
                  {date.toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ul className="space-y-2 text-sm font-medium">
          {filteredHypotheses.map((hypothesis) => (
            <NavLink
              prefetch="intent"
              to={`/dashboard/${deliberationId}/upgrades/${hypothesis.fromId}/${
                hypothesis.toId
              }/${encodeString(hypothesis.contextId)}`}
              key={`${hypothesis.fromId}-${hypothesis.toId}-${hypothesis.contextId}`}
              className={({ isActive, isPending }) =>
                cn(
                  "block rounded-lg hover:bg-slate-100",
                  isPending && "bg-slate-50",
                  isActive && "bg-slate-100"
                )
              }
            >
              <li className="px-3 py-2">
                <div
                  className="font-medium truncate"
                  title={hypothesis.from!.title}
                >
                  {hypothesis.from!.title} → {hypothesis.to!.title}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {new Date(hypothesis.createdAt).toLocaleDateString()}
                </div>
                <div className="text-xs text-slate-400">
                  {hypothesis.contextId}
                </div>
              </li>
            </NavLink>
          ))}
        </ul>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {filteredHypotheses.length === 0 ? (
            <Alert className="bg-slate-50">
              <div className="flex flex-row space-x-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No hypotheses found</AlertTitle>
              </div>
              <AlertDescription>
                {selectedQuestion !== "all" || selectedContext !== "all"
                  ? "No hypotheses match your selected filters."
                  : "No hypotheses available. Hypothesized value upgrades will appear here once they are generated."}
              </AlertDescription>
            </Alert>
          ) : (
            <Outlet />
          )}
        </div>
      </div>
    </div>
  )
}
