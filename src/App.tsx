import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Layout from "./components/Layout";
import SettingsDialog from "./components/SettingsDialog";
import { useChatStore, startAutoPersist, loadSavedWorkspace } from "./stores/chatStore";

function App() {
  const updateSettings = useChatStore((s) => s.updateSettings);

  // Load persisted settings and workspace on startup
  useEffect(() => {
    (async () => {
      try {
        const settings = await invoke<{
          endpoint: string;
          api_key: string;
          model: string;
          system_prompt: string;
          agent_type?: string;
          agent_command?: string | null;
          agent_args_template?: string | null;
        }>("load_settings");
        updateSettings({
          endpoint: settings.endpoint,
          apiKey: settings.api_key,
          model: settings.model,
          systemPrompt: settings.system_prompt,
          agentType: (settings.agent_type as any) || "streaming",
          agentCommand: settings.agent_command ?? undefined,
          agentArgsTemplate: settings.agent_args_template ?? undefined,
        });

      } catch {
        // Use defaults
      }

      // Load saved workspace (annotations, messages, etc.)
      await loadSavedWorkspace();

      // Start auto-persisting workspace on every change
      startAutoPersist();
    })();
  }, [updateSettings]);

  return (
    <>
      <Layout />
      <SettingsDialog />
    </>
  );
}

export default App;
