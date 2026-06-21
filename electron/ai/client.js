/**
 * OpenAI-compatible SSE streaming client.
 * Also provides a non-streaming chatCompletion() for lightweight review calls.
 */

/** Resolve `{env:VAR_NAME}` syntax in API keys */
function resolveApiKey(key) {
  const match = /^{env:(\w+)}$/.exec(key);
  if (match) {
    return process.env[match[1]] || key;
  }
  return key;
}

/**
 * Send a streaming chat completion request to an OpenAI-compatible API.
 * Calls `onChunk` for each content delta.
 * Returns the full accumulated text.
 * Aborts when `signal` is aborted.
 */
export async function chatStream(settings, messages, onChunk, signal) {
  const url = `${settings.endpoint.replace(/\/+$/, "")}/chat/completions`;

  const apiMessages = [];
  if (settings.system_prompt) {
    apiMessages.push({ role: "system", content: settings.system_prompt });
  }
  for (const msg of messages) {
    apiMessages.push({ role: msg.role, content: msg.content });
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolveApiKey(settings.api_key)}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: settings.model,
      messages: apiMessages,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`API error (${response.status}): ${body}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let fullContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });

    // Process complete SSE lines
    while (true) {
      const nlIdx = buf.indexOf("\n");
      if (nlIdx === -1) break;

      const line = buf.slice(0, nlIdx).trim();
      buf = buf.slice(nlIdx + 1);

      if (!line || !line.startsWith("data: ")) continue;

      const data = line.slice(6); // strip "data: "

      if (data === "[DONE]") break;

      try {
        const chunk = JSON.parse(data);
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          fullContent += content;
          onChunk(content);
        }
      } catch {
        // Skip malformed JSON chunks
      }
    }
  }

  return fullContent;
}

/**
 * Non-streaming chat completion. Used for lightweight tasks like code review.
 * Accepts an optional systemPromptOverride to replace settings.system_prompt.
 * Aborts when `signal` is aborted.
 */
export async function chatCompletion(settings, messages, signal, systemPromptOverride) {
  const url = `${settings.endpoint.replace(/\/+$/, "")}/chat/completions`;

  const apiMessages = [];
  const sysPrompt = systemPromptOverride !== undefined ? systemPromptOverride : settings.system_prompt;
  if (sysPrompt) {
    apiMessages.push({ role: "system", content: sysPrompt });
  }
  for (const msg of messages) {
    apiMessages.push(msg);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolveApiKey(settings.api_key)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model,
      messages: apiMessages,
      stream: false,
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`API error (${response.status}): ${body}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Chat completion with tool/function calling support.
 * Non-streaming. Returns the full response message including tool_calls.
 * Supports cancellation via AbortSignal.
 */
export async function chatWithTools(settings, messages, tools, signal) {
  const url = `${settings.endpoint.replace(/\/+$/, "")}/chat/completions`;

  const apiMessages = [];
  if (settings.system_prompt) {
    apiMessages.push({ role: "system", content: settings.system_prompt });
  }
  for (const msg of messages) {
    apiMessages.push(msg);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolveApiKey(settings.api_key)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model,
      messages: apiMessages,
      tools,
      tool_choice: "auto",
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`API error (${response.status}): ${body}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message || { role: "assistant", content: null };
}
