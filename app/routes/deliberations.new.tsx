import { ActionFunction, json, redirect } from "@remix-run/node"
import { Form, useNavigate } from "@remix-run/react"
import { useState } from "react"
import { auth, db, inngest } from "~/config.server"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"
import { Label } from "~/components/ui/label"
import { v4 as uuid } from "uuid"
import LoadingButton from "~/components/loading-button"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import {
  unstable_parseMultipartFormData,
  unstable_createMemoryUploadHandler,
} from "@remix-run/node"

export const action: ActionFunction = async ({ request }) => {
  const uploadHandler = unstable_createMemoryUploadHandler()
  const formData = await unstable_parseMultipartFormData(request, uploadHandler)

  const user = await auth.getCurrentUser(request)
  if (!user) return redirect("/auth/login")

  const topic = formData.get("topic") as string
  const title = formData.get("title") as string
  const welcomeText = formData.get("welcomeText") as string
  const questionsFile = formData.get("questionsFile") as File | null

  const deliberation = await db.deliberation.create({
    data: {
      title,
      welcomeText,
      topic: topic ?? title,
      user: {
        connect: {
          id: user.id,
        },
      },
    },
  })

  if (topic) {
    await inngest.send({
      name: "gen-seed-questions-contexts",
      data: {
        deliberationId: deliberation.id,
        topic,
        numQuestions: 5,
        numContexts: 5,
      },
    })
  } else if (questionsFile) {
    const questions = (await questionsFile.text())
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line))

    if (questions.find((q: any) => !q.question || !q.title || !q.id)) {
      return json(
        {
          error:
            "Invalid questions format. Each question must have 'question', 'title', and 'id' fields.",
        },
        { status: 400 }
      )
    }

    const dbQuestions = await Promise.all(
      questions.map((q: any) =>
        db.question.create({
          data: {
            id: q.id,
            title: q.title,
            question: q.question,
            deliberationId: deliberation.id,
          },
        })
      )
    )

    await inngest.send({
      name: "gen-seed-contexts",
      data: {
        deliberationId: deliberation.id,
        questions: dbQuestions.map((q) => q.id),
        topic,
      },
    })
  }

  return redirect(`/deliberations/${deliberation.id}`)
}

export default function NewDeliberation() {
  const navigate = useNavigate()
  const [topic, setQuestion] = useState("")
  const [title, setTitle] = useState("")
  const [inputMethod, setInputMethod] = useState<"topic" | "file">("topic")
  const [hasFile, setHasFile] = useState(false)

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Create New Deliberation</h1>
      <Form method="post" className="space-y-8" encType="multipart/form-data">
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
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Questions</h2>
          <RadioGroup
            defaultValue="topic"
            value={inputMethod}
            onValueChange={(value) => setInputMethod(value as "topic" | "file")}
            className="flex space-x-8"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="topic" id="topic-input" />
              <Label htmlFor="topic-input">Generate From Topic</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="file" id="file-input" />
              <Label htmlFor="file-input">Upload Questions File</Label>
            </div>
          </RadioGroup>
        </div>

        {inputMethod === "topic" ? (
          <div>
            <Label htmlFor="topic">Topic</Label>
            <Input
              className="mt-2"
              id="topic"
              name="topic"
              placeholder="Enter your topic"
              required={inputMethod === "topic"}
              type="text"
              value={topic}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <p className="text-sm text-muted-foreground mt-2">
              This is the topic that participants will deliberate about.
              Questions will be generated based on this topic in the background.
            </p>
          </div>
        ) : (
          <div>
            <Label htmlFor="questionsFile">Questions File (JSONL)</Label>
            <div className="flex items-center gap-4 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  document.getElementById("questionsFile")?.click()
                }
              >
                Choose File
              </Button>
              <Input
                className="hidden"
                id="questionsFile"
                name="questionsFile"
                type="file"
                accept=".jsonl"
                required={inputMethod === "file"}
                onChange={(e) => {
                  const fileName = e.target.files?.[0]?.name
                  const fileLabel = document.getElementById("fileLabel")
                  if (fileLabel) {
                    fileLabel.textContent = fileName || "No file chosen"
                  }
                  setHasFile(!!fileName)
                }}
              />
              <span id="fileLabel" className="text-sm text-muted-foreground">
                No file chosen
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Upload a JSONL file containing your questions. Each line should be
              a JSON object with "question", "title" and "id" fields.
            </p>
          </div>
        )}

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            disabled={!title || (inputMethod === "topic" ? !topic : !hasFile)}
          >
            Save
          </LoadingButton>
        </div>
      </Form>
    </div>
  )
}
