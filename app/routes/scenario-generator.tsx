import { json } from "@remix-run/node"
import { useFetcher, useLoaderData } from "@remix-run/react"
import { Button } from "~/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent } from "~/components/ui/card"
import { Loader2, X } from "lucide-react"

import scenarioData from "~/lib/homeless-data.json"
import {
  allContexts,
  generateScenario,
  parseScenarioGenerationData,
} from "~/services/scenario-generation"
import { useState } from "react"

export async function action({ request }: { request: Request }) {
  const formData = await request.formData()
  const selectedContexts = formData.get("contexts")?.toString().split(",")

  const parsedData = parseScenarioGenerationData(scenarioData)!
  const result = await generateScenario(parsedData, selectedContexts)
  return json(result)
}

export async function loader() {
  const data = parseScenarioGenerationData(scenarioData)!
  const contexts = allContexts(data)
  return json({ contexts })
}

export default function ScenarioGenerator() {
  const { contexts } = useLoaderData<typeof loader>()
  const fetcher = useFetcher<typeof action>()
  const isLoading = fetcher.state !== "idle"
  const [selectedContexts, setSelectedContexts] = useState<string[]>([])

  const handleRepresentativeGenerate = () => {
    fetcher.submit({ method: "representative" }, { method: "post" })
  }

  const handleCustomGenerate = () => {
    if (selectedContexts.length === 0) return
    fetcher.submit(
      {
        method: "custom",
        contexts: selectedContexts.join(","),
      },
      { method: "post" }
    )
  }

  return (
    <div className="container mx-auto p-8 min-h-screen flex flex-col items-center justify-center">
      <div className="max-w-sm w-full space-y-8">
        <h1 className="text-3xl font-bold text-center">Scenario Generator</h1>

        <Tabs defaultValue="representative" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="representative">Representative</TabsTrigger>
            <TabsTrigger value="custom">Custom Scenario</TabsTrigger>
          </TabsList>

          <TabsContent value="representative" className="space-y-6">
            <p className="text-muted-foreground text-center mt-4">
              Generate a scenario from contexts selected to be representative of
              San Fransisco's homeless population.
            </p>
            <div className="flex justify-center">
              <Button
                onClick={handleRepresentativeGenerate}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Scenario"
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="custom" className="space-y-6">
            <p className="text-muted-foreground text-center mt-4">
              Select specific contexts to generate a customized scenario.
            </p>
            <Select
              onValueChange={(value) => {
                if (!selectedContexts.includes(value)) {
                  setSelectedContexts((prev) => [...prev, value])
                }
              }}
              value=""
            >
              <SelectTrigger>
                <SelectValue placeholder="Add context..." />
              </SelectTrigger>
              <SelectContent>
                {contexts
                  .filter((context) => !selectedContexts.includes(context))
                  .map((context) => (
                    <SelectItem key={context} value={context}>
                      {context}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <div className="space-y-2">
              {selectedContexts.length > 0 && (
                <h2 className="text-lg font-medium">Contexts</h2>
              )}
              <div className="flex flex-wrap gap-2">
                {selectedContexts.map((context, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="px-3 py-1 hover:bg-secondary/80 transition-colors"
                    onClick={() =>
                      setSelectedContexts((prev) =>
                        prev.filter((c) => c !== context)
                      )
                    }
                  >
                    {context}
                    <X className="ml-2 h-3 w-3 hover:text-destructive" />
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                onClick={handleCustomGenerate}
                disabled={isLoading || selectedContexts.length === 0}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Scenario"
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {fetcher?.data?.story && (
          <Card className="mt-6">
            <CardContent className="p-6 space-y-6">
              <p className="text-base text-muted-foreground">
                {fetcher.data.story}
              </p>

              <div className="space-y-3">
                <h2 className="text-lg font-medium">Contexts</h2>
                <div className="flex flex-wrap gap-2">
                  {fetcher.data.contexts.map((context, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="px-3 py-1"
                    >
                      {context}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
