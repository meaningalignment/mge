import { db } from "~/config.server"
import { contextDisplayName } from "~/lib/utils"
import { findPrecedence } from "~/services/interventions"

const intervention = await db.intervention.findMany({
  where: {
    questionId: 60,
    deliberationId: 33,
  },
})

for (const i of intervention) {
  const precedence = await findPrecedence(
    `How could US abortion policy support christian girls considering abortion? Especially when ${contextDisplayName(
      i.contextId
    )}?`,
    i.text
  )

  if (!precedence) continue

  console.log(`Precedence found: ${JSON.stringify(precedence, null, 2)}`)

  await db.interventionPrecedence.create({
    data: {
      interventionId: i.id,
      description: precedence.description,
      link: precedence.citation,
    },
  })
}
