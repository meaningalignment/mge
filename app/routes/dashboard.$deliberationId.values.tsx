import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node"
import { useLoaderData, useFetcher } from "@remix-run/react"
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
import { EyeNoneIcon } from "@radix-ui/react-icons"
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
          chat: {
            include: {
              Question: true,
            },
          },
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

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  const cardId = Number(formData.get("cardId"))
  const isExcluded = formData.get("excluded") === "true"

  await db.canonicalValuesCard.update({
    where: { id: cardId },
    data: { isExcluded },
  })

  return json({ success: true })
}

export default function ValuesView() {
  const { values, questions, contexts } = useLoaderData<typeof loader>()
  const [selectedQuestion, setSelectedQuestion] = useState<string>("all")
  const [selectedContext, setSelectedContext] = useState<string>("all")
  const [localExclusions, setLocalExclusions] = useState<
    Record<number, boolean>
  >({})
  const fetcher = useFetcher()

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
        if (!card.chat?.Question) return false

        // If question is selected, check if it matches
        if (
          selectedQuestion !== "all" &&
          card.chat.Question.id.toString() !== selectedQuestion
        ) {
          return false
        }

        // If context is selected, check if the question is linked to this context
        if (selectedContext !== "all") {
          contexts
            .find((context) => context.id === selectedContext)
            ?.ContextsForQuestions.some(
              (c) => c.questionId === card.chat?.Question.id
            )
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
    <div className="container mx-auto py-6">
      <div className="flex gap-4 mb-6">
        <Select value={selectedQuestion} onValueChange={setSelectedQuestion}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select Question" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Questions</SelectItem>
            {questions.map((question) => (
              <SelectItem key={question.id} value={question.id.toString()}>
                {question.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedContext} onValueChange={setSelectedContext}>
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 justify-items-center">
        {filteredValues.map((value) => {
          const isExcluded = localExclusions[value.id] ?? value.isExcluded

          return (
            <fetcher.Form
              key={value.id}
              method="post"
              className={`group relative flex flex-col h-full cursor-pointer transition-opacity duration-200 hover:opacity-60 ${
                isExcluded ? "opacity-30" : ""
              }`}
              onSubmit={(e) => {
                // Prevent default form submission
                e.preventDefault()

                // Update local state immediately
                setLocalExclusions((prev) => ({
                  ...prev,
                  [value.id]: !isExcluded,
                }))

                // Submit the form
                fetcher.submit(e.currentTarget)
              }}
            >
              <input type="hidden" name="cardId" value={value.id} />
              <input
                type="hidden"
                name="excluded"
                value={(!isExcluded).toString()}
              />
              <button type="submit" className="w-full text-left">
                {isExcluded && (
                  <div className="absolute top-2 right-2 z-10 bg-slate-900 text-white px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium shadow-lg border border-slate-700">
                    <EyeNoneIcon className="h-[14px] w-[14px]" />
                    <span>Excluded</span>
                  </div>
                )}
                <ValuesCard card={value} detailsInline />
              </button>
            </fetcher.Form>
          )
        })}
      </div>
    </div>
  )
}
