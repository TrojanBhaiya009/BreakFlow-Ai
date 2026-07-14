/**
 * BreakFlow AI — Express Server
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import testsRouter from './routes/tests.js';
import reportsRouter from './routes/reports.js';
import { getCodexPersonas, getCodexStatus, runCodexTest } from './engine/codex.js';
import { generateCodexFix } from './engine/recommender.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  process.env.FRONTEND_URL,
].filter(Boolean);

// Middleware
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json());
app.use('/evidence', express.static(path.join(__dirname, 'evidence')));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.path.includes('/stream')) {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Routes
app.use('/api/tests', testsRouter);
app.use('/api/reports', reportsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'breakflow-ai', timestamp: new Date().toISOString() });
});

// Persona list endpoint
app.get('/api/personas', (req, res) => {
  res.json([
    {
      id: 'rage-clicker',
      name: 'Impatient Buyer',
      icon: 'click',
      description: 'Clicks buttons and interactive elements rapidly and repeatedly',
      detects: ['duplicate submissions', 'UI freezes', 'double-processing', 'race conditions'],
      color: '#A5532A'
    },
    {
      id: 'half-fill-user',
      name: 'Distracted Signup',
      icon: 'form',
      description: 'Fills forms partially, leaves fields empty, submits incomplete data',
      detects: ['missing validation', 'partial submission bugs', 'abandoned workflow issues'],
      color: '#B4233A'
    },
    {
      id: 'confused-navigator',
      name: 'Lost Visitor',
      icon: 'route',
      description: 'Random back/forward navigation, refresh, clicks random links',
      detects: ['broken redirects', 'dead-end pages', 'navigation errors', 'state corruption'],
      color: '#7A5B44'
    },
    {
      id: 'slow-network-user',
      name: 'Bad Wi-Fi User',
      icon: 'network',
      description: 'Simulates slow network, delayed responses, timeouts, and retries',
      detects: ['timeout issues', 'missing loading states', 'retry bugs', 'stale sessions'],
      color: '#A8751B'
    },
    {
      id: 'contradictory-input-user',
      name: 'Hostile Inputter',
      icon: 'input',
      description: 'Enters invalid, contradictory, and edge-case data in forms',
      detects: ['input validation gaps', 'injection vulnerabilities', 'type coercion bugs'],
      color: '#5D8E3E'
    },
    {
      id: 'viewport-shifter',
      name: 'Small-Screen User',
      icon: 'viewport',
      description: 'Resizes through mobile, tablet, and desktop viewports',
      detects: ['horizontal overflow', 'tiny tap targets', 'blocked responsive layouts'],
      color: '#1F7A5C'
    },
    {
      id: 'multi-tab-user',
      name: 'Power Tabber',
      icon: 'tabs',
      description: 'Runs the same workflow in parallel browser tabs',
      detects: ['duplicate actions', 'storage drift', 'stale multi-tab state'],
      color: '#7A5B44'
    },
    {
      id: 'permission-denier',
      name: 'Privacy-First User',
      icon: 'permission',
      description: 'Denies browser capabilities such as location, camera, and notifications',
      detects: ['missing permission fallbacks', 'blocked workflow loops', 'unclear recovery states'],
      color: '#A8751B'
    }
  ]);
});

// Codex red-teaming endpoints
app.get('/api/codex/status', (req, res) => {
  res.json(getCodexStatus());
});

app.get('/api/codex/personas', (req, res) => {
  res.json(getCodexPersonas());
});

app.post('/api/codex/test', async (req, res) => {
  const { url, personas } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  const result = await runCodexTest(url, personas || []);
  res.json(result);
});

// One-click Fix with Codex endpoint
app.post('/api/codex/fix', async (req, res) => {
  const { issue, targetUrl } = req.body;
  if (!issue) return res.status(400).json({ error: 'Issue data is required' });

  const fix = await generateCodexFix(issue, targetUrl || '');
  if (fix) {
    res.json({ fix });
  } else {
    res.status(503).json({ error: 'Codex fix generation unavailable — API key not configured' });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║          BreakFlow AI Backend            ║
  ║     Codex-Powered Chaos Testing          ║
  ╠══════════════════════════════════════════╣
  ║  Server:  http://localhost:${PORT}          ║
  ║  Health:  http://localhost:${PORT}/api/health║
  ╚══════════════════════════════════════════╝
  `);
});

export default app;
