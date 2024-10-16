import { ActionFunction, redirect } from "@remix-run/node"
import { Form, useNavigate } from "@remix-run/react"
import { useState } from "react"
import { auth, db, inngest } from "~/config.server"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"
import { Label } from "~/components/ui/label"
import { v4 as uuid } from "uuid"
import LoadingButton from "~/components/loading-button"

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData()
  const user = await auth.getCurrentUser(request)
  if (!user) return redirect("/auth/login")
  const topic = formData.get("topic") as string
  const title = formData.get("title") as string
  const welcomeText = formData.get("welcomeText") as string

  const deliberation = await db.deliberation.create({
    data: {
      title,
      welcomeText,
      topic,
      user: {
        connect: {
          id: user.id,
        },
      },
    },
  })

  await inngest.send({
    name: "setup-deliberation",
    data: {
      deliberationId: deliberation.id,
      topic,
      numQuestions: 5,
      numContexts: 5,
    },
  })

  return redirect(`/deliberations/${deliberation.id}`)
}

export default function NewDeliberation() {
  const navigate = useNavigate()
  const [topic, setQuestion] = useState("")
  const [title, setTitle] = useState("")

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Create New Deliberation</h1>
      <Form method="post" className="space-y-8">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            className="mt-2"
            id="title"
            name="title"
            placeholder="Enter the deliberation title"
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <p className="text-sm text-muted-foreground mt-2">
            This will be the title of your deliberation.
          </p>
        </div>
        <div>
          <Label htmlFor="welcomeText">Welcome Text</Label>
          <Textarea
            className="mt-2"
            id="welcomeText"
            name="welcomeText"
            placeholder="Enter the welcome text (optional)"
          />
          <p className="text-sm text-muted-foreground mt-2">
            When participants join your deliberation, they will be greeted with
            this text.
          </p>
        </div>
        <div>
          <Label htmlFor="question">Topic</Label>
          <Input
            className="mt-2"
            id="topic"
            name="topic"
            placeholder="Enter your topic"
            required
            type="text"
            value={topic}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <p className="text-sm text-muted-foreground mt-2">
            This is the topic that participants will deliberate about. Specific
            questions will be generated in the background based on this topic.
            You can edit these questions later.
          </p>
        </div>
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <LoadingButton type="submit" disabled={!topic || !title}>
            Save
          </LoadingButton>
        </div>
      </Form>
    </div>
  )
}
