import { json } from "@remix-run/node"
import { useFetcher } from "@remix-run/react"
import LoadingButton from "~/components/loading-button"

import scenarioData from "~/lib/homeless-data.json"
import {
  generateScenario,
  parseScenarioGenerationData,
} from "~/services/scenario-generation"

export async function action() {
  const parsedData = parseScenarioGenerationData(scenarioData)!
  const result = await generateScenario(parsedData)
  return json(result)
}

export default function ScenarioGenerator() {
  const fetcher = useFetcher<typeof action>()
  const isLoading = fetcher.state !== "idle"

  const handleGenerate = () => {
    fetcher.submit({}, { method: "post" })
  }

  return (
    <div className="container mx-auto p-4 min-h-screen flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Scenario Generator
        </h1>

        <div className="flex justify-center">
          <LoadingButton onClick={handleGenerate} disabled={isLoading}>
            Generate Scenario
          </LoadingButton>
        </div>

        {fetcher?.data?.story && (
          <div className="mt-6 space-y-4">
            <div className="p-4 border rounded-lg bg-gray-50 shadow-sm">
              <p>{fetcher.data.story}</p>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-medium">Contexts</h2>
              <div className="flex flex-wrap gap-2">
                {fetcher.data.contexts.map((context, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-gray-100 text-gray-800 border border-gray-200 shadow-sm"
                  >
                    {context}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
