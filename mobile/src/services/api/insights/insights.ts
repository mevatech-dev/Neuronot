import { request } from '../client';

export type InsightResponse = {
  id?: string;
  title: string;
  content: string;
  language: string;
  crisis: boolean;
  generated_at?: string;
  viewed_at?: string | null;
};

export type InsightListResponse = {
  items: InsightResponse[];
};

export function getInsights(limit = 20) {
  return request<InsightListResponse>({
    method: 'GET',
    url: '/v1/insights',
    params: { limit },
  });
}

export function generateInsight(language: string) {
  return request<InsightResponse>({
    method: 'POST',
    url: '/v1/insights/generate',
    data: { language },
  });
}
