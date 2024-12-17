import { CanonicalValuesCard, EdgeHypothesis } from "@prisma/client"
import { db, inngest } from "~/config.server"
import { generateUpgrades, Upgrade } from "values-tools"
import {
  getUserEmbedding,
  getCanonicalCardsWithEmbedding,
  getContextEmbedding,
} from "./embedding"
import { clusterValues } from "values-tools/src/services/deduplicate"
import { cosineDistance } from "values-tools/src/utils"

type EdgeHypothesisData = {
  to: CanonicalValuesCard
  from: CanonicalValuesCard
  contextId: string
  story: string
  hypothesisRunId: string
  deliberationId: number
}

async function getDistanceFromUserValuesMap(
  userId: number,
  deliberationId: number
): Promise<Map<number, number>> {
  // Get the user's embedding vector.
  const vector = await getUserEmbedding(userId)

  // Get the values ordered by their similarity to the vector.
  const result = await db.$queryRaw<Array<{ id: number; _distance: number }>>`
    SELECT
      cvc.id,
      cvc.embedding <=> ${JSON.stringify(vector)}::vector as "_distance"
    FROM
      "CanonicalValuesCard" cvc
    INNER JOIN "EdgeHypothesis" eh
    ON eh."fromId" = cvc.id
    WHERE
      eh."deliberationId" = ${deliberationId}
    ORDER BY
      "_distance" DESC
    LIMIT 500;`

  // Convert the array to a map.
  const map = new Map<number, number>()
  for (const r of result) {
    map.set(r.id, r._distance)
  }

  // Return the map.
  return map
}

export async function getDraw(
  userId: number,
  deliberationId: number,
  size: number = 3
): Promise<EdgeHypothesisData[]> {
  // Find edge hypotheses that the user has not linked together yet.
  const hypotheses = (await db.edgeHypothesis.findMany({
    where: {
      deliberationId,
      archivedAt: null,
      from: { edgesFrom: { none: { userId } } },
      to: { edgesTo: { none: { userId } } },
    },
    include: {
      from: true,
      to: true,
    },
  })) as (EdgeHypothesis & {
    from: CanonicalValuesCard
    to: CanonicalValuesCard
  })[]

  // The unique values that are linked to a more comprehensive value.
  const fromValues = [...new Set(hypotheses.map((h) => h.fromId))].map(
    (id) => hypotheses.find((h) => h.fromId === id)!.from!
  )

  // The map of distances between the user's embedding and the "from" values.
  const distances = await getDistanceFromUserValuesMap(userId, deliberationId)

  //
  // Sort the hypotheses on similarity to the user's embedding.
  //
  const sortedHypotheses = hypotheses.sort((a, b) => {
    const distanceA = distances.get(a.fromId) ?? 0
    const distanceB = distances.get(b.fromId) ?? 0

    // Sort values with a smaller distance as fallback.
    return distanceA - distanceB
  })

  // Return the most relevant hypotheses.
  return sortedHypotheses.slice(0, size).map((h) => {
    return {
      to: h.to,
      from: h.from,
      story: h.story,
      contextId: h.contextId,
      deliberationId: h.deliberationId,
    } as EdgeHypothesisData
  })
}

export async function upsertUpgrades(
  upgrades: Upgrade[],
  hypothesisRunId: string,
  contextId: string,
  deliberationId: number
): Promise<void> {
  console.log(`Adding ${upgrades.length} new upgrades to the database.`)

  await Promise.all(
    upgrades.map((t) =>
      db.edgeHypothesis.upsert({
        where: {
          fromId_toId_contextId_deliberationId_hypothesisRunId: {
            fromId: t.a_id,
            toId: t.b_id,
            contextId,
            deliberationId,
            hypothesisRunId,
          },
        },
        create: {
          hypothesisRunId,
          story: t.story,
          from: { connect: { id: t.a_id } },
          to: { connect: { id: t.b_id } },
          deliberation: { connect: { id: deliberationId } },
          context: {
            connect: {
              id_deliberationId: {
                id: contextId,
                deliberationId,
              },
            },
          },
        },
        update: {},
      })
    )
  )
}

async function cleanupTransitions(
  deliberationId: number,
  hypothesisRunId: string
): Promise<{
  old: number
  added: number
}> {
  const newTransitions = await db.edgeHypothesis.count({
    where: { hypothesisRunId },
  })
  const oldTransitions = await db.edgeHypothesis.count({
    where: { hypothesisRunId: { not: hypothesisRunId } },
  })

  if (newTransitions < 1) {
    throw Error("No new transitions found by prompt, will break screen 3")
  }

  console.log(
    `Deleting ${oldTransitions} old transitions. Adding ${newTransitions} new ones.`
  )

  await db.edgeHypothesis.updateMany({
    data: {
      archivedAt: new Date(),
    },
    where: {
      deliberationId,
      hypothesisRunId: { not: hypothesisRunId },
    },
  })

  return { old: oldTransitions, added: newTransitions }
}

