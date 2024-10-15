import { CanonicalValuesCard, EdgeHypothesis } from "@prisma/client"
import { db, inngest } from "~/config.server"
import { generateUpgrades, Upgrade } from "values-tools"
import { getUserEmbedding } from "./embedding"

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

async function upsertHypothesizedUpgrades(
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

export const hypothesize_cron = inngest.createFunction(
  { name: "Create Hypothetical Edges Cron", concurrency: 1 },
  { cron: "0 */12 * * *" },
  async ({ step }) => {
    await step.sendEvent({ name: "hypothesize", data: {} })

    return {
      message: "Triggered a hypothesization run.",
    }
  }
)

export const hypothesize = inngest.createFunction(
  { name: "Create Hypothetical Edges", concurrency: 1 },
  { event: "hypothesize" },
  async ({ step, logger, runId }) => {
    logger.info("Creating hypothetical links for all cases.")

    const deliberationId = 1 // TODO! This is hardcoded for now.

    //
    // Don't run the expensive prompt if the latest card is older than last time
    // this cron job ran.
    //
    const latestCanonicalCard = (await step.run(
      "Get latest canonical card",
      async () =>
        db.canonicalValuesCard.findFirst({
          orderBy: { createdAt: "desc" },
        })
    )) as any as CanonicalValuesCard | null

    if (
      latestCanonicalCard?.createdAt &&
      new Date(latestCanonicalCard.createdAt) <
        new Date(Date.now() - 12 * 60 * 60 * 1000)
    ) {
      return {
        message: "Latest card is more than 12 hours old, skipping.",
      }
    }

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
              valuesCard: true,
            },
          },
        },
      })
    )

    //
    // Create and upsert transitions for each context.
    //
    for (const cluster of contexts) {
      const values = cluster.ContextsForValueCards.map((c) => c.valuesCard)
      const context = cluster.ContextsForValueCards[0].context // All contexts are the same.

      const upgrades = await step.run(
        `Generate transitions for context ${context.id}`,
        async () => generateUpgrades(values)
      )

      console.log(
        `Created ${upgrades.length} transitions for context ${context.id}.`
      )

      await step.run(
        `Add transitions for context ${context.id} to database`,
        async () =>
          upsertHypothesizedUpgrades(
            upgrades,
            runId,
            context.id,
            deliberationId
          )
      )
    }

    //
    // Clear out old transitions.
    //
    const { old, added } = (await step.run(
      `Remove old transitions from database`,
      async () => cleanupTransitions(runId)
    )) as any as { old: number; added: number }

    return {
      message: `Success. Removed ${old} transitions. Added ${added} transitions.`,
    }
  }
)
