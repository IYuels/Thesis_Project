import axios from 'axios';
import { ToxicityResult, BatchToxicityResponse } from '../types/toxicity';

const API_URL = 'http://localhost:8000'; // Update with your FastAPI URL

export const toxicityService = {
  async analyzeText(text: string): Promise<ToxicityResult> {
    const response = await axios.post<ToxicityResult>(`${API_URL}/predict`, { text });
    return response.data;
  },

  async analyzeBatch(texts: string[]): Promise<BatchToxicityResponse> {
    const response = await axios.post<BatchToxicityResponse>(`${API_URL}/predict_batch`, { texts });
    return response.data;
  },

  async checkHealth(): Promise<{status: string, device: string}> {
    const response = await axios.get(`${API_URL}/health`);
    return response.data;
  }
};
