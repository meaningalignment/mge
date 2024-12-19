import { drawFreceny } from "~/services/hypothesis-selection"

async function drawAndDisplayValues() {
  try {
    // Get values using getDrawFrecency
    const values = await drawFreceny(33, 6)

    console.log("Drew values:\n")

    // Display each value with formatting
    values.forEach((value, index) => {
      console.log(`Value ${index + 1}:`)
      console.log(`From: ${value.from.id}`)
      console.log(`To: ${value.to.id}`)
      console.log(`Context: ${value.contextId}`)
      console.log(`Hypothesis Run: ${value.hypothesisRunId}`)
      console.log(`Reason:`)
      console.log(`  - Total Votes: ${value.reason.totalVotes}`)
      console.log(`  - Total Agrees: ${value.reason.totalAgrees}`)
      console.log(`  - Selected Due To: ${value.reason.selecedDueTo}`)
      console.log("---\n")
    })
  } catch (error) {
    console.error("Error drawing values:", error)
  }
}

// Run the function
drawAndDisplayValues()
