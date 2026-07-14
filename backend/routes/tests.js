/**
 * BreakFlow AI — Test Routes
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import supabase from '../db/schema.js';
import { runTest, registerStream, removeStream } from '../engine/orchestrator.js';

const router = Router();

/**
 * POST /api/tests
 * Start a new test run
 */
router.post('/', async (req, res) => {
  try {
    const { url, personas } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!personas || !Array.isArray(personas) || personas.length === 0) {
      return res.status(400).json({ error: 'At least one persona must be selected' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const validPersonas = [
      'rage-clicker',
      'half-fill-user',
      'confused-navigator',
      'slow-network-user',
      'contradictory-input-user',
      'viewport-shifter',
      'multi-tab-user',
      'permission-denier'
    ];

    const selectedPersonas = personas.filter(p => validPersonas.includes(p));
    if (selectedPersonas.length === 0) {
      return res.status(400).json({ error: 'No valid personas selected' });
    }

    const testRunId = uuidv4();

    // Create test run in DB
    const { error } = await supabase.from('test_runs').insert({
      id: testRunId,
      target_url: url,
      status: 'pending',
      personas: selectedPersonas
    });

    if (error) {
      console.error('Failed to create test run:', error);
      return res.status(500).json({ error: 'Failed to create test run' });
    }

    // Start test in background (don't await)
    runTest(testRunId, url, selectedPersonas).catch(err => {
      console.error(`Test ${testRunId} background error:`, err);
    });

    res.status(201).json({
      id: testRunId,
      status: 'pending',
      url,
      personas: selectedPersonas,
      message: 'Test started successfully'
    });

  } catch (error) {
    console.error('POST /api/tests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tests/:id
 * Get test run status
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('test_runs')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Test run not found' });
    }

    res.json(data);

  } catch (error) {
    console.error('GET /api/tests/:id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tests/:id/stream
 * SSE endpoint for live test progress
 */
router.get('/:id/stream', async (req, res) => {
  const { id } = req.params;

  // Check if test exists
  const { data, error } = await supabase
    .from('test_runs')
    .select('status')
    .eq('id', id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Test run not found' });
  }

  // Setup SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initial status
  res.write(`data: ${JSON.stringify({ type: 'connected', testId: id, status: data.status })}\n\n`);

  // Register this stream
  registerStream(id, res);

  // Send keepalive
  const keepalive = setInterval(() => {
    try {
      res.write(`: keepalive\n\n`);
    } catch (e) {
      clearInterval(keepalive);
    }
  }, 15000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(keepalive);
    removeStream(id, res);
  });
});

/**
 * GET /api/tests
 * List recent test runs
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('test_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch test runs' });
    }

    res.json(data || []);

  } catch (error) {
    console.error('GET /api/tests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
