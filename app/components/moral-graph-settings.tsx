import React, { useState } from "react"
import { Button } from "~/components/ui/button"
import { Label } from "~/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { Checkbox } from "~/components/ui/checkbox"

export type GraphSettings = {
  questions: { id: number; text: string }[]
  questionId: number | null
  visualizeEdgeCertainty: boolean
  visualizeWisdomScore: boolean
}

export const defaultGraphSettings: GraphSettings = {
  questions: [],
  questionId: null,
  visualizeEdgeCertainty: true,
  visualizeWisdomScore: true,
}

export default function MoralGraphSettings({
  initialSettings,
  onUpdateSettings,
}: {
  initialSettings: GraphSettings
  onUpdateSettings: (newSettings: GraphSettings) => void
}) {
  const [settings, setSettings] = useState<GraphSettings>(initialSettings)
  const selectedQuestion = settings.questions?.find(
    (q) => q.id === settings.questionId
  )

  console.log(settings)
  return (
    <div className="flex h-full flex-col overflow-y-auto border-l-2 bg-white px-6 py-8">
      <h2 className="text-lg font-bold mb-6">Graph Settings</h2>

      {/* Case Dropdown */}
      <div className="mb-2">
        <Label htmlFor="run">Question</Label>
        <Select
          onValueChange={(value: any) => {
            setSettings({
              ...settings,
              questionId: value !== "all" ? Number(value) : null,
            })
          }}
        >
          <SelectTrigger id="run">
            <SelectValue
              placeholder={selectedQuestion?.text ?? "All Questions"}
            />
          </SelectTrigger>
          <SelectContent defaultValue={selectedQuestion?.text ?? "all"}>
            <SelectItem value="all">All Questions</SelectItem>
            {settings.questions.map((q) => (
              <SelectItem value={q.id.toString()}>{q.text}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {settings.questionId ? (
        <p className="text-xs text-gray-400 mb-4">
          Show values articulated when users were asked:
          <br />
          <br />
          <strong>{selectedQuestion?.text ?? "All Questions"}</strong>
        </p>
      ) : (
        <p className="text-xs text-gray-400 mb-4">
          Show values for all questions.
        </p>
      )}

      {/* Checkboxes */}
      <div className="flex items-center space-x-2 mb-2 mt-4">
        <Checkbox
          id="edge"
          checked={settings.visualizeEdgeCertainty}
          onCheckedChange={(c: any) => {
            setSettings({ ...settings, visualizeEdgeCertainty: c })
          }}
        />
        <label
          htmlFor="edge"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Visualize Edge Certainty
        </label>
      </div>
      <p className="text-xs text-gray-400 mb-6">
        Edge certainty is the likelihood participants agree on a wisdom upgrade.
        Visualized as the thickness of the edges.
      </p>

      <div className="flex items-center space-x-2 mb-2">
        <Checkbox
          id="node"
          checked={settings.visualizeWisdomScore}
          onCheckedChange={(c: any) => {
            setSettings({ ...settings, visualizeWisdomScore: c })
          }}
        />
        <label
          htmlFor="node"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Visualize Wisdom Score
        </label>
      </div>
      <p className="text-xs text-gray-400 mb-6">
        The wisdom score for a value is the sum of the certainty of all incoming
        edges. Visualized as the blueness of the nodes.
      </p>

      <Button
        disabled={initialSettings === settings}
        className="mt-4"
        onClick={() => {
          onUpdateSettings(settings)
        }}
      >
        Update Graph
      </Button>
      <div className="flex-grow" />
      <div className="flex flex-row">
        <div className="flex-grow" />
        <a href="https://meaningalignment.org" className="text-xs underline">
          Learn More
        </a>
      </div>
    </div>
  )
}
