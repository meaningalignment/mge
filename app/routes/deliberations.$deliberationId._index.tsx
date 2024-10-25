import { LoaderFunctionArgs, ActionFunctionArgs, json } from "@remix-run/node"
import {
  useLoaderData,
  useSubmit,
  Link,
  useRevalidator,
  useParams,
} from "@remix-run/react"
import { useEffect, useState } from "react"
import { db, inngest } from "~/config.server"
import { Button } from "~/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card"
import { redirect } from "@remix-run/node"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons"
import { ChevronDownIcon } from "@radix-ui/react-icons"
import { Loader2 } from "lucide-react"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const deliberationId = Number(params.deliberationId)!
  const deliberation = await db.deliberation.findFirstOrThrow({
    where: { id: deliberationId },
    include: {
      questions: {
        include: {
          ContextsForQuestions: {
            include: {
              context: true,
            },
          },
        },
      },
      _count: {
        select: {
          edges: true,
          edgeHypotheses: true,
          valuesCards: {
            where: {
              seedGenerationRunId: {
                equals: null,
              },
            },
          },
          canonicalValuesCards: true,
        },
      },
    },
  })

  return { deliberation }
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const formData = await request.formData()
  const action = formData.get("action")

  if (action === "deleteDeliberation") {
    const deliberationId = Number(params.deliberationId)!
    await db.deliberation.delete({
      where: { id: deliberationId },
    })
    return redirect("/deliberations")
  } else if (action === "removeContext") {
    const contextId = formData.get("contextId") as string
    const questionId = formData.get("questionId") as string

    await db.contextsForQuestions.delete({
      where: {
        contextId_questionId_deliberationId: {
          contextId: contextId,
          questionId: Number(questionId),
          deliberationId: Number(params.deliberationId)!,
        },
      },
    })

    return json({ success: true })
  } else if (action === "addContext") {
    const name = formData.get("name") as string
    const application = formData.get("application") as string
    const questionId = formData.get("questionId") as string
    const deliberationId = Number(params.deliberationId)!

    await db.context.create({
      data: {
        id: name,
        deliberation: { connect: { id: deliberationId } },
        ContextsForQuestions: {
          create: {
            question: { connect: { id: Number(questionId) } },
            application: application,
          },
        },
      },
    })

    return json({ success: true })
  } else if (action === "generateSeedGraph") {
    const deliberationId = Number(params.deliberationId)!

    await inngest.send({
      name: "gen-seed-graph",
      data: { deliberationId },
    })

    return json({ success: true, message: "Seed graph generation initiated" })
  }
}

