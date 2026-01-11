import { AlphaFactor, GenerationConfig } from "../types";

const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3001/api';

export const generateAlphaFactor = async (prompt: string, config: GenerationConfig): Promise<AlphaFactor> => {
  const response = await fetch(`${API_BASE_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, config })
  });
  
  if (!response.ok) throw new Error("AI Generation failed on server");
  return await response.json();
};

export const generateBulkAlphaFactors = async (count: number, config: GenerationConfig): Promise<AlphaFactor[]> => {
  const response = await fetch(`${API_BASE_URL}/generate-bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count, config })
  });
  
  if (!response.ok) throw new Error("Bulk Discovery failed on server");
  return await response.json();
};