//
// Ingest function for creating edge hypotheses.
//

export const hypothesizeCron = inngest.createFunction(
  { id: "hypothesize-cron", concurrency: 1 },
  { cron: "0 */12 * * *" },
  async ({ step, logger }) => {
    await step.sendEvent("hypothesize", { name: "hypothesize", data: {} })

    // Get all deliberations
    const deliberations = await step.run(
      "Fetching all deliberations",
      async () => {
        return db.deliberation.findMany()
      }
    )

    for (const deliberation of deliberations) {
      // Get the latest canonical card for this deliberation
      const latestCanonicalCard = await step.run(
        `Get latest canonical card for deliberation ${deliberation.id}`,
        async () =>
          db.canonicalValuesCard.findFirst({
            where: { deliberationId: deliberation.id },
            orderBy: { createdAt: "desc" },
          })
      )

      // Check if the latest card is older than 12 hours
      if (
        latestCanonicalCard?.createdAt &&
        new Date(latestCanonicalCard.createdAt) >
          new Date(Date.now() - 12 * 60 * 60 * 1000)
      ) {
        // If the card is recent, trigger the hypothesize event
        await step.sendEvent("hypothesize", {
          name: "hypothesize",
          data: { deliberationId: deliberation.id },
        })
      } else {
        logger.info(
          `Skipping deliberation ${deliberation.id}: Latest card is more than 12 hours old or doesn't exist.`
        )
      }
    }

    return {
      message: "Triggered hypothesization runs for eligible deliberations.",
    }
  }
)

export const hypothesize = inngest.createFunction(
  { id: "hypothesize", concurrency: 1 },
  { event: "hypothesize" },
  async ({ event, step, logger, runId }) => {
    const deliberationId = event.data!.deliberationId as number
    logger.info(`Running hypothetical links generation`)

    // Make sure all canonical cards are embedded first.
    await step.sendEvent("embed-cards", {
      name: "embed-cards",
      data: { deliberationId, cardType: "canonical" },
    })
    await step.waitForEvent("embed-cards-finished", {
      timeout: "15m",
      event: "embed-cards-finished",
      match: "data.deliberationId",
    })

    // Get contexts, and for which cards they apply.
    const contexts = await step.run("Fetching contexts", async () =>
      db.context.findMany({
        where: {
          deliberationId,
          ContextsForQuestions: {
            some: {
              question: {
                deliberationId,
              },
            },
          },
        },
        include: {
          ContextsForQuestions: {
            select: {
              question: {
                select: {
                  ValuesCard: {
                    select: {
                      canonicalCardId: true,
                    },
                  },
                },
              },
            },
          },
        },
      })
    )

    // Get canonical values
    const values = (await step.run("Fetching values", async () =>
      getCanonicalCardsWithEmbedding(deliberationId)
    )) as any as (CanonicalValuesCard & { embedding: number[] })[]

    //
    // Generate upgrades for each context, by feeding in
    // the 30 closest values in terms of cosine distance.
    //
    for (const context of contexts) {
      const contextEmbedding = await step.run(
        "Get context embedding",
        async () => getContextEmbedding(context.id)
      )

      const closestValues = values
        // Only include canonical cards where one of the original cards
        // was articulated for a relevant context.
        .filter((cc) =>
          context.ContextsForQuestions.some((c) =>
            c.question.ValuesCard.some((vc) => vc.canonicalCardId === cc.id)
          )
        )
        // Find closest values to context using cosine distance
        .map((value) => ({
          ...value,
          distance: cosineDistance(contextEmbedding, value.embedding),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10)

      const upgrades = await step.run(
        `Generate upgrades for context ${context.id} from ${closestValues.length} values`,
        async () => generateUpgrades(closestValues, context.id)
      )

      if (!upgrades.length) {
        logger.info(`No upgrades found for context ${context.id}`)
        continue
      }

      await step.run(
        `Add upgrades for context ${context.id} to database`,
        async () => upsertUpgrades(upgrades, runId, context.id, deliberationId)
      )
    }

    //
    // Clear out old transitions.
    //
    const { old, added } = (await step.run(
      `Remove old transitions from database`,
      async () => cleanupTransitions(deliberationId, runId)
    )) as any as { old: number; added: number }

    await step.sendEvent("hypothesize-finished", {
      name: "hypothesize-finished",
      data: { deliberationId },
    })

    return {
      message: `Success. Removed ${old} old transitions. Added ${added} new transitions.`,
    }
  }
)
