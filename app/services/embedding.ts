import { DeduplicatedCard, ValuesCard } from "@prisma/client"
import { db, inngest } from "~/config.server"
import { calculateAverageEmbedding } from "~/lib/utils"
import { embedValue } from "values-tools"

export async function embedDeduplicatedCard(
  card: DeduplicatedCard
): Promise<void> {
  // Embed card.
  const embedding: number[] = await embedValue(card)

  // Update in DB.
  await db.$executeRaw`UPDATE "DeduplicatedCard" SET embedding = ${JSON.stringify(
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

export async function getDeduplicatedCardsWithoutEmbedding(): Promise<
  Array<DeduplicatedCard>
> {
  return (await db.$queryRaw`SELECT id, title, "description", "policies", embedding::text FROM "DeduplicatedCard" WHERE "DeduplicatedCard".embedding IS NULL`) as DeduplicatedCard[]
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

//
// Ingest function for embedding.
//

export const embed = inngest.createFunction(
  { name: "Embed all cards" },
  { event: "embed" },
  async ({ step, logger }) => {
    const deduplicatedCards = (await step.run(
      "Fetching deduplicated cards",
      async () => getDeduplicatedCardsWithoutEmbedding()
    )) as any as DeduplicatedCard[]

    const nonCanonicalCards = (await step.run(
      "Fetching canonical cards",
      async () => getNonCanonicalCardsWithoutEmbedding()
    )) as any as ValuesCard[]

    for (const card of deduplicatedCards) {
      await step.run("Embed deduplocated card", async () => {
        await embedDeduplicatedCard(card)
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
