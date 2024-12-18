import { CanonicalValuesCard, Context, EdgeHypothesis } from "@prisma/client"
import { db, inngest } from "~/config.server"
import {
  generateUpgrades,
  generateUpgradesToValue,
  Upgrade,
} from "values-tools"
import {
  getUserEmbedding,
  getCanonicalCardsWithEmbedding,
  getContextEmbedding,
} from "./embedding"
import { cosineDistance } from "values-tools/src/utils"
import { Value } from "values-tools/src/types"

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

export async function upsertUpgradesInDb(
  upgrades: Upgrade[],
  hypothesisRunId: string,
  contextId: string,
  deliberationId: number
): Promise<void> {
  console.log(
    `Upserting ${upgrades.length} upgrades to the database for deliberation ${deliberationId} and context ${contextId}`
  )

  await Promise.all(
    upgrades.map((t) =>
      db.edgeHypothesis.upsert({
        where: {
          fromId_toId_contextId_deliberationId: {
            fromId: t.a_id,
            toId: t.b_id,
            contextId,
            deliberationId,
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
        update: {
          story: t.story,
          hypothesisRunId,
        },
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

async function getContextsWithLinksToValues(deliberationId: number) {
  return db.context.findMany({
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
}

async function getClosestValues(
  values: (CanonicalValuesCard & { embedding: number[] })[],
  context: Omit<
    Awaited<ReturnType<typeof getContextsWithLinksToValues>>[0],
    "createdAt" | "updatedAt"
  >,
  limit: number = 10
) {
  const contextEmbedding = await getContextEmbedding(context.id)

  return (
    values
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
      .slice(0, limit)
  )
}

async function generateReversedUpgrades(
  upgrades: Upgrade[],
  values: Value[],
  contextId: string
) {
  const reversed = upgrades.map((u) => {
    const oldTarget = values.find((v) => v.id === u.b_id)
    const oldSource = values.find((v) => v.id === u.a_id)
    return generateUpgradesToValue(oldSource!, [oldTarget!], contextId)
  })

  return (await Promise.all(reversed)).flat()
}

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

    // Get contexts, and for which cards they apply
    const contexts = await step.run("Fetching contexts", async () =>
      getContextsWithLinksToValues(deliberationId)
    )

    logger.info(
      `About to generate upgrades for deliberation ${deliberationId} and these contexts: ${contexts
        .map((c) => c.id)
        .join(", ")}`
    )

    // Get canonical values, and their embeddings
    const values = (await step.run("Fetching values", async () =>
      getCanonicalCardsWithEmbedding(deliberationId)
    )) as any as (CanonicalValuesCard & { embedding: number[] })[]

    //
    // Generate plausible upgrades for each context.
    // Also generate the upgrades in reverse.
    //
    const allUpgrades: Upgrade[] = []

    for (const context of contexts) {
      const closestValues = await step.run("Get closest values", async () =>
        getClosestValues(values, context, 12)
      )

      const plausibleUpgrades = await step.run(
        `Generate upgrades for context ${context.id} from ${closestValues.length} values`,
        async () => generateUpgrades(closestValues, context.id)
      )

      if (!plausibleUpgrades.length) {
        logger.info(`No upgrades found for context ${context.id}`)
        continue
      }

      const reverseUpgrades = await step.run(
        `Reversing ${plausibleUpgrades.length} upgrades for context ${context.id}`,
        async () =>
          generateReversedUpgrades(plausibleUpgrades, values, context.id)
      )

      const newUpgrades = [...plausibleUpgrades, ...reverseUpgrades]
      allUpgrades.push(...newUpgrades)

      await step.run(
        `Add upgrades & reverse upgrades for context ${context.id} to database`,
        async () =>
          upsertUpgradesInDb(newUpgrades, runId, context.id, deliberationId)
      )
    }

    await step.sendEvent("hypothesize-finished", {
      name: "hypothesize-finished",
      data: { deliberationId },
    })

    return { message: `Success! Created ${allUpgrades.length} new upgrades.` }
  }
)
