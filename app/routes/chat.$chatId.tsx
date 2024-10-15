import { LoaderFunctionArgs, redirect } from "@remix-run/node"
import { db } from "~/config.server"

export async function loader({ params }: LoaderFunctionArgs) {
  const chatId = params.chatId!
  const chat = await db.chat.findFirst({ where: { id: chatId } })
  const questionId =
    chat?.questionId ??
    (await db.question.findFirst({ orderBy: { id: "asc" } }))!.id
  return redirect(`/case/${questionId}/chat/${chatId}`)
}
