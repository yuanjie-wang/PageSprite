import { useChatStore } from "../stores/chatStore";

/**
 * Generate HTML for a rect using the configured agent.
 * Throws on failure so the caller can surface the error.
 */
async function generate(
  rectId: string,
  prompt: string,
  existingCode?: string,
  history?: string[],
): Promise<string> {
  const { settings } = useChatStore.getState();

  const html = await window.electronAPI.agent.generate(
    {
      rect_id: rectId,
      prompt,
      existing_code: existingCode ?? null,
      agent_type: settings.agentType,
      command: settings.agentCommand ?? null,
      args_template: settings.agentArgsTemplate ?? null,
      history: history ?? null,
    },
    {
      endpoint: settings.endpoint,
      api_key: settings.apiKey,
      model: settings.model,
      system_prompt: settings.systemPrompt,
    },
  );
  return html;
}

// Module-level singleton — stable reference across renders.
const agentManager = { generate };

export function useAgentManager() {
  return agentManager;
}
