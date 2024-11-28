import { PrismaClient } from "@prisma/client"
import * as fs from "fs/promises"
import { UserIcon } from "lucide-react"
import * as path from "path"

const prisma = new PrismaClient()

async function loadJsonFile(filename: string) {
  const filePath = path.join(__dirname, "..", "dft-data", filename)
  const data = await fs.readFile(filePath, "utf-8")
  return JSON.parse(data)
}

async function createDeliberation(userId: number) {
  return prisma.deliberation.create({
    data: {
      title: "OpenAI Democratic Fine-Tuning",
      topic: "How should ChatGPT behave in tricky situations?",
      createdBy: userId,
      setupStatus: "ready",
    },
  })
}

// Store old ID to new ID mappings
const idMaps = {
  users: new Map<number, number>([
    [1, 1],
    [2, 2],
    [849, 3],
  ]),
  canonicalValuesCards: new Map<number, number>(),
  valuesCards: new Map<number, number>(),
  questions: new Map<string, number>(),
  contexts: new Map<string, string>(),
  chats: new Map<string, string>(),
}

async function importUsers() {
  const users = await loadJsonFile("user.json")

  // Fetch all existing users at once
  const existingUsers = await prisma.user.findMany({
    select: { id: true, email: true },
  })
  const emailToId = new Map(existingUsers.map((u) => [u.email, u.id]))

  for (const user of users) {
    const existingId = emailToId.get(user.email)

    if (existingId) {
      console.log("User already exists, skipping:", user.email)
      idMaps.users.set(user.id, existingId)
      continue
    }

    console.log("New user:", user.email)

    const newUser = await prisma.user.create({
      data: {
        email: user.email,
        name: user.name,
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt),
        role: user.role,
        isAdmin: user.isAdmin,
      },
    })
    idMaps.users.set(user.id, newUser.id)
  }
}

async function importCanonicalValuesCards(deliberationId: number) {
  const cards = await loadJsonFile("canonicalValuesCard.json")

  // Fetch all existing cards at once
  const existingCards = await prisma.canonicalValuesCard.findMany({
    where: {
      deliberationId: deliberationId,
    },
  })

  const findMatchingCard = (newCard: any) => {
    return existingCards.find(
      (existingCard) =>
        existingCard.title === newCard.title &&
        existingCard.description === newCard.instructionsDetailed
    )
  }

  for (const card of cards) {
    const matchingCard = findMatchingCard(card)

    if (matchingCard) {
      console.log("Canonical values card already exists, skipping:", card.title)
      idMaps.canonicalValuesCards.set(card.id, matchingCard.id)
      continue
    }

    console.log("New canonical values card:", card.title)

    const newCard = await prisma.canonicalValuesCard.create({
      data: {
        title: card.title,
        description: card.instructionsDetailed,
        policies: card.evaluationCriteria,
        createdAt: new Date(card.createdAt),
        updatedAt: new Date(card.updatedAt),
        deliberationId: deliberationId,
      },
    })
    idMaps.canonicalValuesCards.set(card.id, newCard.id)
  }
}

async function importCases(deliberationId: number) {
  const cases = await loadJsonFile("cases.json")

  // Fetch existing questions for this deliberation
  const existingQuestions = await prisma.question.findMany({
    where: { deliberationId: deliberationId },
    select: { id: true, question: true },
  })
  const questionToId = new Map(existingQuestions.map((q) => [q.question, q.id]))

  for (const caseData of cases) {
    const existingId = questionToId.get(caseData.question)

    if (existingId) {
      console.log("Question already exists, skipping:", caseData.title)
      idMaps.questions.set(caseData.id, existingId)
      continue
    }

    const newQuestion = await prisma.question.create({
      data: {
        question: caseData.question,
        title: caseData.title,
        seedMessage: caseData.seedMessage,
        deliberationId: deliberationId,
      },
    })
    idMaps.questions.set(caseData.id, newQuestion.id)
  }
}

