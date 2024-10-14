import { LoaderFunctionArgs, ActionFunctionArgs, json } from "@remix-run/node"
import {
  useLoaderData,
  useSubmit,
  Form,
  useActionData,
  Link,
  useFetcher,
} from "@remix-run/react"
import { useEffect, useState } from "react"
import { db } from "~/config.server"
import { Button } from "~/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card"
import { redirect } from "@remix-run/node"
import LoadingButton from "~/components/loading-button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import {
  QuestionMarkCircledIcon,
  PlusIcon,
  Cross2Icon,
} from "@radix-ui/react-icons"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { generateContexts } from "values-tools"

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const deliberationId = Number(params.deliberationId)!
  const deliberation = await db.deliberation.findFirstOrThrow({
    where: { id: deliberationId },
    include: {
      questions: {
        include: {
          ChoiceTypesForQuestions: {
            include: {
              choiceType: true,
            },
          },
        },
      },
      _count: {
        select: {
          edges: true,
          valuesCards: true,
          deduplicatedCards: true,
        },
      },
    },
  })
  return {
    deliberation,
    initialChoiceTypes: deliberation.questions.flatMap((q) =>
      q.ChoiceTypesForQuestions.map((ct) => ({
        id: ct.choiceType.id,
        application: ct.application,
      }))
    ),
  }
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const formData = await request.formData()
  const action = formData.get("action")

  if (action === "generateChoiceTypes") {
    const question = formData.get("question") as string
    const questionId = formData.get("questionId") as string
    const deliberationId = Number(params.deliberationId)!
    const choiceTypes = await generateContexts(question)

    await db.choiceType.deleteMany({
      where: {
        ChoiceTypesForQuestions: { some: { questionId: questionId } },
      },
    })

    const promises = choiceTypes.map(
      (choiceType: { factor: string; questionWithFactor: string }) =>
        db.choiceType.upsert({
          where: { id: choiceType.factor },
          update: {
            ChoiceTypesForQuestions: {
              upsert: {
                where: {
                  choiceTypeId_questionId: {
                    choiceTypeId: choiceType.factor,
                    questionId: questionId,
                  },
                },
                create: {
                  question: {
                    connect: {
                      id: questionId,
                    },
                  },
                  application: choiceType.questionWithFactor,
                },
                update: {
                  application: choiceType.questionWithFactor,
                },
              },
            },
          },
          create: {
            id: choiceType.factor,
            deliberation: {
              connect: {
                id: deliberationId,
              },
            },
            ChoiceTypesForQuestions: {
              create: {
                question: {
                  connect: {
                    id: questionId,
                  },
                },
                application: choiceType.questionWithFactor,
              },
            },
          },
        })
    )
    await db.$transaction(promises)
    return json({ choiceTypes })
  } else if (action === "deleteDeliberation") {
    const deliberationId = Number(params.deliberationId)!
    await db.deliberation.delete({
      where: { id: deliberationId },
    })
    return redirect("/deliberations")
  } else if (action === "removeChoiceType") {
    const choiceTypeId = formData.get("choiceTypeId") as string
    const questionId = formData.get("questionId") as string

    await db.choiceTypesForQuestions.delete({
      where: {
        choiceTypeId_questionId: {
          choiceTypeId: choiceTypeId,
          questionId: questionId,
        },
      },
    })

    return json({ success: true })
  } else if (action === "addChoiceType") {
    const name = formData.get("name") as string
    const application = formData.get("application") as string
    const questionId = formData.get("questionId") as string
    const deliberationId = Number(params.deliberationId)!

    await db.choiceType.create({
      data: {
        id: name,
        deliberation: { connect: { id: deliberationId } },
        ChoiceTypesForQuestions: {
          create: {
            question: { connect: { id: questionId } },
            application: application,
          },
        },
      },
    })

    return json({ success: true })
  }
}

