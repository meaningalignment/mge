import {
  CanonicalValuesCard,
  Demographic,
  Edge,
  Intervention,
  User,
} from "@prisma/client"
import { genObj, summarizeGraph } from "values-tools"
import { db, perplexity } from "~/config.server"
import { z } from "zod"
import { MoralGraph, MoralGraphValue, Value } from "values-tools/src/types"
import { usPoliticalAffiliationSummarizer } from "values-tools/src/services/moral-graph"

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
      isExcluded: false,
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
  contextId: string,
  excludeUsersWithoutDemographics = false
) {
  const edges = await db.edge.findMany({
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
    include: {
      user: {
        select: {
          Demographic: true,
        },
      },
    },
  })

  return edges
    .map((edge: Edge & { user: { Demographic: Demographic | null } }) => {
      // Only include demographics instances where usPoliticalAffiliation is present
      const demographics = edge.user.Demographic?.usPoliticalAffiliation
        ? edge.user.Demographic
        : undefined

      return {
        ...edge,
        demographics,
      }
    })
    .filter((edge) => !excludeUsersWithoutDemographics || edge.demographics)
}

function printTopValues(values: any[], count = 5) {
  console.log(`\nTop ${count} values by PageRank:`)
  values.slice(0, count).forEach((value, index) => {
    console.log(
      `${index + 1}. "${value.title}" - PageRank: ${value.pageRank?.toFixed(3)}`
    )
  })
}

async function generateInterventionText(context: string, value: Value) {
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
        z.string().describe(`An intervention idea in a short sentence.`)
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
          `An expansion of the best intervention idea. This should be a short (1-2 sentences long) description of how to concretely implement the intervention. Should not have any special formatting or markdown.`
        ),
    }),
  })
    .then((response) => {
      console.log(`Intervention generated: ${JSON.stringify(response)}`)
      return response
    })
    .then((response) => response.intervention)
}

function getWinningValue(graph: MoralGraph): Value {
  const sortedValues = [...graph.values].sort(
    (a, b) => (b.pageRank ?? -Infinity) - (a.pageRank ?? -Infinity)
  )
  return sortedValues[0]
}

export async function updateInterventionText(intervention: Intervention) {
  const value = getWinningValue(intervention.graph as unknown as MoralGraph)
  const newText = await generateInterventionText(intervention.contextId, value)

  await db.intervention.update({
    where: {
      id: intervention.id,
    },
    data: { text: newText },
  })
}

export function getLastBracketNumber(text: string): number | null {
  const matches = text.match(/\[(\d+)\]/g)
  if (!matches) return null

  const lastMatch = matches[matches.length - 1]
  const number = parseInt(lastMatch.replace(/[\[\]]/g, ""))

  return number
}

export async function findPrecedence(question: string, intervention: string) {
  const prompt =
    `Search for real-world examples of policies, programs, or interventions similar to the one described below. Focus on government policies or established organizations in other countries. 

1. List specific programs/policies and reference the official sources or reputable news articles. 
2. Include the country, year implemented (if available), and a brief description of how it's similar. The description should always be 1-2 sentences long.
3. Determine which policy is most similar to the intervention described below.
4. For that policy, write out the description again, this time enclosed in <description></description> tags. Include a reference to the source article again.

# Question
${question}
    
# Intervention
${intervention}`.trim()

  console.log(prompt)

  const messages = [
    {
      role: "user" as const,
      content: prompt,
    },
  ]

  const res = await perplexity.chat.completions.create({
    model: "llama-3.1-sonar-large-128k-online",
    messages: messages,
    max_tokens: 1024,
    temperature: 0.2,
  })
  const text = res.choices[0].message.content!
  const descriptionMatch = text.match(/<description>(.*?)<\/description>/)
  const description = descriptionMatch ? descriptionMatch[1] : null
  const citations = (res as any).citations as string[]
  const citeIndex = getLastBracketNumber(text)
  const citation = citeIndex ? citations[citeIndex] : undefined
  if (!citation || !description) return null
  return { description, citation }
}

export async function generateInterventions(
  deliberationId: number,
  questionId: number,
  excludeUsersWithoutDemographics = false
) {
  const contexts = await getContextsForDeliberation(deliberationId, questionId)

  console.log("Processing contexts:", contexts)

  for (const context of contexts) {
    console.log(`\n=== Processing Context: ${context.id} ===\n`)

    const values = await getValuesForDeliberation(deliberationId, questionId)
    const edges = await getEdgesForContext(
      deliberationId,
      questionId,
      context.id,
      excludeUsersWithoutDemographics
    )

    console.log(`Found ${values.length} values and ${edges.length} edges`)

    const graph = await summarizeGraph(values, edges, {
      includePageRank: true,
      includeDemographics: true,
      demographicsSummarizer: usPoliticalAffiliationSummarizer,
    })

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

      const intervention = await generateInterventionText(
        context.id,
        winningValue
      )

      console.log(`\nSuggested Intervention: ${intervention}`)

      await db.intervention.create({
        data: {
          text: intervention,
          contextId: context.id,
          deliberationId,
          questionId,
          graph: JSON.parse(JSON.stringify(graph)),
        },
      })
    } else {
      console.log("No values available in the graph.")
    }
  }
}