async function importChats(deliberationId: number) {
  const chats = await loadJsonFile("chat.json")

  // Fetch all existing chats for this deliberation
  const existingChats = await prisma.chat.findMany({
    where: { deliberationId: deliberationId },
    select: { id: true, userId: true },
  })
  const existingChatIds = new Set(existingChats.map((c) => c.id))

  for (const chat of chats) {
    if (existingChatIds.has(chat.id)) {
      console.log("Chat already exists, skipping:", chat.id)
      idMaps.chats.set(chat.id, chat.id)
      continue
    }

    console.log("Importing chat:", chat.id)
    console.log("For user:", idMaps.users.get(chat.userId))

    const newChat = await prisma.chat.create({
      data: {
        id: chat.id,
        user: { connect: { id: idMaps.users.get(chat.userId)! } },
        transcript: chat.transcript,
        evaluation: chat.evaluation,
        createdAt: new Date(chat.createdAt),
        updatedAt: new Date(chat.updatedAt),
        Question: { connect: { id: idMaps.questions.get(chat.caseId) } },
        deliberation: { connect: { id: deliberationId } },
      },
    })
    idMaps.chats.set(chat.id, newChat.id)
  }
}

async function importContexts(deliberationId: number) {
  const contexts = await loadJsonFile("context.json")

  // Fetch all existing contexts for this deliberation
  const existingContexts = await prisma.context.findMany({
    where: { deliberationId: deliberationId },
    select: { id: true },
  })
  const existingContextIds = new Set(existingContexts.map((c) => c.id))

  for (const context of contexts) {
    if (existingContextIds.has(context.id)) {
      console.log("Context already exists, skipping:", context.id)
      idMaps.contexts.set(context.id, context.id)
      continue
    }

    await prisma.context.create({
      data: {
        id: context.id,
        deliberationId: deliberationId,
      },
    })
    idMaps.contexts.set(context.id, context.id)
  }
}

async function importContextsForQuestions(deliberationId: number) {
  const contextCases = await loadJsonFile("contextsOnCases.json")

  // Fetch existing relationships
  const existingRelations = await prisma.contextsForQuestions.findMany({
    where: {
      deliberationId,
      questionId: { in: Array.from(idMaps.questions.values()) },
      contextId: { in: Array.from(idMaps.contexts.values()) },
    },
    select: { contextId: true, questionId: true, deliberationId: true },
  })

  const findMatchingRelation = (newRelation: any) => {
    return existingRelations.find(
      (existing) =>
        existing.contextId === idMaps.contexts.get(newRelation.contextId) &&
        existing.questionId === idMaps.questions.get(newRelation.caseId) &&
        existing.deliberationId === deliberationId
    )
  }

  for (const relation of contextCases) {
    const matchingRelation = findMatchingRelation(relation)

    if (matchingRelation) {
      console.log("Context-Question relation already exists, skipping")
      continue
    }

    console.log("New Context-Question relation")
    await prisma.contextsForQuestions.create({
      data: {
        contextId: idMaps.contexts.get(relation.contextId)!,
        questionId: idMaps.questions.get(relation.caseId)!,
        deliberationId: deliberationId,
      },
    })
  }
}

async function importValuesCards(deliberationId: number) {
  const cards = await loadJsonFile("valuesCard.json")

  // Fetch all existing values cards for this deliberation
  const existingCards = await prisma.valuesCard.findMany({
    where: { deliberationId: deliberationId },
    select: {
      id: true,
      title: true,
      policies: true,
      description: true,
      canonicalCardId: true,
      chatId: true,
      questionId: true,
    },
  })

  const findMatchingCard = (newCard: any) => {
    return existingCards.find(
      (existingCard) =>
        existingCard.title === newCard.title &&
        existingCard.description === newCard.instructionsShort &&
        existingCard.policies.join("") === newCard.evaluationCriteria.join("")
    )
  }

  for (const card of cards) {
    const matchingCard = findMatchingCard(card)

    if (matchingCard) {
      console.log("Values card already exists, skipping:", card.title)
      idMaps.valuesCards.set(card.id, matchingCard.id)
      continue
    }

    console.log("New values card:", card)
    console.log(existingCards.find((c: any) => c.title === card.title))
    throw new Error("stop")
    const newCard = await prisma.valuesCard.create({
      data: {
        title: card.title,
        description: card.instructionsShort,
        policies: card.evaluationCriteria,
        createdAt: new Date(card.createdAt),
        updatedAt: new Date(card.updatedAt),
        canonicalCardId: card.canonicalCardId
          ? idMaps.canonicalValuesCards.get(card.canonicalCardId)
          : undefined,
        chatId: card.chatId ? idMaps.chats.get(card.chatId) : undefined,
        questionId: card.questionId
          ? idMaps.questions.get(card.questionId)
          : undefined,
        deliberationId: deliberationId,
      },
    })
    idMaps.valuesCards.set(card.id, newCard.id)
  }
}

