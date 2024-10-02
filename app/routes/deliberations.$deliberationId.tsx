import { LoaderFunctionArgs, ActionFunctionArgs, json } from "@remix-run/node"
import {
  useLoaderData,
  useSubmit,
  useFetcher,
  Form,
  useActionData,
} from "@remix-run/react"
import { useEffect, useState } from "react"
import { db } from "~/config.server"
import { Button } from "~/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card"
import { redirect } from "@remix-run/node"
import { generateChoiceTypes } from "~/values-tools/choice-type"
import LoadingButton from "~/components/loading-button"
// Import the necessary Shadcn UI components

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
    },
  })
  return {
    deliberation,
    initialChoiceTypes: deliberation.questions.flatMap((q) =>
      q.ChoiceTypesForQuestions.map((ct) => ct.choiceType.id)
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
    const choiceTypes = await generateChoiceTypes(question)
    const promises = choiceTypes.map((choiceType) =>
      db.choiceType.create({
        data: {
          id: choiceType,
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
            },
          },
        },
      })
    )
    await db.choiceType.deleteMany({
      where: { ChoiceTypesForQuestions: { some: { questionId: questionId } } },
    })
    await db.$transaction(promises)
    return json({ choiceTypes })
  } else if (action === "deleteDeliberation") {
    const deliberationId = Number(params.deliberationId)!
    await db.deliberation.delete({
      where: { id: deliberationId },
    })
    return redirect("/deliberations")
  }
}

export default function DeliberationDashboard() {
  const { deliberation, initialChoiceTypes } = useLoaderData<typeof loader>()
  const submit = useSubmit()
  const actionData = useActionData<typeof action>()
  const [choiceTypes, setChoiceTypes] = useState<string[]>(initialChoiceTypes)

  const handleRemoveChoiceType = (index: number) => {
    setChoiceTypes((prev) => prev.filter((_, i) => i !== index))
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
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{deliberation.title}</h1>
        <Button variant="destructive" onClick={handleDeleteDeliberation}>
          Delete
        </Button>
      </div>
      <div className="space-y-6">
        <h2 className="text-xl font-semibold mb-4">Questions</h2>
        {deliberation.questions.map((question) => (
          <Card key={question.id}>
            <CardHeader>
              <CardTitle>{question.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold">Choice Types</h4>
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
                      ? "Regenerate Choice Types"
                      : "Generate Choice Types"}
                  </LoadingButton>
                </Form>
              </div>
              <ul className="space-y-2">
                {choiceTypes.map((choiceType, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between bg-gray-50 p-2 rounded-md"
                  >
                    <span className="text-sm">{choiceType}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveChoiceType(index)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
