import {
  generateQuestions,
  generateContexts,
} from "../app/services/generate-questions"

async function generateQuestionsAndContexts(topic: string) {
  try {
    const questions = await generateQuestions(topic, 1)

    for (const question of questions) {
      console.log(`Question: ${question}`)
      const contexts = await generateContexts(question, 2)
      console.log("Contexts:")
      contexts.forEach((context) => console.log(context))
    }
  } catch (error) {
    console.error("An error occurred:", error)
  }
}

const topic = "How should the SF government treat homeless people?"
generateQuestionsAndContexts(topic)
