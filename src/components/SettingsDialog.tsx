import { useState, useEffect } from "react";
import { useChatStore } from "../stores/chatStore";
import type { AgentType } from "../types";

type Tab = "agent" | "systemPrompt";

export default function SettingsDialog() {
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
          <button style={tabStyle("agent")} onClick={() => setActiveTab("agent")}>Agent 设置</button>
          <button style={tabStyle("systemPrompt")} onClick={() => setActiveTab("systemPrompt")}>风格偏好</button>
        </div>

        {activeTab === "agent" && (
          <>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Agent 类型</label>
              <select
                value={agentType}
                onChange={(e) => setAgentType(e.target.value as AgentType)}
                style={selectStyle}
              >
                <option value="streaming">内置Agent</option>
                <option value="opencode">OpenCode CLI</option>
                <option value="claude">Claude Code CLI</option>
                <option value="custom">自定义</option>
              </select>
              <div style={{ fontSize: 11, color: "#888", marginTop: 4, lineHeight: 1.5 }}>
                {agentType === "streaming" && "通过配置的 API 端点直接生成代码，无需额外安装。"}
                {agentType === "opencode" && "使用 OpenCode CLI 工具生成代码。需要先在系统中安装 opencode。"}
                {agentType === "claude" && "使用 Claude Code CLI (claude) 生成代码。需要先在系统中安装 Claude Code。"}
                {agentType === "custom" && "使用自定义 CLI 工具生成代码。配置下面的命令和参数模板。"}
              </div>
            </div>

            {(agentType === "custom" || agentType === "opencode" || agentType === "claude") && (
              <>
                {agentType === "custom" && (
                  <>
                    <div style={{ marginBottom: 18 }}>
                      <label style={labelStyle}>命令</label>
                      <input
                        value={agentCommand}
                        onChange={(e) => setAgentCommand(e.target.value)}
                        placeholder="如: opencode, claude, my-tool"
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ marginBottom: 18 }}>
                      <label style={labelStyle}>参数模板</label>
                      <input
                        value={agentArgsTemplate}
                        onChange={(e) => setAgentArgsTemplate(e.target.value)}
                        placeholder={'如: run --dir {dir} --format json'}
                        style={inputStyle}
                      />
                      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                        可用占位符: {`{dir}`} 工作目录（提示词会自动作为最后一个参数追加）
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
                    使用 OpenCode 时，PageSprite 会调用 <code>opencode run --dir {'{dir}'} --format json {'<prompt>'}</code> 来生成代码，提示词作为最后参数传入。
                    Agent 会修改工作目录中的 <code>index.html</code> 文件，生成结果从该文件读取。
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
                    使用 Claude Code 时，PageSprite 会调用 <code>claude -p {'<prompt>'}</code> 来生成代码，提示词作为最后参数传入。
                    Agent 会修改工作目录中的 <code>index.html</code> 文件，生成结果从该文件读取。
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
                  <label style={labelStyle}>API 端点</label>
                  <input
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 28 }}>
                  <label style={labelStyle}>模型</label>
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="gpt-4o"
                    style={inputStyle}
                  />
                </div>
              </>
            )}
          </>
        )}

        {activeTab === "systemPrompt" && (
          <div style={{ marginBottom: 28 }}>
            <label style={labelStyle}>风格偏好</label>
            <div style={{ fontSize: 11, color: "#888", marginTop: -2, marginBottom: 8, lineHeight: 1.5 }}>
              控制 AI 输出的视觉风格，会追加到固定的系统提示词之后。留空则使用默认风格。
            </div>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={16}
              style={{
                ...inputStyle,
                resize: "vertical",
                fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
                fontSize: 12,
                lineHeight: 1.6,
              }}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={() => setSettingsOpen(false)}
            style={secondaryBtnStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
          >
            取消
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
            保存
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
