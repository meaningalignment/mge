// generate graph
// 1. generate questions
// 2. generate contexts for each question
// 3. generate values for a question. Rank how relevant for each context
// 4. generate hypotheses for contexts and values.

import { generateContexts, generateQuestions } from "./generate-questions"
import { generateValueContext } from "values-tools"

export async function generateGraph(
  topic: string,
  numQuestions: number = 5,
  numContexts: number = 5,
  numValues: number = 5
) {
  let values: any[] = []
  let contexts: any[] = []
  // 1. generate questions
  const questions = await generateQuestions(topic, numQuestions)

  for (const question of questions) {
    // 2. generate contexts for each question
    const contexts = await generateContexts(question, numContexts)
    // 3. Generate values for each context
    const values = await Promise.all(
      contexts.map((context) =>
        generateValueContext(question, context, {
          includeStory: true,
          includeTitle: true,
        }).then((data) => ({
          title: (data as any).title,
          description: (data as any).fictionalStory,
          policies: data.revisedAttentionPolicies,
          contexts,
          context,
        }))
      )
    )
  }

  // 2. generate contexts for each question
  for (const question of questions) {
    const contexts = await generateContexts(question, numContexts)

    for (const context of contexts) {
      const value = await generateValueContext(question, context)
    }
  }
}
