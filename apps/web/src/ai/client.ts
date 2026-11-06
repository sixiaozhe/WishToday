import type { AiSettings } from './settings';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  timeoutMs?: number;
  maxTokens?: number;
}

function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}

function chatEndpoint(settings: AiSettings): string {
  const base = settings.baseUrl.trim().replace(/\/+$/, '');
  if (!base) throw new Error('请先在设置里填写 API 地址。');
  if (base.endsWith('/chat/completions')) return base;
  return `${base}/chat/completions`;
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs: number,
): Promise<{ status: number; text: string }> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const response = await invoke<{ status: number; body: string }>('ai_request', {
      request: {
        url,
        method: 'POST',
        headers: Object.entries(headers).map(([name, value]) => ({ name, value })),
        body,
        timeoutSeconds: Math.max(5, Math.round(timeoutMs / 1000)),
      },
    });
    return { status: response.status, text: response.body };
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
    return { status: response.status, text: await response.text() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `无法连接模型服务：${message}。Web 版会受浏览器 CORS 限制，可改用桌面版，或在服务端允许跨域。`,
    );
  } finally {
    window.clearTimeout(timer);
  }
}

function errorMessage(status: number, text: string): string {
  let detail = '';
  try {
    const data = JSON.parse(text) as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (typeof data.error === 'string') detail = data.error;
    else if (data.error?.message) detail = data.error.message;
    else if (data.message) detail = data.message;
  } catch {
    detail = text.slice(0, 300);
  }
  return `模型服务返回 ${status}${detail ? `：${detail}` : ''}`;
}

export async function chatComplete(
  settings: AiSettings,
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<string> {
  const url = chatEndpoint(settings);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  const apiKey = settings.apiKey.trim();
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  const payload: Record<string, unknown> = {
    model: settings.model.trim(),
    messages,
    temperature: settings.temperature,
    stream: false,
  };
  if (options.maxTokens) payload.max_tokens = options.maxTokens;

  const response = await postJson(
    url,
    headers,
    JSON.stringify(payload),
    options.timeoutMs ?? 120_000,
  );
  if (response.status < 200 || response.status >= 300) {
    throw new Error(errorMessage(response.status, response.text));
  }

  let data: unknown;
  try {
    data = JSON.parse(response.text);
  } catch {
    throw new Error('模型服务返回了无法解析的内容。');
  }
  const content = (data as {
    choices?: Array<{ message?: { content?: unknown } }>;
  })?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('模型没有返回内容，请检查模型名称或服务配置。');
  }
  return content.trim();
}

export async function testAiConnection(
  settings: AiSettings,
): Promise<{ ok: boolean; message: string }> {
  try {
    const reply = await chatComplete(
      settings,
      [
        { role: 'system', content: '你是连接测试助手。' },
        { role: 'user', content: '只回复 OK' },
      ],
      { timeoutMs: 45_000, maxTokens: 16 },
    );
    return { ok: true, message: `连接成功：${reply.slice(0, 80)}` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
