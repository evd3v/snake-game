export interface WordInfo {
  id: number;
  lemma: string;
  translation: string | null;
  cefrLevel: string | null;
  familiarity: string;
  thematicCluster: string | null;
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
