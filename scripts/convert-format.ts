import { genObj } from "values-tools"
import { z } from "zod"
import { db } from "~/config.server"

async function generateApplicationOfValue(policies: string[]) {
  const question = `How could one best support a Christian girl considering an abortion?`

  return await genObj({
    prompt:
      `You will be given a values card made up of attention policies, and a question. Your task is to reason about what it's meant to live by the value expressed in the policies. Then, describe how someone living by this value would act with regards to the question.

      # Note
      The values card given to you was articulated in response to how ChatGPT should behave, not directly in response to the question. So you'll have to first understand the value behind how ChatGPT should act specifically, as dictated by the value, and then ideate on how to apply that value to the question at hand.

      # Attention Policies
      A values card is made up of several attention policies. Attention policies list what a person pays attention to when they do a kind of discernment about how to act in a certain situation. However, they only specify what is meaningful to pay attention to – that is, something that is consitutively good, in their view – as opposed to instrumental to some other meaningful goal.

      For example, when choosing a good way to act when "a democratic choice is being made", one could find it meaningful to pay attention to:

      ["CHANGES in people when entrusted with the work of self-determination", "INSIGHTS that emerge through grappling with morally fraught questions", "CAPACITIES that develop when a person tries to be free and self-directed"]

      Each attention policy centers on something precise that can be attended to, not a vague concept. Instead of abstractions like "LOVE and OPENNESS which emerges", it might say "FEELINGS in my chest that go along with love and openness." Instead of “DEEP UNDERSTANDING of the emotions”, it might say “A SENSE OF PEACE that comes from understanding”. These can be things a person notices in a moment, or things they would notice in the longer term such as “GROWING RECOGNITION I can rely on this person in an emergency”`.trim(),
    data: {
      Question: question,
      "Attention Policies": policies,
    },
    schema: z.object({
      generalIdeaBehindValue: z
        .string()
        .describe(
          `What's the general idea of how to live in accordance with the value described in the policies? This should be a concise, 1-sentence string that captures the essence of the value.`
        ),
      applicationOfValue: z
        .string()
        .describe(
          `A complete sentence describing ${question
            .toLowerCase()
            .replace(
              "?",
              ""
            )}, based on the general idea behind the value. 1-2 sentences max. Someone reading this should understand what people who live in accordance with the policies would act in the situation. Do not include any lead in ("Someone helping a Christian girl based on this value would...").`
        ),
    }),
  }).then((response) => response.applicationOfValue)
}

async function isRelevantToAbortion(policies: string[]): Promise<boolean> {
  return await genObj({
    prompt: `
      You will be given a set of attention policies that describe what someone pays attention to when making decisions. Your task is to determine if these policies would be relevant and meaningful to consider when supporting a Christian girl considering an abortion.

      # Question
      Would paying attention to these specific things help generate meaningful guidance for a Christian girl considering an abortion?

      # Evaluation Criteria
      - The policies should help illuminate important aspects of the situation
      - They should be relevant to the emotional, spiritual, or practical dimensions of the decision
      - They should help generate concrete guidance (not be too abstract or disconnected)
      
      # Example
      Policies like "CHANGES in someone's sense of peace after prayer" or "MOMENTS of clarity when discussing fears" would be relevant.
      Policies like "EFFICIENCY of computer algorithms" or "BEAUTY of mathematical proofs" would not be relevant.`.trim(),
    data: {
      "Attention Policies": policies,
    },
    schema: z.object({
      isRelevant: z
        .boolean()
        .describe(
          "Whether these policies would be relevant and meaningful for supporting a Christian girl considering an abortion"
        ),
    }),
  }).then((response) => {
    return response.isRelevant
  })
}

async function convertDescriptions() {
  const values = await db.canonicalValuesCard.findMany({
    where: {
      valuesCards: {
        some: {
          chat: {
            questionId: 60,
          },
        },
      },
    },
  })

  for (const value of values) {
    console.log(`\n=== Processing Value: ${value.id} ===\n`)
    const policies = value.policies
    const isRelevant = await isRelevantToAbortion(policies)

    if (!isRelevant) {
      console.log(`Not relevant: ${policies.join("\n")}`)

      await db.canonicalValuesCard.update({
        where: {
          id: value.id,
        },
        data: {
          metadata: { relevantToAbortion: false },
        },
      })
    }

    const application = await generateApplicationOfValue(policies)

    await db.canonicalValuesCard.update({
      where: {
        id: value.id,
      },
      data: {
        description: application,
        metadata: {
          relevantToAbortion: true,
          oldDescription: value.description,
        },
      },
    })
  }
}

await convertDescriptions()
