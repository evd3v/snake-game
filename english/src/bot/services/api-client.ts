export interface WordInfo {
  id: number;
  lemma: string;
  translation: string | null;
  cefrLevel: string | null;
  familiarity: string | null;
  thematicCluster: string | null;
  partOfSpeech: string | null;
  senseId: number | null;
  hasSrsCard: boolean;
}

export interface CollocationInfo {
  text: string;
  translation: string | null;
  type: string;
  cefrLevel: string | null;
}

export interface GrammarPatternInfo {
  pattern: string;
  description: string | null;
  cefrLevel: string | null;
}

export interface SentenceDetails {
  text: string;
  translation: string | null;
  cefrLevel: string | null;
  collocations: CollocationInfo[];
  grammarPatterns: GrammarPatternInfo[];
}

export interface JobResult {
  sentenceId: number;
  wordsInserted: number;
  collocationsInserted: number;
  grammarPatternsInserted: number;
}

export interface JobStatus {
  status: string;
  result?: JobResult;
  error?: string;
}

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function submitSentence(text: string): Promise<{ jobId: string }> {
  const response = await fetch(`${API_URL}/sentences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit sentence: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<{ jobId: string }>;
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const response = await fetch(`${API_URL}/sentences/${jobId}/status`);

  if (!response.ok) {
    throw new Error(`Failed to get job status: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<JobStatus>;
}

export async function getSentenceWords(sentenceId: number): Promise<WordInfo[]> {
  const response = await fetch(`${API_URL}/sentences/${sentenceId}/words`);

  if (!response.ok) {
    throw new Error(`Failed to get sentence words: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<WordInfo[]>;
}

export async function createSrsCard(wordSenseId: number): Promise<void> {
  const response = await fetch(`${API_URL}/word-senses/${wordSenseId}/srs-card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to create SRS card: ${response.status} ${response.statusText}`);
  }
}

export interface DueCard {
  cardId: number;
  cardType: 'vocabulary' | 'grammar';
  state: string;
  due: string;
  word?: { lemma: string; translation: string | null; cefrLevel: string | null; partOfSpeech: string | null };
  sentence?: string;
  pattern?: { pattern: string; description: string };
  exercise?: { id: number; sentence: string; answer: string; hint: string | null; difficultyLevel: number };
}

export interface RateResult {
  success: boolean;
  nextDue: string;
}

export async function getDueCards(limit: number = 20): Promise<DueCard[]> {
  const response = await fetch(`${API_URL}/review/due?limit=${limit}`);

  if (!response.ok) {
    throw new Error(`Failed to get due cards: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<DueCard[]>;
}

export async function rateCard(cardId: number, rating: number): Promise<RateResult> {
  const response = await fetch(`${API_URL}/review/${cardId}/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating }),
  });

  if (!response.ok) {
    throw new Error(`Failed to rate card: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<RateResult>;
}

export async function getSentenceDetails(sentenceId: number): Promise<SentenceDetails> {
  const response = await fetch(`${API_URL}/sentences/${sentenceId}/details`);

  if (!response.ok) {
    throw new Error(`Failed to get sentence details: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<SentenceDetails>;
}

export async function setFamiliarity(wordId: number, familiarity: string): Promise<void> {
  const response = await fetch(`${API_URL}/words/${wordId}/familiarity`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ familiarity }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update familiarity: ${response.status} ${response.statusText}`);
  }
}
