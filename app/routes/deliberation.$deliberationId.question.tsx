import Header from "~/components/header"
import { useState } from "react"
import { Check } from "lucide-react"
import StaticChatMessage from "~/components/static-chat-message"
import { cn } from "~/lib/utils"
import { useLoaderData } from "@remix-run/react"
import ContinueButton from "~/components/continue-button"
import { json, redirect } from "@remix-run/node"
import { db } from "~/config.server"
import { Question } from "@prisma/client"

export async function loader() {
  const questions = await db.question.findMany()

  if (questions.length === 0) {
    throw Error("No questions found.")
  }

  // Skip question select if there's only one question.
  if (questions.length === 1) {
    return redirect(`/question/${questions[0].id}/chat-explainer`)
  }

  return json({ questions: questions })
}

function QuestionCard({ questionData }: { questionData: Question }) {
  return (
    <div
      key={questionData.id}
      className={
        "border-2 border-border rounded-xl px-6 py-6 max-w-xs min-h-xs h-full bg-white flex flex-col gap-4"
      }
    >
      <p className="text-md font-bold">{questionData.title}</p>
      <p className="text-md text-neutral-500">
        {'"' + questionData.question + '"'}
      </p>
      <div className="flex-grow" />
    </div>
  )
}

function SelectedQuestionCard({ questionData }: { questionData: Question }) {
  return (
    <div className="relative h-full w-full">
      <div className="w-full h-full border-4 border-black rounded-xl z-10 absolute pointer-events-none" />
      <div className="absolute -bottom-2 -right-2 z-20">
        <div className="bg-black h-6 w-6 rounded-full flex flex-col justify-center items-center">
          <Check strokeWidth={3} className="h-4 w-4 text-white" />
        </div>
      </div>
      <QuestionCard questionData={questionData} />
    </div>
  )
}

export default function QuestionSelectScreen() {
  const questions = useLoaderData<typeof loader>().questions
  const [showQuestions, setShowQuestions] = useState(false)
  const [selected, setSelected] = useState<Question | null>(null)

  return (
    <div className="flex flex-col h-screen w-screen">
      <Header />
      <div className="grid flex-grow place-items-center space-y-8 py-12 mx-8">
        <StaticChatMessage
          onFinished={() => {
            setShowQuestions(true)
          }}
          isFinished={showQuestions}
          text={`Below are some questions that have been posed to ChatGPT by users. Weigh in on how ChatGPT should respond to the user.\n\nSelect a user question to continue.`}
        />
        <div className="grid lg:grid-cols-2 xl:grid-cols-3 mx-auto gap-4">
          {questions.map((c, i) => (
            <div
              key={c.id}
              onClick={() => setSelected(c)}
              className={cn(
                "cursor-pointer transition-opacity ease-in duration-500",
                showQuestions
                  ? "hover:opacity-80 active:opacity-70 hover:duration-0 hover:transition-none opacity-100"
                  : "opacity-0",
                `delay-${i * 75}`
              )}
            >
              {c.id === selected?.id ? (
                <SelectedQuestionCard questionData={c} />
              ) : (
                <QuestionCard questionData={c} />
              )}
            </div>
          ))}
        </div>
        <div
          className={`flex flex-col justify-center items-center pt-4 transition-opacity ease-in duration-500 delay-525 ${
            showQuestions ? "opacity-100" : "opacity-0"
          }`}
        >
          <a href={selected ? `/question/${selected.id}/chat-explainer` : "#"}>
            <ContinueButton event="Selected Question" />
          </a>

          <div className="flex flex-col justify-center items-center my-4 h-4">
            {!selected && (
              <p className="text-stone-300">
                {`Select a user question to continue`}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
