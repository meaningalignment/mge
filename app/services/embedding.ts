import { CanonicalValuesCard, ValuesCard } from "@prisma/client"
import { db, inngest } from "~/config.server"
import { calculateAverageEmbedding } from "~/lib/utils"
import { embedText, embedValue } from "values-tools"

export async function embedCanonicalCard(
  card: CanonicalValuesCard
): Promise<void> {
  // Embed card.
  const embedding: number[] = await embedValue(card)

  // Update in DB.
  await db.$executeRaw`UPDATE "CanonicalValuesCard" SET embedding = ${JSON.stringify(
    embedding
  )}::vector WHERE id = ${card.id};`
}

export async function embedNonCanonicalCard(card: ValuesCard): Promise<void> {
  // Embed card.
  const embedding: number[] = await embedValue(card)

  // Update in DB.
  await db.$executeRaw`UPDATE "ValuesCard" SET embedding = ${JSON.stringify(
    embedding
  )}::vector WHERE id = ${card.id};`
}

export async function getNonCanonicalCardsWithoutEmbedding(): Promise<
  Array<ValuesCard>
> {
  return (await db.$queryRaw`SELECT id, title, "description", "policies" FROM "ValuesCard" WHERE "ValuesCard".embedding IS NULL`) as ValuesCard[]
}

export async function getCanonicalCardsWithoutEmbedding(): Promise<
  Array<CanonicalValuesCard>
> {
  return (await db.$queryRaw`SELECT id, title, "description", "policies", embedding::text FROM "CanonicalValuesCard" WHERE "CanonicalValuesCard".embedding IS NULL`) as CanonicalValuesCard[]
}

export async function getUserEmbedding(userId: number): Promise<number[]> {
  try {
    const userEmbeddings: Array<Array<number>> = (
      await db.$queryRaw<
        Array<{ embedding: any }>
      >`SELECT embedding::text FROM "ValuesCard" vc INNER JOIN "Chat" c  ON vc."chatId" = c."id" WHERE c."userId" = ${userId} AND vc."embedding" IS NOT NULL`
    ).map((r) => JSON.parse(r.embedding).map((v: any) => parseFloat(v)))

    console.log(`Got embedding vector for user ${userId}. Calculating average.`)

    return calculateAverageEmbedding(userEmbeddings)
  } catch (e) {
    console.error(e)
    return new Array(1536).fill(0)
  }
}

export async function embedContext(contextId: string): Promise<void> {
  // Embed context.
  const embedding: number[] = await embedText(contextId)

  // Update in DB.
  await db.$executeRaw`UPDATE "Context" SET embedding = ${JSON.stringify(
    embedding
  )}::vector WHERE id = ${contextId};`
}

//
// Ingest functions for embedding.
//

export const embedCards = inngest.createFunction(
  { name: "Embed all cards" },
  { event: "embed-cards" },
  async ({ step, logger }) => {
    const deduplicatedCards = (await step.run(
      "Fetching deduplicated cards",
      async () => getCanonicalCardsWithoutEmbedding()
    )) as any as CanonicalValuesCard[]

    const nonCanonicalCards = (await step.run(
      "Fetching canonical cards",
      async () => getNonCanonicalCardsWithoutEmbedding()
    )) as any as ValuesCard[]

    for (const card of deduplicatedCards) {
      await step.run("Embed deduplocated card", async () => {
        await embedCanonicalCard(card)
      })
    }

    for (const card of nonCanonicalCards) {
      await step.run("Embed non-canonical card", async () => {
        await embedNonCanonicalCard(card)
      })
    }

    logger.info(
      `Embedded ${deduplicatedCards.length} canonical cards and ${nonCanonicalCards.length} non-canonical cards.`
    )

    return {
      message: `Embedded ${deduplicatedCards.length} canonical cards and ${nonCanonicalCards.length} non-canonical cards.`,
    }
  }
)

export const embedContexts = inngest.createFunction(
  { name: "Embed all contexts" },
  { event: "embed-contexts" },
  async ({ step, logger }) => {
    const contextsToEmbed = await step.run(
      "Fetching contexts without embeddings",
      async () => db.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "Context" 
          WHERE embedding IS NULL`
    )

    for (const context of contextsToEmbed) {
      await step.run(`Embed context ${context.id}`, async () =>
        embedContext(context.id)
      )
    }

    logger.info(`Embedded ${contextsToEmbed.length} contexts`)

    return {
      message: `Embedded ${contextsToEmbed.length} contexts`,
    }
  }
)
