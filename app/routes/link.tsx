import { Button } from "~/components/ui/button"
import Header from "~/components/header"
import { useLoaderData, useNavigate } from "@remix-run/react"
import { LoaderArgs, json } from "@remix-run/node"
import { auth, db } from "~/config.server"
import { ChatMessage } from "~/components/chat-message"
import ValuesCard from "~/components/values-card"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import LinkRoutingService from "~/services/linking-routing"
import { Configuration, OpenAIApi } from "openai-edge"
import EmbeddingService from "~/services/embedding"
import { CanonicalValuesCard } from "@prisma/client"
import { IconArrowRight } from "~/components/ui/icons"
import React from "react"
import { Separator } from "../components/ui/separator"
import { Loader2 } from "lucide-react"
import StaticChatMessage from "~/components/static-chat-message"
import { cn } from "~/utils"

const minRequiredLinks = 3

export async function loader({ request }: LoaderArgs) {
  const userId = await auth.getUserId(request)

  const config = new Configuration({ apiKey: process.env.OPENAI_API_KEY })
  const openai = new OpenAIApi(config)
  const embedding = new EmbeddingService(openai, db)
  const service = new LinkRoutingService(openai, db, embedding)

  const draw = await service.getDraw(userId, minRequiredLinks)

  return json({ draw })
}

export async function action({ request }: LoaderArgs) {
  const userId = await auth.getUserId(request)
  const body = await request.json()
  const { values, selected } = body

  console.log(
    `Submitting lesser values ${selected} for more comprehensive value ${values.to.id}`
  )

  // Upsert all the edges in the database.
  await Promise.all(
    selected.map((id: number) =>
      db.edge.upsert({
        where: {
          userId_fromId_toId: {
            userId,
            fromId: id,
            toId: values.to.id,
          },
        },
        create: {
          fromId: id,
          toId: values.to.id,
          userId,
        },
        update: {},
      })
    )
  )

  return json({})
}

function SelectedValuesCard({ value }: { value: CanonicalValuesCard }) {
  return (
    <div className="relative h-full w-full opacity-20">
      <div className="w-full h-full border-2 border-slate-400 rounded-xl z-10 absolute pointer-events-none" />
      <ValuesCard card={value} />
    </div>
  )
}

function InfoText({
  selected,
  from,
  to,
}: {
  selected: number[]
  from: CanonicalValuesCard[]
  to: CanonicalValuesCard
}) {
  const filteredTitles = from
    .filter((f) => selected.includes(f.id))
    .map((f, index, array) => (
      <React.Fragment key={f.id}>
        <strong className="text-black">{f.title}</strong>
        {index < array.length - 1
          ? index === array.length - 2
            ? " and "
            : ", "
          : null}
      </React.Fragment>
    ))

  return (
    <div className="w-96 p-8">
      <p className="text-neutral-500">
        It would be enough for ChatGPT to only take instructions from{" "}
        <strong className="text-black">{to.title}</strong>, because that's what{" "}
        {filteredTitles} {filteredTitles.length > 1 ? "are" : "is"} really
        about.
      </p>
    </div>
  )
}

