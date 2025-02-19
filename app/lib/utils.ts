import { CanonicalValuesCard, ValuesCard } from "@prisma/client"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(input: string | number | Date): string {
  const date = new Date(input)
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export function capitalize(input: string): string {
  return input.charAt(0).toUpperCase() + input.slice(1)
}

export function isAllUppercase(str: string) {
  return str === str.toUpperCase()
}

/**
 * Calculate the average embedding vector.
 * @param embeddings An array of embedding vectors.
 * @returns The average embedding vector.
 */
export function calculateAverageEmbedding(embeddings: number[][]): number[] {
  if (embeddings.length === 0) {
    throw new Error("The embeddings array cannot be empty")
  }

  const dimension = embeddings[0].length

  // Ensure all vectors have the same dimension
  for (let emb of embeddings) {
    if (emb.length !== dimension) {
      throw new Error("All embedding vectors should have the same dimension")
    }
  }

  let averageVector = Array(dimension).fill(0)

  // Sum up all embedding vectors
  for (let emb of embeddings) {
    for (let i = 0; i < dimension; i++) {
      averageVector[i] += emb[i]
    }
  }

  // Divide by the number of embedding vectors to get the average
  for (let i = 0; i < dimension; i++) {
    averageVector[i] /= embeddings.length
  }

  return averageVector
}

export function splitToPairs<T>(arr: T[]): T[][] {
  return (
    Array.from({ length: Math.ceil(arr.length / 2) }, (_, i) =>
      arr.slice(i * 2, i * 2 + 2)
    ).filter((p) => p.length == 2) ?? []
  )
}

/**
 * Convert a DB card into the data model used in OpenAI functions.
 */
export function toDataModel(card: ValuesCard | CanonicalValuesCard): {
  title: string
  description: string
  policies: string[]
} {
  return {
    title: card.title,
    description: card.description,
    policies: card.policies,
  }
}

export function toDataModelWithId(
  card: ValuesCard | CanonicalValuesCard
): { title: string; description: string; policies: string[] } & { id: number } {
  return {
    ...toDataModel(card),
    id: card.id,
  }
}

export function removeLast<T>(
  arr: T[],
  predicate: (value: T, index: number, array: T[]) => boolean
): T[] {
  // Create a copy of the array
  const newArr = [...arr]

  for (let i = newArr.length - 1; i >= 0; i--) {
    if (predicate(newArr[i], i, newArr)) {
      newArr.splice(i, 1)
      return newArr
    }
  }

  return newArr // Return the copy if no element matches the predicate
}

export function isDisplayableMessage(message: {
  role: string
  content?: string
}) {
  return (
    message?.content &&
    (message.role === "user" || message.role === "assistant")
  )
}

export function getPartyAffiliation(counts: {
  republican: number
  democrat: number
  other: number
}) {
  const { republican, democrat, other } = counts

  if (republican > democrat) {
    return {
      affiliation: "republican",
      percentage: republican / (republican + democrat + other),
    }
  } else if (democrat > republican) {
    return {
      affiliation: "democrat",
      percentage: democrat / (republican + democrat + other),
    }
  }

  return null
}

export function contextDisplayName(contextId: string) {
  switch (contextId) {
    case "When in distress":
      return "Assisting girls in distress"
    case "When being introspective":
      return "Assisting girls in reflecting on their values"
    case "When making decisions":
      return "Assisting their decision-making"
    case "When being religious":
      return "Assisting girls with their religious beliefs"
    default:
      return contextId
  }
}

export function getFavicon(url: string): string {
  try {
    const hostname = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=48`
  } catch (e) {
    return "/generic.ico"
  }
}

export const encodeString = (str: string): string =>
  btoa(encodeURIComponent(str))

export const decodeString = (hash: string): string =>
  decodeURIComponent(atob(hash))
