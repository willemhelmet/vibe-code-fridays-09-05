export interface CodeGolfState {
  originalCode: string;
  processedCode: string;
  isLoading: boolean;
  error: string | null;
  apiKey: string;
  language: string;
  mode: 'golf' | 'ungolf';
}