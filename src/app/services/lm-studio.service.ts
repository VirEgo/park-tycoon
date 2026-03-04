import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { LM_STUDIO_CONFIG } from '../config/lm-studio.config';

export type LmStudioChatRole = 'system' | 'user' | 'assistant';

export interface LmStudioChatMessage {
  role: LmStudioChatRole;
  content: string;
}

export interface LmStudioModelSummary {
  id: string;
  object: string;
  owned_by?: string;
}

interface LmStudioModelsResponse {
  data: LmStudioModelSummary[];
}

interface LmStudioChatCompletionResponse {
  choices: Array<{
    message?: LmStudioChatMessage;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class LmStudioService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = LM_STUDIO_CONFIG.baseUrl;

  getModels(): Observable<LmStudioModelSummary[]> {
    return this.http
      .get<LmStudioModelsResponse>(`${this.baseUrl}/models`)
      .pipe(map((response) => response.data ?? []));
  }

  chat(model: string, messages: LmStudioChatMessage[]): Observable<string> {
    return this.http
      .post<LmStudioChatCompletionResponse>(`${this.baseUrl}/chat/completions`, {
        model,
        messages,
        temperature: LM_STUDIO_CONFIG.temperature,
        stream: false
      })
      .pipe(map((response) => response.choices[0]?.message?.content?.trim() ?? ''));
  }

  streamChat(model: string, messages: LmStudioChatMessage[]): Observable<string> {
    return new Observable<string>((subscriber) => {
      const controller = new AbortController();

      fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: LM_STUDIO_CONFIG.temperature,
          stream: true
        }),
        signal: controller.signal
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`LM Studio request failed with status ${response.status}`);
        }

        if (!response.body) {
          throw new Error('LM Studio did not return a readable stream');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';

          for (const event of events) {
            const lines = event
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line.startsWith('data:'));

            for (const line of lines) {
              const payload = line.replace(/^data:\s*/, '');
              if (!payload || payload === '[DONE]') {
                continue;
              }

              try {
                const parsed = JSON.parse(payload) as {
                  choices?: Array<{
                    delta?: { content?: string };
                    message?: { content?: string };
                  }>;
                };
                const chunk = parsed.choices?.[0]?.delta?.content
                  ?? parsed.choices?.[0]?.message?.content
                  ?? '';

                if (chunk) {
                  subscriber.next(chunk);
                }
              } catch {
                // Ignore malformed partial frames.
              }
            }
          }
        }

        subscriber.complete();
      }).catch((error: unknown) => {
        if (controller.signal.aborted) {
          subscriber.complete();
          return;
        }

        subscriber.error(error);
      });

      return () => controller.abort();
    });
  }
}
