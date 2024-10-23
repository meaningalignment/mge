import { z } from "zod"
import { generateValueContext, genObj } from "values-tools"
import { db, inngest } from "~/config.server"
import { Question } from "@prisma/client"

export async function generateQuestions(
  topic: string,
  numQuestions: number = 5
) {
  return genObj({
    prompt: `You will be given a topic. Your task is to reason about what potential questions could be posed around the topic, where each question starts with a personal story depicting a specific scenario that would require a different approach than all other questions.

    Return a list of ${numQuestions} such questions that would be relevant to consider for the topic.
    
    For example, if the topic is "Abortion policy in the US", a question might be "A christian girl is considering an abortion, grappling with her faith and personal needs. What support could be provided to her?"`,
    data: { Topic: topic },
    schema: z.object({
      questions: z
        .array(
          z.object({
            question: z
              .string()
              .describe(
                `A brief personal story (2-3 sentences) depicting a specific scenario related to the topic, followed by a question about how to address the situation. The questions should be values-laden and focus on how to best support or address the situations described.`
              ),
            title: z
              .string()
              .describe(`A short 2-5 word title that summarizes the question.`),
          })
        )
        .describe(`An array of questions.`),
    }),
  }).then((res) => res.questions)
}

export async function generateContexts(question: string, numContexts = 5) {
  return await genObj({
    prompt: `You will be given a question. Your task is to reason about what factors are present that are relevant for how to wisely approach the question.
    
    Return a list of the ${numContexts} most important such factors.
    
    For example, if the question is "I am a christian girl and am considering an abortion, what should I do?", the factors might be: "A person is considering an abortion", "A person is seeking guidance", "A person is grappling with their christian faith", "A person is dealing with conflicting values", "A person is considering a life-changing decision".`,
    data: { Question: question },
    schema: z.object({
      factors: z
        .array(
          z.object({
            situationalContext: z
              .string()
              .describe(
                `Describe in 1-2 sentences an aspect of the situation that that affects what's wise to do with regards to the question.`
              ),
            factor: z
              .string()
              .describe(
                `The factor from the situational context, in as few words as possible. For example, "The girl is in distress". Should be phrased in a way such that it is possible to append it to the words: "What's wise to do when ...".`
              ),
            generalizedFactor: z
              .string()
              .describe(
                `The factor where any unnecessary information is removed, but the meaning is preserved. For example, "The girl is in distress" could be generalized as "A person is in distress". The fact that she is a girl does not change the values one should approach the distress with. However, don't generalize away detail that do change the values one should approach the question with. For example, "The girl considering an abortion is a christian" should not be generalized to "A religious person is considering an abortion". The fact that she is a christian is relevant, as the christian faith has specific views on abortion.`
              ),
          })
        )
        .describe(
          `${numContexts} of the most important factors to consider in answering the question wisely.`
        ),
    }),
  }).then((res) => res.factors.map((f) => f.generalizedFactor))
}

async function addContextsInDb(
  deliberationId: number,
  questionId: number,
  contexts: string[]
) {
  return Promise.all(
    contexts.map((context) =>
      db.context.upsert({
        where: {
          id_deliberationId: {
            id: context,
            deliberationId: deliberationId,
          },
        },
        create: {
          id: context,
          deliberation: { connect: { id: deliberationId } },
          ContextsForQuestions: {
            create: { questionId },
          },
        },
        update: {
          ContextsForQuestions: {
            connectOrCreate: {
              where: {
                contextId_questionId_deliberationId: {
                  contextId: context,
                  questionId,
                  deliberationId,
                },
              },
              create: { questionId },
            },
          },
        },
      })
    )
  )
}

function resetDeliberationStatus(deliberationId: number) {
  return db.deliberation.update({
    where: { id: deliberationId },
    data: { setupStatus: "ready" },
  })
}

async function onFailure({ event, step }: { event: any; step: any }) {
  const deliberationId = event.data.event.data.deliberationId as number
  await step.run(`Resetting deliberation status`, async () =>
    resetDeliberationStatus(deliberationId)
  )
}

export const generateSeedQuestionsAndContexts = inngest.createFunction(
  { name: "Generate Seed Questions and Contexts", onFailure },
  { event: "gen-seed-questions-contexts" },

  async ({ event, step, logger }) => {
    logger.info(`Running deliberation setup.`)

    const deliberationId = event.data.deliberationId as number
    const topic = event.data.topic as string
    const numQuestions = event.data.numQuestions ?? 5
    const numContexts = event.data.numContexts ?? 5

    await step.run(`Marking seeding in db`, async () =>
      db.deliberation.update({
        where: { id: deliberationId },
        data: { setupStatus: "generating_contexts" },
      })
    )

    const questions = await step.run(
      `Generate deliberation questions for topic: ${topic}`,
      async () => generateQuestions(topic, numQuestions)
    )

    for (const question of questions) {
      logger.info(`Generating contexts for question: ${question}`)

      const dbQuestion = await step.run(
        `Inserting question in DB`,
        async () =>
          db.question.create({
            data: {
              question: question.question,
              title: question.title,
              deliberationId,
            },
          }) as any as Question
      )

      const contexts = await step.run(
        `Generate contexts for question: ${question}`,
        async () => generateContexts(question.question, numContexts)
      )

      await step.run(`Inserting or updating contexts in DB`, async () =>
        addContextsInDb(deliberationId, dbQuestion.id, contexts)
      )
    }

    await step.run(`Marking setup as finished`, async () =>
      resetDeliberationStatus(deliberationId)
    )

    return { message: "Finished" }
  }
)

