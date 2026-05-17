import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface EmbeddingRequest {
  input: string | string[];
  model?: string;
}

export interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

class AIService {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private defaultTemperature: number;

  constructor() {
    this.baseUrl = config.aiServiceUrl;
    this.apiKey = config.ai.openaiApiKey;
    this.model = config.ai.model;
    this.defaultTemperature = config.ai.temperature;
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages,
          temperature: request.temperature ?? this.defaultTemperature,
          max_tokens: request.maxTokens,
          stream: request.stream ?? false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error({ error, status: response.status }, 'AI service error');
        throw new Error(`AI service error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      logger.error({ error }, 'Failed to get chat completion');
      throw error;
    }
  }

  async createEmbedding(input: string | string[]): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input,
          model: 'text-embedding-ada-002',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error({ error, status: response.status }, 'Embedding service error');
        throw new Error(`Embedding service error: ${response.status}`);
      }

      const data: EmbeddingResponse = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      logger.error({ error }, 'Failed to create embedding');
      throw error;
    }
  }

  async searchDocuments(
    query: string,
    context?: string
  ): Promise<string> {
    const messages: ChatMessage[] = [];

    if (context) {
      messages.push({
        role: 'system',
        content: `You are a helpful assistant. Use the following context to answer questions:\n\n${context}`,
      });
    } else {
      messages.push({
        role: 'system',
        content: 'You are a helpful assistant.',
      });
    }

    messages.push({
      role: 'user',
      content: query,
    });

    const response = await this.chatCompletion({ messages });
    return response.choices[0]?.message?.content || '';
  }

  async summarizeText(text: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a helpful assistant that summarizes text concisely.',
      },
      {
        role: 'user',
        content: `Please summarize the following text:\n\n${text}`,
      },
    ];

    const response = await this.chatCompletion({ messages, maxTokens: 500 });
    return response.choices[0]?.message?.content || '';
  }

  async extractKeyPoints(text: string): Promise<string[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a helpful assistant that extracts key points from text. Return a JSON array of strings.',
      },
      {
        role: 'user',
        content: `Extract the key points from the following text as a JSON array:\n\n${text}`,
      },
    ];

    const response = await this.chatCompletion({ messages, maxTokens: 1000 });
    const content = response.choices[0]?.message?.content || '[]';
    
    try {
      return JSON.parse(content);
    } catch {
      return content.split('\n').filter((line) => line.trim());
    }
  }
}

export const aiService = new AIService();