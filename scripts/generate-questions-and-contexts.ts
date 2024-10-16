import { generateQuestions, generateContexts } from "../app/services/questions"

async function generateQuestionsAndContexts(topic: string) {
  try {
    // Generate questions
    const { questions } = await generateQuestions(topic, 1)

    // Process each question
    for (const question of questions) {
      console.log(`Question: ${question}`)

      // Generate contexts for each question
      const contexts = await generateContexts(question, 2)

      console.log("Contexts:")
      contexts.forEach((context, index) => {
        console.log(`  ${index + 1}. Factor: ${context.factor}`)
        console.log(
          `  ${index + 1}. Generalized Factor: ${context.generalizedFactor}`
        )
        console.log(`     Situational Context: ${context.situationalContext}`)
      })

      console.log("\n---\n")
    }
  } catch (error) {
    console.error("An error occurred:", error)
  }
}

// Example usage
const topic = "How should the SF government treat homeless people?"
generateQuestionsAndContexts(topic)
