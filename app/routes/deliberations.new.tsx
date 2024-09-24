import { ActionFunction, redirect } from "@remix-run/node"
import { Form, useNavigate } from "@remix-run/react"
import React, { useState } from "react"
import { db } from "~/config.server"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData()
  const title = formData.get("title")
  const welcomeText = formData.get("welcomeText")
  const questions = formData.getAll("questions[]")
  const choices = formData.getAll("choices[]")

  if (typeof title !== "string" || title.trim() === "") {
    // Handle validation error
    return { error: "Title is required." }
  }

  const createdDeliberation = await db.deliberation.create({
    data: {
      title: title.trim(),
      welcomeText: typeof welcomeText === "string" ? welcomeText.trim() : "",
    },
  })

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i]
    if (typeof question === "string" && question.trim() !== "") {
      const createdQuestion = await db.question.create({
        data: {
          text: question.trim(),
          deliberationId: createdDeliberation.id,
        },
      })

      const questionChoices = choices[i].split(",")
      for (const choice of questionChoices) {
        if (choice.trim() !== "") {
          await db.choice.create({
            data: {
              text: choice.trim(),
              questionId: createdQuestion.id,
            },
          })
        }
      }
    }
  }

  return redirect("/deliberations")
}

export default function NewDeliberation() {
  const navigate = useNavigate()

  return (
    <div>
      <h1 className="text-2xl font-bold">Create New Deliberation</h1>
      <Form method="post" className="mt-4">
        <div>
          <label className="block">
            Title:
            <Input
              type="text"
              name="title"
              placeholder="Enter deliberation title"
              required
              className="border p-2 w-full"
            />
          </label>
        </div>
        <div className="mt-2">
          <label className="block">
            Welcome Text:
            <Textarea
              name="welcomeText"
              placeholder="Enter welcome text (optional)"
              className="border p-2 w-full"
            />
          </label>
        </div>

        <div className="mt-2">
          <label className="block">
            Question:
            <Input
              type="text"
              name="question"
              placeholder="Enter your question!"
              required
              className="border p-2 w-full"
            />
          </label>
        </div>

        <div className="mt-4 flex space-x-2">
          <button type="submit" className="bg-green-500 text-white px-4 py-2">
            Save now
          </button>
          <button
            type="button"
            className="bg-gray-500 text-white px-4 py-2"
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
        </div>
      </Form>
    </div>
  )
}
