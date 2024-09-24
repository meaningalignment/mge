export interface MoralGraphSummary {
  values: Value[]
  edges: EdgeStats[]
}

export interface Value {
  id: number
  title: string
  description: string
  policies: string[]
  pageRank?: number
  votes?: number
}

export interface EdgeStats {
  sourceValueId: number
  wiserValueId: number
  contexts: string[]
  counts: {
    markedWiser: number
    markedNotWiser: number
    markedLessWise: number
    markedUnsure: number
    impressions: number
  }
  summary: {
    wiserLikelihood: number
    entropy: number
  }
}