export const generateSeedContexts = inngest.createFunction(
  { name: "Generate Seed Contexts", onFailure },
  { event: "gen-seed-contexts" },
  async ({ event, step, logger }) => {
    logger.info(`Running deliberation setup.`)

    const deliberationId = event.data.deliberationId as number
    const questionIds = event.data.questionIds as number[]
    const numContexts = event.data.numContexts ?? 5

    await step.run(`Marking seeding in db`, async () =>
      db.deliberation.update({
        where: { id: deliberationId },
        data: { setupStatus: "generating_contexts" },
      })
    )

    for (const questionId of questionIds) {
      const question = await step.run(
        `Fetching question: ${questionId}`,
        async () => db.question.findUniqueOrThrow({ where: { id: questionId } })
      )

      const contexts = await step.run(
        `Generate contexts for question: ${questionId}`,
        async () => generateContexts(question.question, numContexts)
      )

      await step.run(`Inserting or updating contexts in DB`, async () =>
        addContextsInDb(deliberationId, question.id, contexts)
      )
    }

    await step.run(`Marking setup as finished`, async () =>
      resetDeliberationStatus(deliberationId)
    )

    return { message: "Finished" }
  }
)

export const generateSeedGraph = inngest.createFunction(
  { name: "Generate Seed Graph", onFailure },
  { event: "gen-seed-graph" },
  async ({ event, step, logger, runId }) => {
    logger.info(`Starting graph generation for deliberation`)

    await step.run(`Marking graph gen in db`, async () =>
      db.deliberation.update({
        where: { id: deliberationId },
        data: { setupStatus: "generating_graph" },
      })
    )

    const deliberationId = event.data.deliberationId as number

    const questions = await step.run("Fetching questions", async () =>
      db.question.findMany({ where: { deliberationId } })
    )
    const contexts = await step.run("Fetching contexts", async () =>
      db.context.findMany({
        where: { deliberationId },
        include: {
          ContextsForQuestions: true,
        },
      })
    )

    for (const question of questions) {
      logger.info(`Processing question: ${question.question}`)

      const contextsForQuestion = contexts.filter((c) =>
        c.ContextsForQuestions.some((q) => q.questionId === question.id)
      )

      // Generate values for each context
      const values = await step.run(`Generating values for context`, async () =>
        Promise.all(
          contextsForQuestion.map((context, index) =>
            generateValueContext(question.question, context.id, {
              includeStory: true,
              includeTitle: true,
            }).then((data) => ({
              id: index,
              title: (data as any).title,
              description: (data as any).fictionalStory,
              policies: data.revisedAttentionPolicies,
            }))
          )
        )
      )

      // Save values to the database and create connections to contexts
      await step.run(
        `Inserting values in DB and connecting to contexts`,
        async () => {
          await Promise.all(
            values.map((v) =>
              db.valuesCard.create({
                data: {
                  seedGenerationRunId: runId,
                  description: v.description,
                  policies: v.policies,
                  title: v.title,
                  deliberationId,
                  // Link values card to all contexts for question, even though it was created for a particular one. Otherwise, our final seed graph will not be linked correctly, as all values will be for specific contexts.
                  ContextsForValueCards: {
                    createMany: {
                      data: contextsForQuestion.map((c) => ({
                        contextId: c.id,
                        deliberationId,
                      })),
                    },
                  },
                },
              })
            )
          )
        }
      )
    }

    // Run deduplication.
    await step.sendEvent({
      name: "deduplicate",
      data: { deliberationId },
    })
    await step.waitForEvent("deduplicate-finished", {
      timeout: "15m",
      if: `async.data.deliberationId == ${deliberationId}`,
    })

    // Run hypothesization.
    await step.sendEvent({
      name: "hypothesize",
      data: { deliberationId },
    })
    await step.waitForEvent("hypothesize-finished", {
      timeout: "15m",
      if: `async.data.deliberationId == ${deliberationId}`,
    })

    await step.run(`Marking setup as finished`, async () =>
      resetDeliberationStatus(deliberationId)
    )

    return {
      message: "Graph generated successfully",
    }
  }
)
