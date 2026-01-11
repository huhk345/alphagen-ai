import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { getMarketData } from './services/dataService';
import { generateAlphaFactor, generateBulkAlphaFactors } from './services/geminiService';
import * as db from './services/dbService';
import { BenchmarkType } from './types';


const app = express();
const port = process.env.PORT || 3001;
app.use(cors());
app.use(express.json());

// Market Data Routes
app.get('/api/market-data', async (req, res) => {
  try {
    const { benchmark } = req.query;
    if (!benchmark) return res.status(400).json({ error: 'Benchmark is required' });
    
    const data = await getMarketData(benchmark as BenchmarkType);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// AI Generation Routes
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, config } = req.body;
    const factor = await generateAlphaFactor(prompt, config);
    res.json(factor);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generate-bulk', async (req, res) => {
  try {
    const { count, config } = req.body;
    const factors = await generateBulkAlphaFactors(count, config);
    res.json(factors);
  } catch (error: any) {
    console.log(error)
    res.status(500).json({ error: error.message });
  }
});

// Database Routes
app.post('/api/db/user', async (req, res) => {
  try {
    const { user } = req.body;
    await db.saveUser(user);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/db/factors/sync', async (req, res) => {
  try {
    const { userId, factors } = req.body;
    await db.syncFactors(userId, factors);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/db/factors/save', async (req, res) => {
  try {
    const { userId, factor } = req.body;
    await db.saveFactor(userId, factor);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/db/factors/:id', async (req, res) => {
  try {
    const { userId } = req.body;
    const { id } = req.params;
    await db.deleteFactor(userId, id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/db/factors', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'UserId is required' });
    const factors = await db.fetchFactors(userId as string);
    res.json(factors);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/db/backtest/save', async (req, res) => {
  try {
    const { userId, factorId, result } = req.body;
    await db.saveBacktestResult(userId, factorId, result);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/db/backtest', async (req, res) => {
  try {
    const { factorId } = req.query;
    if (!factorId) return res.status(400).json({ error: 'FactorId is required' });
    const results = await db.fetchBacktestResults(factorId as string);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
