import Header from "~/components/header"
import { useState } from "react"
import { Check } from "lucide-react"
import StaticChatMessage from "~/components/chat/static-chat-message"
import { cn } from "~/lib/utils"
import { Link, useLoaderData } from "@remix-run/react"
import { json, LoaderFunctionArgs, redirect } from "@remix-run/node"
import { db } from "~/config.server"
import { Question } from "@prisma/client"
import LoadingButton from "~/components/loading-button"

export async function loader({ params }: LoaderFunctionArgs) {
  const { deliberationId } = params

  const [allQuestions, deliberation] = await Promise.all([
    db.question.findMany({
      where: { deliberationId: Number(deliberationId!), isArchived: false },
    }),
    db.deliberation.findUnique({
      where: { id: Number(deliberationId!) },
    }),
  ])

  if (allQuestions.length === 0) {
    throw Error("No questions found.")
  }

  // Skip question select if there's only one question.
  if (allQuestions.length === 1) {
    return redirect(
      `/deliberation/${deliberationId}/${allQuestions[0].id}/chat-explainer`
    )
  }

  // Get 3 random questions or all questions if less than 3.
  const numQuestions = Math.min(3, allQuestions.length)
  const questions = allQuestions
    .sort(() => Math.random() - 0.5)
    .slice(0, numQuestions)

  return json({
    questions,
    deliberationId,
    text: deliberation?.questionIntroText,
  })
}

function QuestionCard({ questionData }: { questionData: Question }) {
  return (
    <div
      key={questionData.id}
      className={
        "border-2 rounded-xl px-6 py-6 max-w-xs min-h-xs h-full bg-white flex flex-col gap-4"
      }
    >
      <p className="text-md font-bold">{questionData.title}</p>
      <p className="text-md text-neutral-500">{questionData.question}</p>
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
  const { questions, text, deliberationId } = useLoaderData<typeof loader>()
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
          text={text ?? "Choose a question to answer."}
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
          <LoadingButton isLoadingOnPageNavigation>
            <Link
              to={
                selected
                  ? `/deliberation/${deliberationId}/${selected.id}/chat-explainer`
                  : "#"
              }
              prefetch="intent"
              className="flex flex-row items-center justify-center"
            >
              Continue
            </Link>
          </LoadingButton>

          <div className="flex flex-col justify-center items-center my-4 h-4">
            {!selected && (
              <p className="text-stone-300">
                {`Select a question to continue`}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
