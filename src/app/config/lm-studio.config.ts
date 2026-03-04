export interface LmStudioConfig {
  baseUrl: string;
  defaultModel: string;
  temperature: number;
  diagnosisHistoryLimit: number;
}

export const LM_STUDIO_CONFIG: LmStudioConfig = {
  baseUrl: '/lmstudio/v1',
  defaultModel: 'openai/gpt-oss-20b',
  temperature: 0.7,
  diagnosisHistoryLimit: 10
};
