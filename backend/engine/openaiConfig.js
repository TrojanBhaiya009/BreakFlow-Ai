import dotenv from 'dotenv';
dotenv.config();

const PLACEHOLDER_KEYS = new Set([
  '',
  'your_codex_api_key_here',
  'your_openai_api_key_here'
]);

export function getOpenAIConfig() {
  const codexKey = process.env.CODEX_API_KEY?.trim() || '';
  const openaiKey = process.env.OPENAI_API_KEY?.trim() || '';
  const apiKey = !PLACEHOLDER_KEYS.has(codexKey) ? codexKey : openaiKey;
  const keySource = apiKey === codexKey ? 'CODEX_API_KEY' : apiKey === openaiKey ? 'OPENAI_API_KEY' : null;
  const model = process.env.CODEX_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

  return {
    apiKey,
    keySource,
    model,
    active: Boolean(apiKey && keySource)
  };
}
