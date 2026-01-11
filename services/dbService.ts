
import { AlphaFactor, User, BacktestResult } from "../types";

const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3001/api';

export const saveUserToCloud = async (user: User): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/db/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user }),
    });
    if (!response.ok) throw new Error('Failed to save user to cloud');
  } catch (error: any) {
    console.error("Save User Error:", error.message);
  }
};

export const syncFactorsToCloud = async (userId: string, factors: AlphaFactor[]): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/db/factors/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, factors }),
    });
    if (!response.ok) throw new Error('Failed to sync factors to cloud');
  } catch (error: any) {
    console.error("Cloud Sync Error:", error.message);
    throw error;
  }
};

export const saveFactorToCloud = async (userId: string, factor: AlphaFactor): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/db/factors/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, factor }),
    });
    if (!response.ok) throw new Error('Failed to save factor to cloud');
  } catch (error: any) {
    console.error("Save Factor Error:", error.message);
    throw error;
  }
};

export const deleteFactorFromCloud = async (userId: string, factorId: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/db/factors/${factorId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) throw new Error('Failed to delete factor from cloud');
  } catch (error: any) {
    console.error("Delete Factor Error:", error.message);
    throw error;
  }
};

export const fetchFactorsFromCloud = async (userId: string): Promise<AlphaFactor[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/db/factors?userId=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch factors from cloud');
    return await response.json();
  } catch (error: any) {
    console.error("Cloud Fetch Error:", error.message);
    return [];
  }
};

export const saveBacktestResultToCloud = async (
  userId: string, 
  factorId: string, 
  result: BacktestResult
): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/db/backtest/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, factorId, result }),
    });
    if (!response.ok) throw new Error('Failed to save backtest result to cloud');
  } catch (error: any) {
    console.error("Save Backtest Result Error:", error.message);
    throw error;
  }
};

export const fetchBacktestResultsFromCloud = async (factorId: string): Promise<BacktestResult[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/db/backtest?factorId=${factorId}`);
    if (!response.ok) throw new Error('Failed to fetch backtest results from cloud');
    return await response.json();
  } catch (error: any) {
    console.error("Fetch Backtest Results Error:", error.message);
    return [];
  }
};
