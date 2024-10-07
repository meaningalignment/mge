import { generateObject, generateText, type CoreMessage } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z, ZodSchema } from "zod"
import OpenAI from "openai"

const openai = new OpenAI()

function stringifyObj(obj: any) {
  return JSON.stringify(
    obj,
    (key, value) => {
      if (value === "" || value === undefined || value === null) {
        return undefined
      }
      return value
    },
    2
  )
}

function stringifyArray(arr: any[]) {
  return arr.map(stringifyObj).join("\n\n")
}

function stringify(value: any) {
  if (Array.isArray(value)) {
    return stringifyArray(value)
  } else if (typeof value === "string") {
    return value
  } else {
    return stringifyObj(value)
  }
}

export async function genObj<T extends ZodSchema>({
  prompt,
  data,
  schema,
  model = "claude-3-5-sonnet-20240620",
  temperature = 0,
}: {
  prompt: string
  data: Record<string, any>
  schema: T
  temperature?: number
  model?: string
}): Promise<z.infer<T>> {
  const renderedData = Object.entries(data)
    .map(([key, value]) => `# ${key}\n\n${stringify(value)}`)
    .join("\n\n")
  const { object } = await generateObject({
    model: anthropic(model),
    schema,
    system: prompt,
    messages: [{ role: "user", content: renderedData }],
    temperature,
    mode: "auto",
  })
  return object
}

export async function genText({
  prompt,
  userMessage,
  model = "claude-3-5-sonnet-20240620",
  temperature = 0,
}: {
  prompt: string
  userMessage: string
  model?: string
  temperature?: number
}): Promise<string> {
  const { text } = await generateText({
    model: anthropic(model),
    system: prompt,
    messages: [{ role: "user", content: userMessage }],
    temperature,
  })
  return text
}

export async function genTextMessages({
  messages,
  systemPrompt,
  model = "claude-3-5-sonnet-20240620",
  temperature = 0,
}: {
  messages: CoreMessage[]
  systemPrompt?: string
  model?: string
  temperature?: number
}): Promise<string> {
  const { text } = await generateText({
    model: anthropic(model),
    system: systemPrompt,
    messages,
    temperature,
  })
  return text
}

export async function embed(values: string[]): Promise<number[][]> {
  console.log("Embedding", values.length, "values")
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    dimensions: 1536,
    input: values,
  })

  return response.data.map((item) => item.embedding)
}
