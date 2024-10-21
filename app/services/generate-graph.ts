import { Value } from "values-tools/src/types"
import { generateContexts, generateQuestions } from "./generation"
import {
  configureValuesTools,
  generateUpgrades,
  generateValueContext,
  PromptCache,
} from "values-tools"
import { inngest } from "~/config.server"
import { db } from "~/config.server"

type Upgrade = {
  fromId: number
  toId: number
  context: string
}

export const generateSeedGraph = inngest.createFunction(
  { name: "Generate Deliberation Graph" },
  { event: "gen-deliberation-graph" },
  async ({ event, step, logger }) => {
    logger.info(`Starting graph generation for deliberation`)

    const deliberationId = event.data.deliberationId as number
    const topic = event.data.topic as string
    const numQuestions = event.data.numQuestions ?? 5
    const numContexts = event.data.numContexts ?? 5

    const values: Value[] = []
    const upgrades: Upgrade[] = []

    let valueIdCounter = 1
    let questionIdCounter = 1

    // 1. generate questions
    const questions = await step.run(
      `Generating ${numQuestions} questions`,
      async () => generateQuestions(topic, numQuestions)
    )

    for (const question of questions) {
      logger.info(`Processing question: ${question.question}`)

      // 2. generate contexts for each question
      const contexts = await step.run(
        `Generating ${numContexts} contexts for question`,
        async () => generateContexts(question.question, numContexts)
      )

      // 3. Generate values for each context
      const newValues = await step.run(
        `Generating values for each context`,
        async () =>
          Promise.all(
            contexts.map((context) =>
              generateValueContext(question.question, context, {
                includeStory: true,
                includeTitle: true,
              }).then((data) => ({
                id: valueIdCounter++,
                title: (data as any).title,
                description: (data as any).fictionalStory,
                policies: data.revisedAttentionPolicies,
                questionId: questionIdCounter,
                contexts,
                context,
              }))
            )
          )
      )

      values.push(...newValues)

      // 4. generate hypotheses for contexts
      const newUpgrades = await step.run(`Generating upgrades`, async () =>
        generateUpgrades(newValues)
      )

      upgrades.push(
        ...newUpgrades.map((data) => ({
          fromId: data.a_id,
          toId: data.b_id,
          context:
            newValues.find((v) => v.id === data.a_id)?.context ||
            newValues[0].context,
        }))
      )

      questionIdCounter++
    }

    logger.info(`Graph generation completed`)

    return {
      message: "Graph generated successfully",
      totalValues: values.length,
      totalUpgrades: upgrades.length,
      totalQuestions: questions.length,
    }
  }
)
