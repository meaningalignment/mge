import { serve } from "inngest/remix"
import { deduplicateCron, deduplicate } from "~/services/deduplication"
import { embed } from "~/services/embedding"
import { inngest } from "~/config.server"
import { hypothesize, hypothesizeCron } from "~/services/linking"
import {
  generateSeedGraph as genGraph,
  generateSeedQuestionsAndContexts as genQuestionsAndContexts,
} from "~/services/generation"

const handler = serve(inngest, [
  embed,
  hypothesize,
  hypothesizeCron,
  deduplicate,
  deduplicateCron,
  genQuestionsAndContexts,
  genGraph,
])

export const config = {
  maxDuration: 300,
}

export { handler as loader, handler as action }
