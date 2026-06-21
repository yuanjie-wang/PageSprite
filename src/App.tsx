import { useEffect } from "react";
import Layout from "./components/Layout";
import SettingsDialog from "./components/SettingsDialog";
import { useChatStore, startAutoPersist, loadSavedWorkspace } from "./stores/chatStore";
import { setFontAwesomeCSS } from "./utils/code";

function App() {
  const updateSettings = useChatStore((s) => s.updateSettings);

  // Load persisted settings and workspace on startup
  useEffect(() => {
    (async () => {
      try {
        const settings = await window.electronAPI.settings.load();
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

      // Load Font Awesome CSS from main process (base64-embedded, no network needed)
      try {
        const faCSS = await window.electronAPI.assets.getFontAwesomeCSS();
        if (faCSS) setFontAwesomeCSS(faCSS);
      } catch {
        // Font Awesome not available — proceed without it
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