function ValueContextInfo() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm">
            <h4 className="text-sm font-semibold mr-2">Value Contexts</h4>
            <QuestionMarkCircledIcon className="h-4 w-4" />
            <span className="sr-only">Value</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent className="w-80 p-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Value Contexts</h3>
            <p className="text-sm">
              Often when we disagree about values, we're actually disagreeing
              about the specific situations to which those values apply.
            </p>
            <p className="text-sm">
              For example, two people might disagree about immigration policies
              in general, but agree on how to handle the case of an immigrant
              who's lived in the country for 20 years.
            </p>
            <h4 className="font-semibold text-sm mt-4">How It Works</h4>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>
                Value contexts are generated automatically in the background.
              </li>
              <li>
                The final graph shows the wisest value for each value context
                for your question.
              </li>
              <li>This helps bridge disagreements and find common ground.</li>
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default function DeliberationDashboard() {
  const { deliberation } = useLoaderData<typeof loader>()
  const submit = useSubmit()
  const revalidator = useRevalidator()
  const { deliberationId } = useParams()
  const [openQuestionId, setOpenQuestionId] = useState<number | null>(null)

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null
    if (deliberation.setupStatus !== "ready") {
      intervalId = setInterval(() => {
        revalidator.revalidate()
      }, 5000)
    }
    return () => {
      if (intervalId !== null) clearInterval(intervalId)
    }
  }, [deliberation.setupStatus, revalidator])

  const handleDeleteDeliberation = () => {
    if (confirm("Are you sure you want to delete this deliberation?")) {
      submit({ action: "deleteDeliberation" }, { method: "post" })
    }
  }

  const toggleQuestionDropdown = (questionId: number) => {
    setOpenQuestionId(openQuestionId === questionId ? null : questionId)
  }

  const handleGenerateSeedGraph = () => {
    alert("Seed graph generation started in the background.")
    submit({ action: "generateSeedGraph" }, { method: "post" })
  }

  return (
    <div className="container mx-auto py-6 max-w-2xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{deliberation.title}</h1>
        <Link to={`/deliberations/${deliberation.id}/edit`} prefetch="intent">
          <Button variant="outline">Edit</Button>
        </Link>
      </div>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold mb-4">Summary</h2>
          <Link to={`/deliberations/${deliberationId}/admin`} prefetch="intent">
            <Button variant="ghost">Admin Panel</Button>
          </Link>
        </div>
        <Card>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center mt-4">
                <div>
                  <h4 className="text-sm font-semibold">Participants</h4>
                  <p className="text-sm text-muted-foreground mt-2">
                    How many participants have entered the deliberation.
                  </p>
                </div>
                <p className="text-lg font-medium">
                  {deliberation._count.valuesCards}
                </p>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-semibold">Values</h4>
                  <p className="text-sm text-muted-foreground mt-2">
                    How many values cards have been articulated.
                  </p>
                </div>
                <p className="text-lg font-medium">
                  {deliberation._count.canonicalValuesCards}
                </p>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-semibold">Upgrades</h4>
                  <p className="text-sm text-muted-foreground mt-2">
                    How many upgrades have been agreed upon.
                  </p>
                </div>
                <p className="text-lg font-medium">
                  {deliberation._count.edges}
                </p>
              </div>
            </div>
            {deliberation._count.canonicalValuesCards === 0 &&
              deliberation.setupStatus === "ready" && (
                <Alert className="mt-6 mb-4 bg-slate-50">
                  <div className="flex flex-row space-x-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No responses yet</AlertTitle>
                  </div>

                  <AlertDescription className="flex flex-col sm:flex-row items-center justify-between">
                    <span>Would you like to generate a seed graph?</span>
                    <Button
                      variant="ghost"
                      onClick={handleGenerateSeedGraph}
                      className="mt-2 sm:mt-0"
                    >
                      Seed Graph
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            <div className="mt-8 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Link
                to={`/deliberation/${deliberationId}/graph`}
                prefetch="intent"
                className="w-full sm:w-auto"
              >
                <Button variant="outline" className="w-full sm:w-auto">
                  Show Graph
                </Button>
              </Link>
              <Link
                to={`/deliberation/${deliberation.id}/start`}
                prefetch="intent"
                className="w-full sm:w-auto"
              >
                <Button className="w-full sm:w-auto">
                  Show Participant View
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mt-8 mb-4">
          <h2 className="text-2xl font-semibold">Questions</h2>
          {deliberation.setupStatus !== "ready" && (
            <div className="flex items-center bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1.5 rounded-md">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {deliberation.setupStatus === "generating_graph" &&
                "Generating Graph..."}
              {deliberation.setupStatus === "generating_contexts" &&
                "Generating Contexts..."}
              {deliberation.setupStatus === "generating_questions" &&
                "Generating Questions..."}
            </div>
          )}
        </div>

        {deliberation.questions.map((question) => (
          <Card key={question.id}>
            <CardHeader>
              <CardTitle className="text-md font-bold flex items-center">
                {question.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">{question.question}</p>
              <div
                className="flex items-center justify-between mb-2 cursor-pointer hover:bg-gray-100 rounded-md p-2 transition-colors duration-200"
                onClick={() => toggleQuestionDropdown(question.id)}
              >
                <div className="flex flex-row items-center">
                  <ValueContextInfo />
                </div>
                <ChevronDownIcon
                  className={`h-4 w-4 transition-transform ${
                    openQuestionId === question.id ? "transform rotate-180" : ""
                  }`}
                />
              </div>
              {openQuestionId === question.id && (
                <ul className="space-y-2">
                  {question.ContextsForQuestions.map((context, index) => (
                    <li
                      key={index}
                      className="flex flex-col bg-gray-50 p-2 rounded-md"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">
                          {context.context.id}
                        </span>
                      </div>
                      {context.application && (
                        <span className="text-xs text-gray-600 mt-1">
                          {context.application}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-8 flex justify-end">
        <Button variant="destructive" onClick={handleDeleteDeliberation}>
          Delete Deliberation
        </Button>
      </div>
    </div>
  )
}
