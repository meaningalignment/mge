import { CanonicalValuesCard } from "@prisma/client"
import { genObj, summarizeGraph } from "values-tools"
import { db } from "~/config.server"
import { z } from "zod"
import { MoralGraphValue } from "values-tools/src/types"

async function getContextsForDeliberation(
  deliberationId: number,
  questionId: number
) {
  return db.context.findMany({
    where: {
      deliberationId,
      ContextsForQuestions: {
        some: { questionId },
      },
    },
  })
}

async function getValuesForDeliberation(
  deliberationId: number,
  questionId: number
) {
  return db.canonicalValuesCard.findMany({
    where: {
      deliberationId,
      valuesCards: {
        some: {
          chat: { questionId },
        },
      },
    },
  })
}

async function getEdgesForContext(
  deliberationId: number,
  questionId: number,
  contextId: string
) {
  return db.edge.findMany({
    where: {
      deliberationId,
      contextId,
      from: {
        valuesCards: {
          some: { chat: { questionId } },
        },
      },
      to: {
        valuesCards: {
          some: { chat: { questionId } },
        },
      },
    },
  })
}

function printTopValues(values: any[], count = 5) {
  console.log(`\nTop ${count} values by PageRank:`)
  values.slice(0, count).forEach((value, index) => {
    console.log(
      `${index + 1}. "${value.title}" - PageRank: ${value.pageRank?.toFixed(3)}`
    )
  })
}

async function generateIntervention(context: string, value: MoralGraphValue) {
  const question = `What should be done in the US about abortion policy, specifically when considering christian girls thinking about having an abortion, who are ${context.replace(
    "When ",
    ""
  )}?`

  console.log(question)

  return await genObj({
    prompt:
      `You will be given a values card made up of attention policies, and a question. Your task is to generate a suggested action or intervention that is in line with the way of life expressed in the policies.

    # Note
    The values card given to you was articulated in response to how ChatGPT should behave, not directly in response to the question. So you'll have to first understand the value behind how ChatGPT should act specifically, as dictated by the value, and then ideate on how to apply that value to the question at hand.

    # Attention Policies
    A values card is made up of several attention policies. Attention policies list what a person pays attention to when they do a kind of discernment about how to act in a certain situation. However, they only specify what is meaningful to pay attention to – that is, something that is consitutively good, in their view – as opposed to instrumental to some other meaningful goal.

    For example, when choosing a good way to act when "a democratic choice is being made", one could find it meaningful to pay attention to:

    ["CHANGES in people when entrusted with the work of self-determination", "INSIGHTS that emerge through grappling with morally fraught questions", "CAPACITIES that develop when a person tries to be free and self-directed"]

    Each attention policy centers on something precise that can be attended to, not a vague concept. Instead of abstractions like "LOVE and OPENNESS which emerges", it might say "FEELINGS in my chest that go along with love and openness." Instead of “DEEP UNDERSTANDING of the emotions”, it might say “A SENSE OF PEACE that comes from understanding”. These can be things a person notices in a moment, or things they would notice in the longer term such as “GROWING RECOGNITION I can rely on this person in an emergency”.`.trim(),
    data: {
      Question: question,
      "Attention Policies": value.policies,
    },
    schema: z.object({
      interventionIdeas: z.array(
        z.string().describe(`An intervention idea. A short sentence.`)
      ),
      bestInterventionIdea: z.object({
        interventionIdea: z
          .string()
          .describe(
            `The intervention idea that most skillfully, effectively, and realistically applies the values card to the question`
          ),
        reasonForBeingBest: z
          .string()
          .describe(`The reason why this intervention idea is the best`),
      }),
      intervention: z
        .string()
        .describe(
          `An expansion of the best intervention idea. This should be a 2-3 sentences long description of how to concretely implement the intervention. Should not have any special formatting or markdown.`
        ),
    }),
  })
    .then((response) => {
      console.log(`Intervention generated: ${JSON.stringify(response)}`)
      return response
    })
    .then((response) => response.intervention)
}

async function generateApplicationOfValue(context: string, policies: string[]) {
  const question = `How could one best support a Christian girl considering an abortion, when she is ${context.replace(
    "When ",
    ""
  )}?`

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
  })
    .then((response) => {
      console.log(`Application of value generated: ${JSON.stringify(response)}`)
      return response
    })
    .then((response) => response.applicationOfValue)
}

async function analyzeDeliberation(deliberationId: number, questionId: number) {
  const contexts = await getContextsForDeliberation(deliberationId, questionId)

  for (const context of contexts) {
    console.log(`\n=== Processing Context: ${context.id} ===\n`)

    const values = await getValuesForDeliberation(deliberationId, questionId)
    const edges = await getEdgesForContext(
      deliberationId,
      questionId,
      context.id
    )

    console.log(`Found ${values.length} values and ${edges.length} edges`)

    const graph = await summarizeGraph(values, edges, { includePageRank: true })
    console.log(
      `Graph processed with ${graph.values.length} values and ${graph.edges.length} edges`
    )

    if (graph.values?.length > 0) {
      const sortedValues = [...graph.values].sort(
        (a, b) => (b.pageRank ?? -Infinity) - (a.pageRank ?? -Infinity)
      )

      printTopValues(sortedValues)

      const winningValue = sortedValues[0]
      console.log("\nHighest ranked value details:", winningValue)

      // Check for existing intervention
      const existingIntervention = await db.intervention.findFirst({
        where: {
          contextId: context.id,
          questionId,
          deliberationId,
        },
      })

      // Generate value applications regardless of intervention existence
      for (const value of graph.values) {
        value.description = await generateApplicationOfValue(
          context.id,
          value.policies
        )

        console.log(`\nApplication of Value: ${value.description}`)
      }

      // Only generate new intervention if one doesn't exist
      const interventionText = existingIntervention
        ? existingIntervention.text
        : await generateIntervention(context.id, winningValue)

      // Upsert the intervention with updated graph
      await db.intervention.upsert({
        where: {
          contextId_questionId_deliberationId: {
            contextId: context.id,
            questionId,
            deliberationId,
          },
        },
        create: {
          text: interventionText,
          contextId: context.id,
          graph: JSON.parse(JSON.stringify(graph)),
          questionId,
          deliberationId,
        },
        update: {
          graph: JSON.parse(JSON.stringify(graph)),
        },
      })

      console.log(`\nSuggested Intervention: ${interventionText}`)
      console.log("\n=== Context Processed ===")
    } else {
      console.log("No values available in the graph.")
    }
  }
}

// Example usage
console.log("Analyzing deliberation...")
await analyzeDeliberation(33, 60)
