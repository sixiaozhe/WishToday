export type AiProvider = 'deepseek' | 'openai' | 'ollama' | 'custom';

export interface AiSettings {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: number;
  /** Include today's tasks, lists and tags in the system prompt. */
  includeContext: boolean;
}

export interface AiPreset {
  label: string;
  baseUrl: string;
  model: string;
  requiresKey: boolean;
}

export const AI_PRESETS: Record<AiProvider, AiPreset> = {
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    requiresKey: true,
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    requiresKey: true,
  },
  ollama: {
    label: 'Ollama 本地',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'qwen2.5:7b',
    requiresKey: false,
  },
  custom: {
    label: '自定义（OpenAI 兼容）',
    baseUrl: '',
    model: '',
    requiresKey: false,
  },
};

const SETTINGS_KEY = 'dayline.ai.settings.v1';

export const AI_PROVIDER_ORDER: AiProvider[] = ['deepseek', 'openai', 'ollama', 'custom'];

export function defaultAiSettings(): AiSettings {
  const preset = AI_PRESETS.deepseek;
  return {
    provider: 'deepseek',
    baseUrl: preset.baseUrl,
    model: preset.model,
    apiKey: '',
    temperature: 0.4,
    includeContext: true,
  };
}

export function applyAiPreset(
  settings: AiSettings,
  provider: AiProvider,
): AiSettings {
  const preset = AI_PRESETS[provider];
  return {
    ...settings,
    provider,
    baseUrl: preset.baseUrl,
    model: preset.model,
    apiKey: provider === 'ollama' ? '' : settings.apiKey,
  };
}

export function loadAiSettings(): AiSettings {
  const defaults = defaultAiSettings();
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    const provider =
      parsed.provider && parsed.provider in AI_PRESETS
        ? (parsed.provider as AiProvider)
        : defaults.provider;
    return {
      provider,
      baseUrl:
        typeof parsed.baseUrl === 'string' ? parsed.baseUrl : defaults.baseUrl,
      model: typeof parsed.model === 'string' ? parsed.model : defaults.model,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      temperature:
        typeof parsed.temperature === 'number' &&
        parsed.temperature >= 0 &&
        parsed.temperature <= 2
          ? parsed.temperature
          : defaults.temperature,
      includeContext:
        typeof parsed.includeContext === 'boolean'
          ? parsed.includeContext
          : defaults.includeContext,
    };
  } catch {
    return defaults;
  }
}

export function saveAiSettings(settings: AiSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable: keep the in-memory settings for this session.
  }
}

export function isAiConfigured(settings: AiSettings): boolean {
  if (!settings.baseUrl.trim() || !settings.model.trim()) return false;
  const preset = AI_PRESETS[settings.provider];
  if (preset.requiresKey && !settings.apiKey.trim()) return false;
  return true;
}
