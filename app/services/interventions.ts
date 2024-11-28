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
      id: "When in distress",
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
    prompt: `
You will be given a values card made up of attention policies, and a question. Your task is to generate a suggested action or intervention that is in line with the way of life expressed in the policies.

# Note
The values card given to you was articulated in response to how ChatGPT should behave, not directly in response to the question. So you'll have to first understand the value behind how ChatGPT should act specifically, as dictated by the value, and then ideate on how to apply that value to the question at hand.
    
# Attention Policies
A values card is made up of several attention policies. Attention policies list what a person pays attention to when they do a kind of discernment about how to act in a certain situation. However, they only specify what is meaningful to pay attention to – that is, something that is consitutively good, in their view – as opposed to instrumental to some other meaningful goal.

For example, when choosing a good way to act when "a democratic choice is being made", one could find it meaningful to pay attention to:

["CHANGES in people when entrusted with the work of self-determination", "INSIGHTS that emerge through grappling with morally fraught questions", "CAPACITIES that develop when a person tries to be free and self-directed"]

Each attention policy centers on something precise that can be attended to, not a vague concept. Instead of abstractions like "LOVE and OPENNESS which emerges", it might say "FEELINGS in my chest that go along with love and openness." Instead of “DEEP UNDERSTANDING of the emotions”, it might say “A SENSE OF PEACE that comes from understanding”. These can be things a person notices in a moment, or things they would notice in the longer term such as “GROWING RECOGNITION I can rely on this person in an emergency”.


`,
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

      const intervention = await generateIntervention(context.id, winningValue)

      console.log(`\nSuggested Intervention: ${intervention}`)
    } else {
      console.log("No values available in the graph.")
    }
  }
}

// Example usage
analyzeDeliberation(33, 60)
