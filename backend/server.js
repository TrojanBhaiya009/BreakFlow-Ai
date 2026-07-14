/**
 * BreakFlow AI — Express Server
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import testsRouter from './routes/tests.js';
import reportsRouter from './routes/reports.js';
import { isCodexActive, getCodexPersonas, runCodexTest } from './engine/codex.js';
import { generateCodexFix } from './engine/recommender.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3002', 'http://127.0.0.1:3002'],
  credentials: true
}));
app.use(express.json());

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
      name: 'Rage Clicker',
      icon: 'click',
      description: 'Clicks buttons and interactive elements rapidly and repeatedly',
      detects: ['duplicate submissions', 'UI freezes', 'double-processing', 'race conditions'],
      color: '#A5532A'
    },
    {
      id: 'half-fill-user',
      name: 'Half-Fill User',
      icon: 'form',
      description: 'Fills forms partially, leaves fields empty, submits incomplete data',
      detects: ['missing validation', 'partial submission bugs', 'abandoned workflow issues'],
      color: '#B4233A'
    },
    {
      id: 'confused-navigator',
      name: 'Confused Navigator',
      icon: 'route',
      description: 'Random back/forward navigation, refresh, clicks random links',
      detects: ['broken redirects', 'dead-end pages', 'navigation errors', 'state corruption'],
      color: '#7A5B44'
    },
    {
      id: 'slow-network-user',
      name: 'Slow Network User',
      icon: 'network',
      description: 'Simulates slow network, delayed responses, timeouts, and retries',
      detects: ['timeout issues', 'missing loading states', 'retry bugs', 'stale sessions'],
      color: '#A8751B'
    },
    {
      id: 'contradictory-input-user',
      name: 'Contradictory Input User',
      icon: 'input',
      description: 'Enters invalid, contradictory, and edge-case data in forms',
      detects: ['input validation gaps', 'injection vulnerabilities', 'type coercion bugs'],
      color: '#5D8E3E'
    },
    {
      id: 'viewport-shifter',
      name: 'Viewport Shifter',
      icon: 'viewport',
      description: 'Resizes through mobile, tablet, and desktop viewports',
      detects: ['horizontal overflow', 'tiny tap targets', 'blocked responsive layouts'],
      color: '#1F7A5C'
    },
    {
      id: 'multi-tab-user',
      name: 'Multi-Tab User',
      icon: 'tabs',
      description: 'Runs the same workflow in parallel browser tabs',
      detects: ['duplicate actions', 'storage drift', 'stale multi-tab state'],
      color: '#7A5B44'
    },
    {
      id: 'permission-denier',
      name: 'Permission Denier',
      icon: 'permission',
      description: 'Denies browser capabilities such as location, camera, and notifications',
      detects: ['missing permission fallbacks', 'blocked workflow loops', 'unclear recovery states'],
      color: '#A8751B'
    }
  ]);
});

// Codex red-teaming endpoints
app.get('/api/codex/status', (req, res) => {
  res.json({
    active: isCodexActive(),
    message: isCodexActive()
      ? 'Codex red-teaming is active'
      : 'Codex is not active — set CODEX_API_KEY in .env',
  });
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
