import { LoaderFunctionArgs, json } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { db } from "~/config.server"
import ValuesCard from "~/components/values-card"
import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Alert, AlertTitle, AlertDescription } from "~/components/ui/alert"
import { AlertCircle } from "lucide-react"

export async function loader({ params }: LoaderFunctionArgs) {
  const deliberationId = Number(params.deliberationId)

  // Get all values with their related values cards and questions
  const values = await db.canonicalValuesCard.findMany({
    where: { deliberationId },
    include: {
      valuesCards: {
        include: {
          question: true,
        },
      },
    },
    orderBy: {
      title: "asc",
    },
  })

  // Get all questions and contexts for filters
  const questions = await db.question.findMany({
    where: { deliberationId },
    select: {
      id: true,
      title: true,
      ContextsForQuestions: {
        select: {
          contextId: true,
        },
      },
    },
  })

  const contexts = await db.context.findMany({
    where: { deliberationId },
    include: {
      ContextsForQuestions: {
        select: {
          questionId: true,
        },
      },
    },
  })

  return json({ values, questions, contexts })
}

export default function ValuesView() {
  const { values, questions, contexts } = useLoaderData<typeof loader>()
  const [selectedQuestion, setSelectedQuestion] = useState<string>("all")
  const [selectedContext, setSelectedContext] = useState<string>("all")

  if (values.length === 0) {
    return (
      <Alert className="mt-6 mb-4 bg-slate-50">
        <div className="flex flex-row space-x-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No values yet</AlertTitle>
        </div>
        <AlertDescription className="flex flex-col sm:flex-row items-center justify-between mt-2">
          Values will appear here once they are generated
        </AlertDescription>
      </Alert>
    )
  }

  const filteredValues = values
    .filter((value) => {
      if (selectedQuestion === "all" && selectedContext === "all") return true

      return value.valuesCards.some((card) => {
        if (!card.question) return false

        // If question is selected, check if it matches
        if (
          selectedQuestion !== "all" &&
          card.question.id.toString() !== selectedQuestion
        ) {
          return false
        }

        // If context is selected, check if the question is linked to this context
        if (selectedContext !== "all") {
          const contextExists =
            contexts
              .find((context) => context.id === selectedContext)
              ?.ContextsForQuestions.some(
                (c) => c.questionId === card.question.id
              ) ?? false

          return contextExists
        }

        return true
      })
    })
    .sort((a, b) => {
      // Sort by number of policies (assuming policies are stored in the title field)
      const policiesA = a.title.split("\n").length
      const policiesB = b.title.split("\n").length
      return policiesB - policiesA // Sort in descending order
    })

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6">
        {values.length === 0 ? (
          <Alert className="bg-slate-50">
            <div className="flex flex-row space-x-2">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No values yet</AlertTitle>
            </div>
            <AlertDescription className="flex flex-col sm:flex-row items-center justify-between mt-2">
              Values will appear here once they are generated
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex gap-4 mb-6 items-center">
              <Select
                value={selectedQuestion}
                onValueChange={setSelectedQuestion}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select Question" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Questions</SelectItem>
                  {questions.map((question) => (
                    <SelectItem
                      key={question.id}
                      value={question.id.toString()}
                    >
                      {question.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedContext}
                onValueChange={setSelectedContext}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select Context" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contexts</SelectItem>
                  {contexts.map((context) => (
                    <SelectItem key={context.id} value={context.id}>
                      {context.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="text-sm text-muted-foreground">
                {filteredValues.length} value
                {filteredValues.length !== 1 ? "s" : ""} found
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 justify-items-center">
              {filteredValues.map((value) => (
                <div
                  key={value.id}
                  className="group relative flex flex-col h-full"
                >
                  <ValuesCard card={value} detailsInline />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