async function importEdges(deliberationId: number) {
  const edges = await loadJsonFile("edge.json")

  // Fetch all existing edges for this deliberation
  const existingEdges = await prisma.edge.findMany({
    where: { deliberationId: deliberationId },
    select: {
      userId: true,
      fromId: true,
      toId: true,
      contextId: true,
      story: true,
    },
  })

  const findMatchingEdge = (newEdge: any) => {
    return existingEdges.find(
      (existingEdge) =>
        existingEdge.userId === idMaps.users.get(newEdge.userId) &&
        existingEdge.fromId ===
          idMaps.canonicalValuesCards.get(newEdge.fromId) &&
        existingEdge.toId === idMaps.canonicalValuesCards.get(newEdge.toId) &&
        existingEdge.contextId === idMaps.contexts.get(newEdge.contextId) &&
        existingEdge.story === newEdge.story
    )
  }

  for (const edge of edges) {
    const matchingEdge = findMatchingEdge(edge)

    if (matchingEdge) {
      console.log("Edge already exists, skipping:", edge.story)
      continue
    }

    console.log("New edge:", edge.story)
    await prisma.edge.create({
      data: {
        userId: idMaps.users.get(edge.userId)!,
        fromId: idMaps.canonicalValuesCards.get(edge.fromId)!,
        toId: idMaps.canonicalValuesCards.get(edge.toId)!,
        story: edge.story,
        contextId: idMaps.contexts.get(edge.contextId)!,
        type: edge.type,
        comment: edge.comment,
        createdAt: new Date(edge.createdAt),
        updatedAt: new Date(edge.updatedAt),
        deliberationId: deliberationId,
      },
    })
  }
}

async function importEdgeHypotheses(deliberationId: number) {
  const hypotheses = await loadJsonFile("edgeHypothesis.json")

  // Fetch all existing edge hypotheses for this deliberation
  const existingHypotheses = await prisma.edgeHypothesis.findMany({
    where: { deliberationId: deliberationId },
    select: {
      fromId: true,
      toId: true,
      contextId: true,
      story: true,
      hypothesisRunId: true,
    },
  })

  const findMatchingHypothesis = (newHypothesis: any) => {
    return existingHypotheses.find(
      (existingHypothesis) =>
        existingHypothesis.fromId ===
          idMaps.canonicalValuesCards.get(newHypothesis.fromId) &&
        existingHypothesis.toId ===
          idMaps.canonicalValuesCards.get(newHypothesis.toId) &&
        existingHypothesis.contextId ===
          idMaps.contexts.get(newHypothesis.contextId) &&
        existingHypothesis.story === newHypothesis.story &&
        existingHypothesis.hypothesisRunId === newHypothesis.hypothesisRunId
    )
  }

  for (const hypothesis of hypotheses) {
    const matchingHypothesis = findMatchingHypothesis(hypothesis)

    if (matchingHypothesis) {
      console.log("Edge hypothesis already exists, skipping:", hypothesis.story)
      continue
    }

    console.log("New edge hypothesis:", hypothesis.story)
    await prisma.edgeHypothesis.create({
      data: {
        fromId: idMaps.canonicalValuesCards.get(hypothesis.fromId)!,
        toId: idMaps.canonicalValuesCards.get(hypothesis.toId)!,
        hypothesisRunId: hypothesis.hypothesisRunId,
        story: hypothesis.story,
        contextId: idMaps.contexts.get(hypothesis.contextId)!,
        createdAt: new Date(hypothesis.createdAt),
        updatedAt: new Date(hypothesis.updatedAt),
        deliberationId: deliberationId,
      },
    })
  }
}

async function main() {
  try {
    // Import users first
    await importUsers()
    console.log("Imported users")

    // // Create the deliberation with the first user
    // const deliberation = await createDeliberation(1)
    const deliberationId = 33
    // console.log("Created deliberation:", deliberation.id)

    // Import in order of dependencies
    await importCases(deliberationId)
    console.log("Imported cases/questions")

    await importCanonicalValuesCards(deliberationId)
    console.log("Imported canonical values cards")

    await importChats(deliberationId)
    console.log("Imported chats")

    await importContexts(deliberationId)
    console.log("Imported contexts")

    await importContextsForQuestions(deliberationId)
    console.log("Imported context-question relationships")

    await importValuesCards(deliberationId)
    console.log("Imported values cards")

    await importEdges(deliberationId)
    console.log("Imported edges")

    await importEdgeHypotheses(deliberationId)
    console.log("Imported edge hypotheses")

    console.log("Import completed successfully")
  } catch (error) {
    console.error("Import failed:", error)
  }
}

await main()
