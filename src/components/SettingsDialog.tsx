import { useState, useEffect } from "react";
import { useChatStore } from "../stores/chatStore";
import type { AgentType, Language, Theme } from "../types";
import { useT } from "../i18n";

type Tab = "agent" | "systemPrompt";

export default function SettingsDialog() {
  const t = useT();
  const { settings, settingsOpen, setSettingsOpen, updateSettings, persistSettings } = useChatStore();

  // API tab
  const [endpoint, setEndpoint] = useState(settings.endpoint);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt);

  // Agent tab
  const [agentType, setAgentType] = useState<AgentType>(settings.agentType);
  const [agentCommand, setAgentCommand] = useState(settings.agentCommand ?? "");
  const [agentArgsTemplate, setAgentArgsTemplate] = useState(settings.agentArgsTemplate ?? "");

  // Basic settings
  const [language, setLanguage] = useState<Language>(settings.language);
  const [theme, setTheme] = useState<Theme>(settings.theme);

  const [activeTab, setActiveTab] = useState<Tab>("agent");

  useEffect(() => {
    if (settingsOpen) {
      setEndpoint(settings.endpoint);
      setApiKey(settings.apiKey);
      setModel(settings.model);
      setSystemPrompt(settings.systemPrompt);
      setAgentType(settings.agentType);
      setAgentCommand(settings.agentCommand ?? "");
      setAgentArgsTemplate(settings.agentArgsTemplate ?? "");
      setLanguage(settings.language);
      setTheme(settings.theme);
    }
  }, [settingsOpen, settings]);

  const handleSave = () => {
    updateSettings({
      endpoint,
      apiKey,
      model,
      systemPrompt,
      agentType,
      agentCommand: agentType === "custom" ? (agentCommand || undefined) : undefined,
      agentArgsTemplate: agentType === "custom" ? (agentArgsTemplate || undefined) : undefined,
      language,
      theme,
    });
    persistSettings();

    setSettingsOpen(false);
  };

  if (!settingsOpen) return null;

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    flex: 1,
    padding: "10px 0",
    border: "none",
    background: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: activeTab === tab ? 600 : 400,
    color: activeTab === tab ? "#1a1a1a" : "#888",
    borderBottom: activeTab === tab ? "2px solid #4f8cff" : "2px solid transparent",
    transition: "all 0.15s",
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(2px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setSettingsOpen(false);
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(24px) saturate(1.4)",
          WebkitBackdropFilter: "blur(24px) saturate(1.4)",
          border: "1px solid rgba(255,255,255,0.5)",
          borderRadius: 16,
          padding: 32,
          width: 480,
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 24px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1) inset",
        }}
      >
        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 28 }}>
          <button style={tabStyle("agent")} onClick={() => setActiveTab("agent")}>{t("tabAgent")}</button>
          <button style={tabStyle("systemPrompt")} onClick={() => setActiveTab("systemPrompt")}>{t("tabBasic")}</button>
        </div>

        {activeTab === "agent" && (
          <>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>{t("agentType")}</label>
              <select
                value={agentType}
                onChange={(e) => setAgentType(e.target.value as AgentType)}
                style={selectStyle}
              >
                <option value="streaming">{t("agentTypeStreaming")}</option>
                <option value="opencode">{t("agentTypeOpencode")}</option>
                <option value="claude">{t("agentTypeClaude")}</option>
                <option value="custom">{t("agentTypeCustom")}</option>
              </select>
              <div style={{ fontSize: 11, color: "#888", marginTop: 4, lineHeight: 1.5 }}>
                {agentType === "streaming" && t("agentDescStreaming")}
                {agentType === "opencode" && t("agentDescOpencode")}
                {agentType === "claude" && t("agentDescClaude")}
                {agentType === "custom" && t("agentDescCustom")}
              </div>
            </div>

            {(agentType === "custom" || agentType === "opencode" || agentType === "claude") && (
              <>
                {agentType === "custom" && (
                  <>
                    <div style={{ marginBottom: 18 }}>
                      <label style={labelStyle}>{t("command")}</label>
                      <input
                        value={agentCommand}
                        onChange={(e) => setAgentCommand(e.target.value)}
                        placeholder={t("commandPlaceholder")}
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ marginBottom: 18 }}>
                      <label style={labelStyle}>{t("argsTemplate")}</label>
                      <input
                        value={agentArgsTemplate}
                        onChange={(e) => setAgentArgsTemplate(e.target.value)}
                        placeholder={t("argsTemplatePlaceholder")}
                        style={inputStyle}
                      />
                      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                        {t("argsTemplateHint")}
                      </div>
                    </div>

                  </>
                )}

                {agentType === "opencode" && (
                  <div style={{
                    padding: 12,
                    background: "rgba(79,140,255,0.06)",
                    borderRadius: 10,
                    border: "1px solid rgba(79,140,255,0.12)",
                    fontSize: 12,
                    color: "#555",
                    lineHeight: 1.6,
                    marginBottom: 28,
                  }}>
                    {t("opencodeDescBefore")} <code>opencode run --dir {'{dir}'} --format json {'<prompt>'}</code> {t("opencodeDescAfter")}
                    {t("agentReadsBefore")} <code>index.html</code> {t("agentReadsAfter")}
                  </div>
                )}

                {agentType === "claude" && (
                  <div style={{
                    padding: 12,
                    background: "rgba(79,140,255,0.06)",
                    borderRadius: 10,
                    border: "1px solid rgba(79,140,255,0.12)",
                    fontSize: 12,
                    color: "#555",
                    lineHeight: 1.6,
                    marginBottom: 28,
                  }}>
                    {t("claudeDescBefore")} <code>claude -p {'<prompt>'}</code> {t("claudeDescAfter")}
                    {t("agentReadsBefore")} <code>index.html</code> {t("agentReadsAfter")}
                  </div>
                )}
              </>
            )}

            {agentType === "streaming" && (
              <>
                <div style={{
                  height: 1,
                  background: "rgba(0,0,0,0.06)",
                  margin: "24px 0",
                }} />

                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>{t("apiEndpoint")}</label>
                  <input
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder={t("apiEndpointPlaceholder")}
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>{t("apiKey")}</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={t("apiKeyPlaceholder")}
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 28 }}>
                  <label style={labelStyle}>{t("model")}</label>
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder={t("modelPlaceholder")}
                    style={inputStyle}
                  />
                </div>
              </>
            )}
          </>
        )}

        {activeTab === "systemPrompt" && (
          <>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>{t("language")}</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                style={selectStyle}
              >
                <option value="zh">{t("langZh")}</option>
                <option value="en">{t("langEn")}</option>
              </select>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>{t("theme")}</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as Theme)}
                style={selectStyle}
              >
                <option value="light">{t("themeLight")}</option>
                <option value="dark">{t("themeDark")}</option>
              </select>
            </div>

            <div style={{
              height: 1,
              background: "rgba(0,0,0,0.06)",
              margin: "24px 0",
            }} />

            <div style={{ marginBottom: 28 }}>
              <label style={labelStyle}>{t("stylePrompt")}</label>
              <div style={{ fontSize: 11, color: "#888", marginTop: -2, marginBottom: 8, lineHeight: 1.5 }}>
                {t("stylePromptDesc")}
              </div>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={12}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              />
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={() => setSettingsOpen(false)}
            style={secondaryBtnStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleSave}
            style={primaryBtnStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(79,140,255,0.45)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "0 4px 14px rgba(79,140,255,0.35)";
              e.currentTarget.style.transform = "none";
            }}
          >
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#444",
  marginBottom: 6,
  letterSpacing: 0.3,
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid rgba(0,0,0,0.1)",
  borderRadius: 10,
  background: "rgba(255,255,255,0.6)",
  color: "#1a1a1a",
  outline: "none",
  fontSize: 13,
  transition: "all 0.15s",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "auto",
  cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  height: 38,
  padding: "0 24px",
  border: "1px solid rgba(0,0,0,0.1)",
  borderRadius: 10,
  background: "rgba(0,0,0,0.04)",
  color: "#555",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.15s",
};

const primaryBtnStyle: React.CSSProperties = {
  height: 38,
  padding: "0 24px",
  border: "none",
  borderRadius: 10,
  background: "linear-gradient(135deg, #4f8cff, #6366f1)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(79,140,255,0.35)",
  transition: "all 0.15s",
};
