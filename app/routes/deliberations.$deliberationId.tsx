import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData, Form, redirect, useNavigate } from "@remix-run/react"
import { db } from "~/config.server"
export const loader = async ({ params }: LoaderFunctionArgs) => {
  const deliberationId = Number(params.deliberationId)!
  const deliberation = await db.deliberation.findFirstOrThrow({
    where: { id: deliberationId },
    include: {
      questions: {
        include: { ChoiceTypesForQuestions: true },
      },
    },
  })
  return { deliberation }
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const deliberationId = Number(params.deliberationId)
  const formData = await request.formData()
  const intent = formData.get("intent")

  if (intent === "delete") {
    await db.deliberation.delete({
      where: { id: deliberationId },
    })
    return redirect("/deliberations")
  }

  // Handle update
  const title = formData.get("title")
  const welcomeText = formData.get("welcomeText")

  await db.deliberation.update({
    data: {
      title: String(title),
      welcomeText: String(welcomeText),
    },
    where: { id: deliberationId },
  })

  return redirect(`/deliberations/${deliberationId}`)
}

export default function DeliberationDashboard() {
  const { deliberation } = useLoaderData<typeof loader>()
  const navigate = useNavigate()

  return (
    <div>
      <h1 className="text-2xl font-bold">{deliberation.title}</h1>
      <Form method="post" className="mt-4">
        <div>
          <label className="block">
            Title:
            <input
              type="text"
              name="title"
              defaultValue={deliberation.title}
              className="border p-2 w-full"
            />
          </label>
        </div>
        <div className="mt-2">
          <label className="block">
            Welcome Text:
            <textarea
              name="welcomeText"
              defaultValue={deliberation.welcomeText ?? ""}
              className="border p-2 w-full"
            />
          </label>
        </div>

        <div className="mt-4 flex space-x-2">
          <button type="submit" className="bg-blue-500 text-white px-4 py-2">
            Save
          </button>
          <Form method="post">
            <button
              type="submit"
              name="intent"
              value="delete"
              className="bg-red-500 text-white px-4 py-2"
              onClick={() => {
                if (
                  !confirm("Are you sure you want to delete this deliberation?")
                ) {
                  navigate(-1)
                }
              }}
            >
              Delete
            </button>
          </Form>
        </div>
      </Form>
      <div className="mt-8">
        <h2 className="text-xl font-semibold">Results</h2>
        {/* Render results related to the deliberation */}
        <pre>{JSON.stringify(deliberation, null, 2)}</pre>
      </div>
    </div>
  )
}