function ValueContextInfo() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="ml-2">
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
              <li>You can edit these to better suit your discussion needs.</li>
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
  const { deliberation, initialChoiceTypes } = useLoaderData<typeof loader>()
  const submit = useSubmit()
  const actionData = useActionData<typeof action>()
  const [choiceTypes, setChoiceTypes] =
    useState<Array<{ id: string; application: string | null }>>(
      initialChoiceTypes
    )
  const fetcher = useFetcher()
  const [showAddForm, setShowAddForm] = useState(false)
  const [newChoiceTypeName, setNewChoiceTypeName] = useState("")
  const [newChoiceTypeApplication, setNewChoiceTypeApplication] = useState("")

  const handleRemoveChoiceType = (choiceTypeId: string, questionId: string) => {
    fetcher.submit(
      { action: "removeChoiceType", choiceTypeId, questionId },
      { method: "post" }
    )
    setChoiceTypes((prev) => prev.filter((ct) => ct.id !== choiceTypeId))
  }

  const handleAddChoiceType = (questionId: string) => {
    fetcher.submit(
      {
        action: "addChoiceType",
        name: newChoiceTypeName,
        application: newChoiceTypeApplication,
        questionId,
      },
      { method: "post" }
    )
    setChoiceTypes((prev) => [
      ...prev,
      { id: newChoiceTypeName, application: newChoiceTypeApplication },
    ])
    setShowAddForm(false)
    setNewChoiceTypeName("")
    setNewChoiceTypeApplication("")
  }

  useEffect(() => {
    if ((actionData as any)?.choiceTypes) {
      setChoiceTypes((actionData as any).choiceTypes)
    }
  }, [actionData])

  const handleDeleteDeliberation = () => {
    if (confirm("Are you sure you want to delete this deliberation?")) {
      submit({ action: "deleteDeliberation" }, { method: "post" })
    }
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
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
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
                  {deliberation._count.deduplicatedCards}
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
            <div className="mt-8 flex justify-between items-center space-x-4">
              <Link to={`/data/edges`} prefetch="intent">
                <Button variant="outline">Show Graph</Button>
              </Link>
              <Link to={`/welcome`} prefetch="intent">
                <Button>Show Participant View</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        {deliberation.questions.map((question) => (
          <Card key={question.id}>
            <CardHeader>
              <CardTitle>{question.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-row items-center">
                  <h4 className="text-sm font-semibold">Value Contexts</h4>
                  <ValueContextInfo />
                </div>
                <Form method="post">
                  <input
                    type="hidden"
                    name="action"
                    value="generateChoiceTypes"
                  />
                  <input
                    type="hidden"
                    name="question"
                    value={question.question}
                  />
                  <input type="hidden" name="questionId" value={question.id} />
                  <input
                    type="hidden"
                    name="deliberationId"
                    value={deliberation.id}
                  />
                  <LoadingButton type="submit" variant="outline">
                    {choiceTypes.length > 0
                      ? "Regenerate"
                      : "Generate Contexts"}
                  </LoadingButton>
                </Form>
              </div>
              <ul className="space-y-2">
                {choiceTypes.map((choiceType, index) => (
                  <li
                    key={index}
                    className="flex flex-col bg-gray-50 p-2 rounded-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        {choiceType.id}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleRemoveChoiceType(choiceType.id, question.id)
                        }
                      >
                        Remove
                      </Button>
                    </div>
                    {choiceType.application && (
                      <span className="text-xs text-gray-600 mt-1">
                        {choiceType.application}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {showAddForm ? (
                <div className="mt-8 space-y-8">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      className="mt-2"
                      id="name"
                      value={newChoiceTypeName}
                      onChange={(e) => setNewChoiceTypeName(e.target.value)}
                      placeholder="Enter the choice type name"
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      This will be the name of your new choice type.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="application">Modified Question</Label>
                    <Input
                      className="mt-2"
                      id="application"
                      value={newChoiceTypeApplication}
                      onChange={(e) =>
                        setNewChoiceTypeApplication(e.target.value)
                      }
                      placeholder="Enter the modified question"
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      This is how the question will be modified for this choice
                      type.
                    </p>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowAddForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={() => handleAddChoiceType(question.id)}>
                      Add
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  className="mt-8"
                  variant="outline"
                  onClick={() => setShowAddForm(true)}
                >
                  <PlusIcon className="mr-2 h-4 w-4" /> Add
                </Button>
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
