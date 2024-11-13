import { serve } from "inngest/remix"
import { deduplicateCron, deduplicate } from "~/services/deduplication"
import { embedCards, embedContext, embedContexts } from "~/services/embedding"
import { inngest } from "~/config.server"
import { hypothesize, hypothesizeCron } from "~/services/linking"
import {
  generateSeedQuestionsAndContexts,
  generateSeedContexts,
  generateSeedGraph,
} from "~/services/generation"
import { findNewContexts } from "~/services/contexts"

const handler = serve(inngest, [
  embedCards,
  embedContexts,
  hypothesize,
  hypothesizeCron,
  deduplicate,
  deduplicateCron,
  generateSeedQuestionsAndContexts,
  generateSeedContexts,
  generateSeedGraph,
  findNewContexts,
])

export const config = {
  maxDuration: 300,
}

export { handler as loader, handler as action }
