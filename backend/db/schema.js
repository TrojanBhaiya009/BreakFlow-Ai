import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey && 
    supabaseUrl !== 'your_supabase_url_here' && 
    supabaseKey !== 'your_supabase_anon_key_here') {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('[DB] Connected to Supabase');
} else {
  console.warn('[DB] Supabase not configured — using in-memory storage');
}

// ============================================
// IN-MEMORY FALLBACK
// ============================================
const memoryStore = {
  test_runs: [],
  test_issues: [],
  test_recommendations: [],
  test_events: [],
};

/**
 * In-memory query builder that mimics Supabase's chaining API.
 * All terminal calls (.single(), awaiting the builder) resolve a promise.
 */
class MemoryQueryBuilder {
  constructor(table, operation = 'select') {
    this._table = table;
    this._operation = operation;
    this._filters = [];
    this._orderCol = null;
    this._orderAsc = true;
    this._limitN = null;
    this._isSingle = false;
    this._insertData = null;
    this._updateData = null;
  }

  eq(col, val) {
    this._filters.push({ col, val });
    return this;
  }

  order(col, opts = {}) {
    this._orderCol = col;
    this._orderAsc = opts.ascending !== false;
    return this;
  }

  limit(n) {
    this._limitN = n;
    return this;
  }

  single() {
    this._isSingle = true;
    return this;
  }

  /** Make this object awaitable */
  then(resolve, reject) {
    try {
      const result = this._execute();
      resolve(result);
    } catch (e) {
      if (reject) reject(e);
      else throw e;
    }
  }

  _execute() {
    switch (this._operation) {
      case 'insert': {
        const items = Array.isArray(this._insertData) ? this._insertData : [this._insertData];
        for (const item of items) {
          if (!item.id) item.id = crypto.randomUUID();
          if (!item.created_at) item.created_at = new Date().toISOString();
          memoryStore[this._table].push({ ...item });
        }
        return { data: items, error: null };
      }

      case 'update': {
        for (const f of this._filters) {
          const idx = memoryStore[this._table].findIndex(r => r[f.col] === f.val);
          if (idx !== -1) {
            memoryStore[this._table][idx] = { ...memoryStore[this._table][idx], ...this._updateData };
          }
        }
        return { data: this._updateData, error: null };
      }

      case 'select': {
        let results = [...memoryStore[this._table]];

        for (const f of this._filters) {
          results = results.filter(r => r[f.col] === f.val);
        }

        if (this._orderCol) {
          results.sort((a, b) => {
            const aVal = a[this._orderCol] || '';
            const bVal = b[this._orderCol] || '';
            return this._orderAsc
              ? String(aVal).localeCompare(String(bVal))
              : String(bVal).localeCompare(String(aVal));
          });
        }

        if (this._limitN) {
          results = results.slice(0, this._limitN);
        }

        if (this._isSingle) {
          return {
            data: results[0] || null,
            error: results.length === 0 ? { message: 'Not found' } : null
          };
        }

        return { data: results, error: null };
      }

      case 'delete': {
        for (const f of this._filters) {
          memoryStore[this._table] = memoryStore[this._table].filter(r => r[f.col] !== f.val);
        }
        return { error: null };
      }

      default:
        return { data: null, error: { message: `Unknown operation: ${this._operation}` } };
    }
  }
}

/**
 * Database abstraction layer
 */
const db = {
  from(table) {
    if (supabase) {
      return supabase.from(table);
    }

    return {
      insert(data) {
        const qb = new MemoryQueryBuilder(table, 'insert');
        qb._insertData = data;
        return qb;
      },
      select(columns = '*') {
        return new MemoryQueryBuilder(table, 'select');
      },
      update(data) {
        const qb = new MemoryQueryBuilder(table, 'update');
        qb._updateData = data;
        return qb;
      },
      delete() {
        return new MemoryQueryBuilder(table, 'delete');
      }
    };
  }
};

export default db;

/*
  ==============================
  SUPABASE TABLE DEFINITIONS
  Run these SQL statements in the Supabase SQL Editor:
  ==============================

  CREATE TABLE test_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    personas TEXT[] NOT NULL DEFAULT '{}',
    resilience_score INTEGER DEFAULT NULL,
    total_issues INTEGER DEFAULT 0,
    critical_issues INTEGER DEFAULT 0,
    warning_issues INTEGER DEFAULT 0,
    info_issues INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE test_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    persona TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    details JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE test_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    issue_category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    code_snippet TEXT DEFAULT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    source TEXT NOT NULL DEFAULT 'rule-based',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE test_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    persona TEXT DEFAULT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX idx_test_issues_run ON test_issues(test_run_id);
  CREATE INDEX idx_test_recommendations_run ON test_recommendations(test_run_id);
  CREATE INDEX idx_test_events_run ON test_events(test_run_id);
*/
