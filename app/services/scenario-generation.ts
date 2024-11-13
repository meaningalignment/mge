import { genObj } from "values-tools"
import { z } from "zod"

export const schema = z.object({
  metadata: z.object({
    title: z.string(),
    description: z.string().optional(),
    version: z.string().optional(),
  }),
  categories: z.record(
    z.string(),
    z.object({
      type: z.enum(["single_select", "multi_select"]),
      probability: z.number().min(0).max(1).optional(),
      options: z.array(
        z.object({
          text: z.string(),
          probability: z.number().min(0).max(1),
          description: z.string().optional(),
          conditions: z
            .array(
              z.object({
                when: z.record(z.string(), z.string()),
                probability: z.number().min(0).max(1),
              })
            )
            .optional(),
        })
      ),
    })
  ),
})

export type ScenarioGenerationSchema = z.infer<typeof schema>

export function parseScenarioGenerationData(
  data: unknown
): ScenarioGenerationSchema | null {
  try {
    return schema.parse(data)
  } catch (error) {
    console.error(error)
    return null
  }
}

export function allContexts(data: ScenarioGenerationSchema): string[] {
  return [
    ...new Set(
      Object.values(data.categories).flatMap((category) =>
        category.options.map((option) => option.text)
      )
    ),
  ]
}

function representativeContexts(data: ScenarioGenerationSchema): string[] {
  const selected: string[] = []

  for (const category of Object.values(data.categories)) {
    // Skip if category probability check fails
    if (category.probability && Math.random() > category.probability) continue

    const candidates =
      category.type === "single_select"
        ? [selectRandomOption(category.options)]
        : category.options

    for (const option of candidates) {
      const probability = getEffectiveProbability(option, selected)
      if (Math.random() <= probability) {
        selected.push(option.text)
      }
    }
  }

  return selected
}

function getEffectiveProbability(
  option: ScenarioGenerationSchema["categories"][string]["options"][number],
  selectedTexts: string[]
): number {
  if (!option.conditions) return option.probability

  const matchingCondition = option.conditions.find((condition) =>
    Object.entries(condition.when).every(([_, text]) =>
      selectedTexts.includes(text)
    )
  )

  return matchingCondition?.probability ?? option.probability
}

function selectRandomOption<T extends { probability: number }>(
  options: T[]
): T {
  const roll =
    Math.random() * options.reduce((sum, opt) => sum + opt.probability, 0)
  let sum = 0
  return options.find((opt) => (sum += opt.probability) >= roll) ?? options[0]
}

export async function generateScenario(
  schema: ScenarioGenerationSchema
): Promise<{ story: string; title: string; contexts: string[] }> {
  const contexts = representativeContexts(schema)

  console.log("Contexts:", contexts)

  const result = await genObj({
    prompt: `You will be given a few strings that describes the situation a homeless person is finding themselves in. Your task is to generate a story depicting someone in that situation.`,
    data: { contexts },
    schema: z.object({
      story: z
        .string()
        .describe(
          `A brief personal story (2-3 sentences) depicting a specific scenario related to the topic, followed by a question about how to address the situation. The questions should be values-laden and focus on how to best support or address the situations described.`
        ),
      title: z
        .string()
        .describe(`A short 2-5 word title that summarizes the question.`),
    }),
  })

  return {
    ...result,
    contexts,
  }
}
