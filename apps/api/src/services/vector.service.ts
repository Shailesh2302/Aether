import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

export interface VectorCollection {
  name: string;
  vectors: number;
  points: number;
}

class VectorService {
  private baseUrl: string;
  private grpcPort: number;
  private apiKey: string;

  constructor() {
    const host = config.qdrant.host.startsWith('http') 
      ? config.qdrant.host 
      : `https://${config.qdrant.host}`;
    this.baseUrl = `${host}:${config.qdrant.port}`;
    this.grpcPort = config.qdrant.grpcPort;
    this.apiKey = config.qdrant.apiKey;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { 'api-key': this.apiKey } : {}),
    };
  }

  private getCollectionName(userId: string): string {
    return `user_${userId}`.replace(/-/g, '_').replace(/:/g, '_');
  }

  async createCollection(name: string, vectorSize: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/collections`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          name,
          vectors: {
            size: vectorSize,
            distance: 'Cosine',
          },
        }),
      });

      return response.ok;
    } catch (error) {
      logger.error({ error, name, vectorSize }, 'Failed to create collection');
      throw error;
    }
  }

  async deleteCollection(name: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/collections/${name}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      return response.ok;
    } catch (error) {
      logger.error({ error, name }, 'Failed to delete collection');
      throw error;
    }
  }

  async upsertPoints(collection: string, points: VectorPoint[]): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/collections/${collection}/points`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({
          points: points.map((p) => ({
            id: p.id,
            vector: p.vector,
            payload: p.payload,
          })),
        }),
      });

      return response.ok;
    } catch (error) {
      logger.error({ error, collection, pointsCount: points.length }, 'Failed to upsert points');
      throw error;
    }
  }

  async searchPoints(
    collection: string,
    vector: number[],
    limit = 10,
    scoreThreshold = 0.0,
    filter?: Record<string, unknown>
  ): Promise<SearchResult[]> {
    try {
      const filterBody = filter
        ? {
            filter: {
              must: Object.entries(filter).map(([key, value]) => ({
                key,
                match: { value },
              })),
            },
          }
        : {};

      const response = await fetch(`${this.baseUrl}/collections/${collection}/points/search`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          vector,
          limit,
          score_threshold: scoreThreshold,
          ...filterBody,
          with_payload: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      return data.result.map((p: { id: string; score: number; payload: Record<string, unknown> }) => ({
        id: p.id,
        score: p.score,
        payload: p.payload,
      }));
    } catch (error) {
      logger.error({ error, collection, vectorSize: vector.length }, 'Failed to search points');
      throw error;
    }
  }

  async deletePoints(collection: string, ids: string[]): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/collections/${collection}/points/delete`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          points: ids,
        }),
      });

      return response.ok;
    } catch (error) {
      logger.error({ error, collection, ids }, 'Failed to delete points');
      throw error;
    }
  }

  async getCollections(): Promise<VectorCollection[]> {
    try {
      const response = await fetch(`${this.baseUrl}/collections`);
      
      if (!response.ok) {
        throw new Error(`Failed to get collections: ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      return data.result.map((c: { name: string; vectors: number; points: number }) => ({
        name: c.name,
        vectors: c.vectors,
        points: c.points,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to get collections');
      throw error;
    }
  }

  async collectionExists(name: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/collections/${name}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/readyz`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async updateCollectionMetadata(name: string, metadata: Record<string, unknown>): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/collections/${name}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({
          metadata,
        }),
      });

      return response.ok;
    } catch (error) {
      logger.error({ error, name, metadata }, 'Failed to update collection metadata');
      throw error;
    }
  }

  async getCollectionInfo(name: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/collections/${name}`);
      if (!response.ok) {
        throw new Error(`Failed to get collection: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      logger.error({ error, name }, 'Failed to get collection info');
      throw error;
    }
  }
}

export const vectorService = new VectorService();