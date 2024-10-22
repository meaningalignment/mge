import { CanonicalValuesCard, EdgeHypothesis } from "@prisma/client"
import { db, inngest } from "~/config.server"
import { generateUpgrades, Upgrade } from "values-tools"
import { getUserEmbedding } from "./embedding"
import { Value } from "values-tools/src/types"

type EdgeHypothesisData = {
  to: CanonicalValuesCard
  from: CanonicalValuesCard
  contextId: string
  story: string
  hypothesisRunId: string
}

async function getDistanceFromUserValuesMap(
  userId: number
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
  size: number = 3
): Promise<EdgeHypothesisData[]> {
  // Find edge hypotheses that the user has not linked together yet.
  const hypotheses = (await db.edgeHypothesis.findMany({
    where: {
      AND: [
        { from: { edgesFrom: { none: { userId } } } },
        { to: { edgesTo: { none: { userId } } } },
      ],
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
  const distances = await getDistanceFromUserValuesMap(userId)

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
    } as EdgeHypothesisData
  })
}

export async function upsertHypothesizedUpgrades(
  upgrades: Upgrade[],
  hypothesisRunId: string,
  condition: string,
  deliberationId: number
): Promise<void> {
  await Promise.all(
    upgrades.map((t) =>
      db.edgeHypothesis.upsert({
        where: {
          fromId_toId: {
            fromId: t.a_id,
            toId: t.b_id,
          },
        },
        create: {
          from: { connect: { id: t.a_id } },
          to: { connect: { id: t.b_id } },
          context: {
            connect: {
              id_deliberationId: {
                id: condition,
                deliberationId,
              },
            },
          },
          deliberation: { connect: { id: deliberationId } },
          story: t.story,
          hypothesisRunId,
        },
        update: {},
      })
    )
  )
}

async function cleanupTransitions(hypothesisRunId: string): Promise<{
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

  await db.edgeHypothesis.deleteMany({
    where: {
      hypothesisRunId: {
        not: hypothesisRunId,
      },
    },
  })

  return { old: oldTransitions, added: newTransitions }
}

//
// Ingest function for creating edge hypotheses.
//

export const hypothesizeCron = inngest.createFunction(
  { name: "Create Hypothetical Edges Cron", concurrency: 1 },
  { cron: "0 */12 * * *" },
  async ({ step, logger }) => {
    await step.sendEvent({ name: "hypothesize", data: {} })

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
        await step.sendEvent({
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
  { name: "Create Hypothetical Edges", concurrency: 1 },
  { event: "hypothesize" },
  async ({ event, step, logger, runId }) => {
    logger.info("Creating hypothetical links for all cases.")

    const deliberationId = event.data!.deliberationId as number

    logger.info(`Running hypothetical links generation`)

    // Get contexts.
    const contexts = await step.run("Fetching contexts with values", async () =>
      db.context.findMany({
        include: {
          ContextsForValueCards: {
            include: {
              context: {
                select: {
                  id: true,
                },
              },
              valuesCard: {
                include: {
                  canonicalCard: true,
                },
              },
            },
          },
        },
      })
    )

    //
    // Create and upsert transitions for each context.
    //
    for (const cluster of contexts) {
      // Extract unique canonical values connected to the context.
      const values = Array.from(
        new Map(
          cluster.ContextsForValueCards.map((c) => c.valuesCard.canonicalCard)
            .filter((c): c is NonNullable<typeof c> => c !== null)
            .map((card) => [card.id, card])
        ).values()
      )

      if (values.length < 2) {
        logger.info(`Skipping: Not enough values.`)
        continue
      }

      const contextId = cluster.ContextsForValueCards[0].contextId // contexts in cluster are the same.

      const upgrades = await step.run(
        `Generate transitions for context ${contextId}`,
        async () => generateUpgrades(values)
      )

      logger.info(
        `Created ${upgrades.length} transitions for context ${contextId}.`
      )

      await step.run(
        `Add transitions for context ${contextId} to database`,
        async () =>
          upsertHypothesizedUpgrades(upgrades, runId, contextId, deliberationId)
      )
    }

    //
    // Clear out old transitions.
    //
    const { old, added } = (await step.run(
      `Remove old transitions from database`,
      async () => cleanupTransitions(runId)
    )) as any as { old: number; added: number }

    await step.sendEvent({
      name: "hypothesize-finished",
      data: { deliberationId },
    })

    return {
      message: `Success. Removed ${old} transitions. Added ${added} transitions.`,
    }
  }
)
