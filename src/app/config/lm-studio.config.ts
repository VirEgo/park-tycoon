import { environment } from '../../environments/environment';

export interface LmStudioConfig {
  baseUrl: string;
  defaultModel: string;
  temperature: number;
  diagnosisHistoryLimit: number;
}

const lmStudioBaseUrl = environment.lmStudioBaseUrl?.trim() || '/lmstudio/v1';

export const LM_STUDIO_CONFIG: LmStudioConfig = {
  baseUrl: lmStudioBaseUrl,
  defaultModel: 'openai/gpt-oss-20b',
  temperature: 0.7,
  diagnosisHistoryLimit: 10
};
