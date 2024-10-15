import { LoaderFunctionArgs, redirect } from "@remix-run/node"
import { ensureLoggedIn, openai } from "~/config.server"

export async function loader({ request, params }: LoaderFunctionArgs) {
  await ensureLoggedIn(request)
  const { deliberationId, questionId } = params
  const threadId = (await openai.beta.threads.create({})).id
  return redirect(`/deliberation/${deliberationId}/${questionId}/chat/${threadId}`)
}
