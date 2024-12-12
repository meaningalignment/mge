import { useLoaderData, useParams } from "@remix-run/react"
import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { auth, db } from "~/config.server"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Switch } from "~/components/ui/switch"
import { Badge } from "~/components/ui/badge"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Separator } from "~/components/ui/separator"
import { AlertCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { useFetcher } from "@remix-run/react"

export async function loader({ params, request }: LoaderFunctionArgs) {
  const user = await auth.getCurrentUser(request)
  if (!user?.isAdmin) throw new Response("Unauthorized", { status: 403 })

  const interventions = await db.intervention.findMany({
    where: {
      deliberationId: Number(params.deliberationId),
    },
    include: {
      question: true,
      context: true,
      InterventionPrecedence: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return json({ interventions })
}

export async function action({ request }: LoaderFunctionArgs) {
  const user = await auth.getCurrentUser(request)
  if (!user?.isAdmin) throw new Response("Unauthorized", { status: 403 })

  const formData = await request.formData()
  const { _action, interventionId } = Object.fromEntries(formData)

  if (_action === "toggleDisplay") {
    const intervention = await db.intervention.findUnique({
      where: { id: Number(interventionId) },
    })

    await db.intervention.update({
      where: { id: Number(interventionId) },
      data: { shouldDisplay: !intervention?.shouldDisplay },
    })
  }

  if (_action === "delete") {
    await db.intervention.delete({
      where: { id: Number(interventionId) },
    })
  }

  return json({ success: true })
}

export default function Report() {
  const { interventions } = useLoaderData<typeof loader>()
  const fetcher = useFetcher()
  const { deliberationId } = useParams()

  const handleToggleDisplay = (interventionId: number) => {
    const formData = new FormData()
    formData.append("_action", "toggleDisplay")
    formData.append("interventionId", interventionId.toString())
    fetcher.submit(formData, { method: "POST" })
  }

  const handleDelete = (interventionId: number) => {
    if (!confirm("Are you sure you want to delete this intervention?")) return
    const formData = new FormData()
    formData.append("_action", "delete")
    formData.append("interventionId", interventionId.toString())
    fetcher.submit(formData, { method: "POST" })
  }

  if (interventions.length === 0) {
    return (
      <Alert className="mt-6 mb-4 bg-slate-50">
        <div className="flex flex-row space-x-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No interventions yet</AlertTitle>
        </div>
        <AlertDescription>
          Interventions will appear here once they are generated.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Interventions</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {interventions.map((intervention) => (
                <Card key={intervention.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <CardTitle className="text-base mb-3">
                          {intervention.question.title}
                        </CardTitle>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant="outline">
                            {intervention.context.id}
                          </Badge>
                          {intervention.InterventionPrecedence.length > 0 && (
                            <Badge variant="secondary">
                              {intervention.InterventionPrecedence.length}{" "}
                              precedents
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-slate-500">
                            Display in report
                          </span>
                          <Switch
                            checked={intervention.shouldDisplay}
                            onCheckedChange={() =>
                              handleToggleDisplay(intervention.id)
                            }
                          />
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(intervention.id)}
                          disabled={fetcher.state !== "idle"}
                        >
                          {fetcher.state !== "idle" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Delete"
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600">
                      {intervention.text}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
