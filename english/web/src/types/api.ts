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

// Vocabulary page types

export interface VocabSense {
  id: number
  partOfSpeech: string
  translation: string | null
  familiarity: string
}

export interface VocabWord {
  id: number
  lemma: string
  cefrLevel: string | null
  thematicCluster: string | null
  createdAt: string
  senses: VocabSense[]
  srsState: string | null
  hasCard: boolean
}

export interface VocabularyListResponse {
  items: VocabWord[]
  total: number
  page: number
  limit: number
}

export interface VocabFilters {
  search: string
  familiarity: string
  cefrLevel: string
  cluster: string
  srsState: string
  sortBy: string
  sortOrder: string
}

export interface WordDetailSense {
  id: number
  partOfSpeech: string
  translation: string | null
  familiarity: string
  srsCard: { id: number; state: string; due: string; reps: number } | null
}

export interface WordCollocation {
  id: number
  text: string
  translation: string | null
  type: string
  cefrLevel: string | null
}

export interface WordFamilyMember {
  id: number
  lemma: string
  cefrLevel: string | null
}

export interface WordDetailResponse {
  id: number
  lemma: string
  cefrLevel: string | null
  thematicCluster: string | null
  createdAt: string
  senses: WordDetailSense[]
  collocations: WordCollocation[]
  wordFamily: WordFamilyMember[]
  sentences: Array<{ id: number; text: string }>
}

// Review types

export interface DueCard {
  cardId: number
  cardType: 'vocabulary' | 'grammar'
  state: string
  due: string
  word?: {
    lemma: string
    translation: string | null
    cefrLevel: string | null
    partOfSpeech: string | null
  }
  sentence?: string
  pattern?: { pattern: string; description: string }
  exercise?: {
    id: number
    sentence: string
    answer: string
    hint: string | null
    difficultyLevel: number
  }
}

export interface ReviewStats {
  total: number
  ratings: Record<1 | 2 | 3 | 4, number>
}
