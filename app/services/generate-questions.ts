import { z } from "zod"
import { genObj } from "values-tools"
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

export const generateQuestionsAndContexts = inngest.createFunction(
  { name: "Generate Deliberation Questions and Contexts" },
  { event: "gen-questions-contexts" },
  async ({ event, step, logger }) => {
    logger.info(`Running deliberation setup.`)

    const deliberationId = event.data.deliberationId as number
    const topic = event.data.topic as string
    const numQuestions = event.data.numQuestions ?? 5
    const numContexts = event.data.numContexts ?? 5

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
      db.deliberation.update({
        where: { id: deliberationId },
        data: { setupStatus: "completed" },
      })
    )

    return { message: "Finished" }
  }
)

// generate graph
// 1. generate questions
// 2. generate contexts for each question
// 3. generate values for a question. Rank how relevant for each context
// 4. generate hypotheses for contexts and values.
