const SEVERITY_RANK = {
  info: 1,
  warning: 2,
  critical: 3
};

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/https?:\/\/[^\s)]+/g, '<url>')
    .replace(/[a-f0-9]{8,}-[a-f0-9-]{13,}/g, '<id>')
    .replace(/\b\d{2,}\b/g, '<num>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function normalizeUrl(value = '') {
  try {
    const url = new URL(value);
    const path = url.pathname
      .replace(/\/\d+(?=\/|$)/g, '/<num>')
      .replace(/\/[a-f0-9]{8,}(?=\/|$)/gi, '/<id>');
    return `${url.origin}${path}`;
  } catch (e) {
    return normalizeText(value);
  }
}

function issueTarget(issue = {}) {
  const details = issue.details || {};

  if (details.url) {
    return `${details.method || ''}:${normalizeUrl(details.url)}`;
  }

  if (details.location?.url) {
    return normalizeUrl(details.location.url);
  }

  if (details.elementText || details.buttonText) {
    return normalizeText(details.elementText || details.buttonText);
  }

  return normalizeText(issue.description || issue.title || '');
}

function collectPersonas(issue = {}) {
  const fromDetails = issue.details?.affected_personas;
  if (Array.isArray(fromDetails) && fromDetails.length > 0) {
    return fromDetails.filter(Boolean);
  }

  if (!issue.persona) return [];
  return String(issue.persona)
    .split(',')
    .map(persona => persona.trim())
    .filter(Boolean);
}

export function getIssueFingerprint(issue = {}) {
  const category = issue.category || 'unknown';
  const title = normalizeText(issue.title || category);
  const target = issueTarget(issue);
  return `${category}|${title}|${target}`;
}

function pickWorseSeverity(a = 'info', b = 'info') {
  return (SEVERITY_RANK[b] || 0) > (SEVERITY_RANK[a] || 0) ? b : a;
}

function mergeDetails(existingDetails = {}, issue = {}) {
  const occurrenceCount = (existingDetails.occurrence_count || 1) + (issue.details?.occurrence_count || 1);
  const affectedPersonas = new Set(existingDetails.affected_personas || []);
  for (const persona of collectPersonas(issue)) {
    affectedPersonas.add(persona);
  }

  const samples = Array.isArray(existingDetails.samples) ? existingDetails.samples.slice(0, 4) : [];
  if (samples.length < 5) {
    samples.push({
      description: issue.description,
      details: issue.details || {},
      timestamp: issue.timestamp
    });
  }

  return {
    ...existingDetails,
    occurrence_count: occurrenceCount,
    affected_personas: Array.from(affectedPersonas),
    samples
  };
}

export function deduplicateIssues(issues = []) {
  const grouped = new Map();

  for (const issue of issues || []) {
    const key = getIssueFingerprint(issue);

    if (!grouped.has(key)) {
      const affectedPersonas = new Set(collectPersonas(issue));

      grouped.set(key, {
        ...issue,
        details: {
          ...(issue.details || {}),
          occurrence_count: issue.details?.occurrence_count || 1,
          affected_personas: Array.from(affectedPersonas),
          samples: issue.details?.samples || []
        }
      });
      continue;
    }

    const existing = grouped.get(key);
    const mergedDetails = mergeDetails(existing.details, issue);
    const affectedPersonas = mergedDetails.affected_personas || [];

    grouped.set(key, {
      ...existing,
      severity: pickWorseSeverity(existing.severity, issue.severity),
      persona: affectedPersonas.length > 0 ? affectedPersonas.join(', ') : existing.persona,
      description: existing.description || issue.description,
      timestamp: existing.timestamp || issue.timestamp,
      details: mergedDetails
    });
  }

  return Array.from(grouped.values());
}

export function getSeverityCounts(issues = []) {
  const counts = { critical: 0, warning: 0, info: 0 };
  for (const issue of issues || []) {
    if (counts[issue.severity] !== undefined) counts[issue.severity]++;
  }
  return counts;
}