export default function LinkScreen() {
  const navigate = useNavigate()

  const [index, setIndex] = useState<number>(0)
  const [showCards, setShowCards] = useState(false)
  const [isLoading, setIsLoading] = useState<"submit" | "skip" | null>(null)
  const [selectedLesserValues, setSelectedLesserValues] = useState<number[]>([])

  const { draw } = useLoaderData<typeof loader>()

  // If there are no values in the draw, continue to next step.
  useEffect(() => {
    if (draw.length === 0) {
      navigate("/finished")
    }
  }, [draw])

  const onSelect = (id: number) => {
    if (selectedLesserValues.includes(id)) {
      setSelectedLesserValues((values) => values.filter((v) => v !== id))
    } else {
      setSelectedLesserValues((values) => [...values, id])
    }
  }

  const onSkip = () => {
    // If we're at the end of the draw, navigate to the finish screen.
    if (index === draw.length - 1) {
      setIsLoading("skip")
      return navigate("/finished")
    }

    // Move to the next pair.
    setIndex((i) => i + 1)
    setSelectedLesserValues([])
  }

  const onSubmit = async () => {
    setIsLoading("submit")

    const body = { values: draw[index], selected: selectedLesserValues }

    // Post the relationship to the server in the background,
    // and reset in case it fails.
    const response = await fetch("/link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      setIsLoading(null)
      const text = await response.json()
      console.error(text)
      toast.error("Failed to submit relationship. Please try again.")
      return
    }

    // If we're at the end of the draw, navigate to the finish screen.
    if (index === draw.length - 1) {
      return navigate("/finished")
    }

    // Move to the next pair.
    setIsLoading(null)
    setIndex((i) => i + 1)
    setSelectedLesserValues([])
  }

  const gridColsClass = () => {
    let str = ""
    if (draw[index].from.length === 1) {
      str = "grid-cols-1"
    } else if (draw[index].from.length === 2) {
      str = "lg:grid-cols-2"
    } else {
      str = "lg:grid-cols-2 xl:grid-cols-3"
    }

    return str
  }

  const remainingValuesPromptText = () => {
    if (draw.length - index === 1) {
      return "one more set"
    } else if (index === 0) {
      return `${draw.length - index} sets of values`
    } else {
      return `${draw.length - index} more sets`
    }
  }

  if (!draw[index]) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen w-screen">
      <Header />
      <div className="grid flex-grow place-items-center space-y-4 py-12 px-8">
        <StaticChatMessage
          onFinished={() => {
            setShowCards(true)
          }}
          isFinished={showCards}
          text={`Some values can be 'more comprehensive' than other values, meaning they balance a value with something else that is important while keeping what's important about both values.\n\nBelow are some values that seem to be related.\n\nIf ChatGPT were to take instructions only from **${
            draw[index].to.title
          }**, would it also be following some of the lower values?\n\nSelect the lower values that can be ignored if ChatGPT is taking instructions from the top value, or click *skip* if all the values are important in unique ways.\n\nYour next task is to do this for ${remainingValuesPromptText()}.`}
        />
        <div
          className={cn(
            "mx-auto flex flex-col md:flex-row",
            "transition-opacity ease-in duration-500",
            showCards ? "opacity-100" : "opacity-0"
          )}
        >
          <ValuesCard card={draw[index].to as any} />
          {selectedLesserValues.length > 0 && (
            <div className="hidden md:block">
              {/* Display the info text at the top of page only on big screens. */}
              <InfoText
                selected={selectedLesserValues}
                from={draw[index].from as any}
                to={draw[index].to as any}
              />
            </div>
          )}
        </div>

        <div
          className={cn(
            "w-full flex items-center justify-center py-4 transition-opacity ease-in duration-500",
            showCards ? "opacity-100" : "opacity-0",
            "delay-75"
          )}
        >
          <Separator className="max-w-2xl" />
        </div>

        <div className={`grid ${gridColsClass()} mx-auto gap-4`}>
          {draw[index].from.map((value) => (
            <div
              key={value.id}
              onClick={() => onSelect(value.id)}
              className={cn(
                "cursor-pointer transition-opacity ease-in duration-500",
                showCards ? "opacity-100" : "opacity-0",
                `delay-${(index + 2) * 75}` // Make sure to add to `safelist` in tailwind.config.js if changed.
              )}
            >
              {selectedLesserValues.includes(value.id) ? (
                <SelectedValuesCard value={value as any} />
              ) : (
                <ValuesCard card={value as any} />
              )}
            </div>
          ))}
        </div>

        {/* Display the info text in the bottom of page only on small screens. */}
        {selectedLesserValues.length > 0 && (
          <div className="block md:hidden">
            <InfoText
              selected={selectedLesserValues}
              from={draw[index].from as any}
              to={draw[index].to as any}
            />
          </div>
        )}

        <div
          className={cn(
            "transition-opacity ease-in duration-500",
            showCards ? "opacity-100" : "opacity-0",
            `delay-${draw[index].from.length + 3 * 75}`
          )}
        >
          <div className="flex flex-row mx-auto justify-center items-center space-x-2 pt-8">
            <Button
              disabled={selectedLesserValues.length === 0 || Boolean(isLoading)}
              onClick={() => onSubmit()}
            >
              {isLoading == "submit" && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {draw.length - index === 1 ? "Finish" : "Continue"}
            </Button>
            <Button
              disabled={Boolean(isLoading)}
              variant={"outline"}
              onClick={() => onSkip()}
            >
              {isLoading == "skip" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <IconArrowRight className="mr-2" />
              )}
              Skip
            </Button>
          </div>
          <div className="flex flex-col justify-center items-center my-4 h-4">
            <p className="text-stone-300">
              {`Submit ${draw.length - index} more relationship${
                draw.length - index === 1 ? "" : "s"
              } to finish`}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
