import { CanonicalValuesCard, ValuesCard } from "@prisma/client"
import { embeddingService as embeddings } from "./embedding"
import { db, inngest } from "~/config.server"
import {
  deduplicateValues,
  getExistingDuplicateValue,
  getRepresentativeValue,
} from "values-tools"

async function createCanonicalCard(data: {
  title: string
  description: string
  policies: string[]
  deliberationId: number
}) {
  // Create a canonical values card.
  const canonical = await db.canonicalValuesCard.create({
    data: {
      title: data.title,
      description: data.description,
      policies: data.policies,
      deliberationId: data.deliberationId,
    },
  })
  // Embed the canonical values card.
  await embeddings.embedDeduplicatedCard(canonical as any)
  return canonical
}

async function similaritySearch(
  vector: number[],
  limit: number = 10,
  minimumDistance: number = 0.1
): Promise<Array<CanonicalValuesCard>> {
  const query = `SELECT DISTINCT cvc.id, cvc.title, cvc."description", cvc."", cvc."policies", cvc.embedding <=> '${JSON.stringify(
    vector
  )}'::vector as "_distance"
    FROM "CanonicalValuesCard" cvc
    ORDER BY "_distance" ASC
    LIMIT ${limit};`

  const result = await db.$queryRawUnsafe<
    Array<CanonicalValuesCard & { _distance: number }>
  >(query)

  return result.filter((r) => r._distance < minimumDistance)
}

async function fetchSimilarCanonicalCard(
  candidate: { title: string; description: string; policies: string[] },
  limit: number = 5
): Promise<CanonicalValuesCard | null> {
  console.log(
    `Fetching similar canonical card, candidate: ${JSON.stringify(candidate)}`
  )

  // Embed the candidate.
  const card_embeddings = await embeddings.embedCandidate({
    policies: candidate.policies || [],
  })

  console.log("Got card embeddings, fetching canonical card.")

  // Fetch `limit` canonical cards for the case based on similarity.
  const canonical = await similaritySearch(card_embeddings, limit, 0.1)

  console.log(`Got ${canonical.length} canonical cards`)

  // If we have no canonical cards, we can't deduplicate.
  if (canonical.length === 0) {
    console.log("No canonical cards found for candidate.")
    return null
  }

  // Use a prompt to see if any of the canonical cards are the same value
  return getExistingDuplicateValue(candidate, canonical)
}

async function fetchNonCanonicalizedValues(limit: number = 50) {
  return (await db.valuesCard.findMany({
    where: { canonicalCardId: null },
    take: limit,
  })) as ValuesCard[]
}

async function linkClusterToCanonicalCard(
  cluster: ValuesCard[],
  canonicalCard: CanonicalValuesCard
) {
  await db.valuesCard.updateMany({
    where: {
      id: { in: cluster.map((c) => c.id) },
    },
    data: { canonicalCardId: canonicalCard.id },
  })
}

//
// Ingest function for deduplication.
//
// Type casting is a bit broken here, hence the `any` casts.
// Thread with caution.
//

export const deduplicate = inngest.createFunction(
  { name: "Deduplicate", concurrency: 1 }, // Run sequentially to avoid RCs.
  { cron: "0 * * * *" },
  async ({ step, logger }) => {
    logger.info(`Running deduplication.`)

    // Get all non-canonicalized submitted values cards.
    const cards = (await step.run(
      `Get non-canonicalized cards from database`,
      async () => fetchNonCanonicalizedValues()
    )) as any as ValuesCard[]

    if (cards.length === 0) {
      logger.info(`No cards to deduplicate.`)

      return {
        message: `No cards to deduplicate.`,
      }
    }

    // Cluster the non-canonicalized cards with a prompt / dbscan.
    const clusters = (await step.run(`Cluster cards using prompt`, async () => {
      const useDbScan = cards.length > 20 // Only use dbscan when we're dealing with a lot of cards.
      return deduplicateValues(cards, null, useDbScan)
    })) as any as ValuesCard[][]

    logger.info(`Found ${clusters.length} clusters.`)

    //
    // For each deduplicated non-canonical card, find canonical cards that are essentially
    // the same value and link them.
    //
    // If no such cards exist, canonicalize the duplicated non-canonical card and link the cluster
    // to the new canonical card.
    //
    let i = 0
    for (const cluster of clusters) {
      logger.info(`Deduplicating cluster ${++i} of ${cluster.length} cards.`)

      const representative = (await step.run(
        "Get best values card from cluster",
        async () => getRepresentativeValue(cluster)
      )) as any as { title: string; description: string; policies: string[] }

      const existingCanonicalDuplicate = (await step.run(
        "Fetch canonical duplicate",
        async () => fetchSimilarCanonicalCard(representative)
      )) as any as CanonicalValuesCard | null

      if (existingCanonicalDuplicate) {
        await step.run("Link cluster to existing canonical card", async () =>
          linkClusterToCanonicalCard(cluster, existingCanonicalDuplicate)
        )
      } else {
        const newCanonicalDuplicate = (await step.run(
          "Canonicalize representative",
          async () => createCanonicalCard(representative as any)
        )) as any as CanonicalValuesCard

        await step.run(
          "Link cluster to newly created canonical card",
          async () => linkClusterToCanonicalCard(cluster, newCanonicalDuplicate)
        )
      }
    }

    logger.info(`Done. Deduplicated ${cards.length} cards.`)

    return {
      message: `Deduplicated ${cards.length} cards.`,
    }
  }
)
