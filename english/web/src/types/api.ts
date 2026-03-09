export interface ProgressStats {
  words: { new: number; learning: number; known: number }
  grammar: { new: number; learning: number; known: number }
}

export interface WeakSpot {
  id: number
  name: string
  translation?: string
  description?: string
  type: 'vocabulary' | 'grammar'
  failRate: number
  totalReviews: number
}

export interface DayActivity {
  date: string // YYYY-MM-DD
  reviews: number
  additions: number
}

export interface ClusterStats {
  cluster: string
  total: number
  new: number
  learning: number
  known: number
}
