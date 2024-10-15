import { serve } from "inngest/remix"
import { deduplicate } from "~/services/deduplication"
import { embed } from "~/services/embedding"
import { inngest } from "~/config.server"
import { hypothesize, hypothesize_cron } from "~/services/linking"
// import { evaluateDialogues } from "~/values-tools/rater"

const handler = serve(inngest, [
  embed,
  hypothesize,
  hypothesize_cron,
  // evaluateDialogues,
  deduplicate,
])

export const config = {
  maxDuration: 300,
}

export { handler as loader, handler as action }
