import { describe, it, expect } from "vitest"
import {
  parseScenarioGenerationData,
  getRepresentativeContexts,
} from "./scenario-generation"
import mockScenarioData from "~/lib/homeless-data.json"

describe("Scenario Generation", () => {
  // Basic functionality tests
  it("should generate valid contexts", () => {
    const data = parseScenarioGenerationData(mockScenarioData)!
    const result = getRepresentativeContexts(data)

    expect(result.length).toBeGreaterThan(0)
    expect(result.every((ctx) => typeof ctx === "string")).toBe(true)
  })

  // Statistical tests
  describe("probability distributions", () => {
    const SAMPLE_SIZE = 100
    const VARIANCE = 0.25 // 25% variance allowed

    it("should roughly match age distribution over many samples", () => {
      const data = parseScenarioGenerationData(mockScenarioData)!
      const samples = Array(SAMPLE_SIZE)
        .fill(null)
        .map(() => getRepresentativeContexts(data))

      // Count age occurrences
      const ageDistribution = samples.reduce((acc, ctx) => {
        const ageContext = ctx.find((ctx) => ctx.includes("years old"))
        if (ageContext) {
          acc[ageContext] = (acc[ageContext] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)

      // Check if 35-44 age group (27% probability) appears reasonably often
      const age3544Count =
        ageDistribution["When a person is 35-44 years old"] || 0
      const age3544Percentage = age3544Count / SAMPLE_SIZE
      const expectedRate = 0.27

      expect(age3544Percentage).toBeGreaterThan(expectedRate - VARIANCE) // 27% - 25%
      expect(age3544Percentage).toBeLessThan(expectedRate + VARIANCE) // 27% + 25%
    })

    it("should include health conditions at expected rate", () => {
      const data = parseScenarioGenerationData(mockScenarioData)!
      const samples = Array(SAMPLE_SIZE)
        .fill(null)
        .map(() => getRepresentativeContexts(data))

      // Count scenarios with any health condition
      const scenariosWithHealth = samples.filter((ctx) =>
        ctx.some(
          (ctx) =>
            ctx.includes("psychiatric") ||
            ctx.includes("drug") ||
            ctx.includes("chronic health") ||
            ctx.includes("physical disability")
        )
      ).length

      const healthPercentage = scenariosWithHealth / SAMPLE_SIZE
      const expectedRate = 0.67

      expect(healthPercentage).toBeGreaterThan(expectedRate - VARIANCE) // 67% - 25%
      expect(healthPercentage).toBeLessThan(expectedRate + VARIANCE) // 67% + 25%
    })

    it("should include LGBTQ+ representation at expected rate", () => {
      const data = parseScenarioGenerationData(mockScenarioData)!
      const samples = Array(SAMPLE_SIZE)
        .fill(null)
        .map(() => getRepresentativeContexts(data))

      const lgbtqCount = samples.filter((ctx) =>
        ctx.some((ctx) => ctx.includes("LGBTQ+"))
      ).length

      const lgbtqPercentage = lgbtqCount / SAMPLE_SIZE
      const expectedRate = 0.28

      expect(lgbtqPercentage).toBeGreaterThan(expectedRate - VARIANCE) // 28% - 25%
      expect(lgbtqPercentage).toBeLessThan(expectedRate + VARIANCE) // 28% + 25%
    })
  })
})
