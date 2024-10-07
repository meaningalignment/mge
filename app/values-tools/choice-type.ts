import { z } from "zod"
import { genObj } from "./ai"

export async function generateChoiceTypes(question: string) {
  return await genObj({
    prompt: `You will be given a question. Your task is to reason about what factors might be present that are not made implicit, that would change the way one would deal with the question if they were made explicit.
    
    Return a list of 5-10 such factors that would be relevant to consider in answering the question.
    
    For example, if the question is "I am a christian girl and am considering an abortion, what should I do?", the factors might be "The girl is in distress", "The girl is seeking guidance", "The girl is considering her options", etc.`,
    data: { Question: question },
    schema: z.object({
      factors: z
        .array(
          z.object({
            situationalContext: z
              .string()
              .describe(
                `Describe in 1-2 sentences an imaginary aspect of the situation that is not explicitly mentioned in the question, but could be happening behind the scenes, and that if made explicit, would change the values one should approach the question with.`
              ),
            factor: z
              .string()
              .describe(
                `The factor from the situational context, in as few words as possible. For example, "The girl is in distress".`
              ),
            questionWithFactor: z
              .string()
              .describe(
                `A modified version of the original question, where the factor is made explicit. For example: "I am a christian girl in severe distress and am considering an abortion, what should I do?"`
              ),
          })
        )
        .describe(
          `5-10 factors that are not explicit, that would be relevant to consider in answering the question.`
        ),
    }),
  }).then((res) => res.factors)
}
