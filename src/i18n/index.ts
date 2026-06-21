import { useChatStore } from "../stores/chatStore";
import type { Language } from "../types";

type Translations = Record<string, Record<Language, string>>;

const translations: Translations = {
  // Toolbar
  cursor: { zh: "光标", en: "Cursor" },
  pan: { zh: "拖动", en: "Pan" },
  createRect: { zh: "画布创建", en: "Create Rect" },
  undo: { zh: "撤销", en: "Undo" },
  redo: { zh: "恢复", en: "Redo" },
  clearWorkspace: { zh: "清空工作区", en: "Clear Workspace" },
  apiSettings: { zh: "API 设置", en: "API Settings" },

  // Zoom controls
  zoomOut: { zh: "缩小", en: "Zoom Out" },
  zoomIn: { zh: "放大", en: "Zoom In" },
  resetZoom: { zh: "重置缩放", en: "Reset Zoom" },

  // Annotation toolbar
  rectangle: { zh: "矩形", en: "Rectangle" },
  ellipse: { zh: "圆形", en: "Ellipse" },
  pen: { zh: "画笔", en: "Pen" },
  arrow: { zh: "箭头", en: "Arrow" },
  color: { zh: "颜色", en: "Color" },
  reset: { zh: "重置", en: "Reset" },
  export: { zh: "导出", en: "Export" },
  delete: { zh: "删除", en: "Delete" },
  downloadHtml: { zh: "下载 HTML", en: "Download HTML" },
  downloadImage: { zh: "下载图片", en: "Download Image" },

  // Settings dialog — tabs
  tabAgent: { zh: "Agent 设置", en: "Agent Settings" },
  tabBasic: { zh: "基础设置", en: "Basic Settings" },

  // Settings dialog — agent
  agentType: { zh: "Agent 类型", en: "Agent Type" },
  agentTypeStreaming: { zh: "内置Agent", en: "Built-in Agent" },
  agentTypeOpencode: { zh: "OpenCode CLI", en: "OpenCode CLI" },
  agentTypeClaude: { zh: "Claude Code CLI", en: "Claude Code CLI" },
  agentTypeCustom: { zh: "自定义", en: "Custom" },
  agentDescStreaming: { zh: "通过配置的 API 端点直接生成代码，无需额外安装。", en: "Generates code directly via the configured API endpoint. No extra installation needed." },
  agentDescOpencode: { zh: "使用 OpenCode CLI 工具生成代码。需要先在系统中安装 opencode。", en: "Uses OpenCode CLI. Requires opencode installed on your system." },
  agentDescClaude: { zh: "使用 Claude Code CLI (claude) 生成代码。需要先在系统中安装 Claude Code。", en: "Uses Claude Code CLI. Requires Claude Code installed on your system." },
  agentDescCustom: { zh: "使用自定义 CLI 工具生成代码。配置下面的命令和参数模板。", en: "Uses a custom CLI tool. Configure the command and arguments template below." },
  command: { zh: "命令", en: "Command" },
  commandPlaceholder: { zh: "如: opencode, claude, my-tool", en: "e.g. opencode, claude, my-tool" },
  argsTemplate: { zh: "参数模板", en: "Arguments Template" },
  argsTemplatePlaceholder: { zh: "如: run --dir {dir} --format json", en: "e.g. run --dir {dir} --format json" },
  argsTemplateHint: { zh: "可用占位符: {dir} 工作目录（提示词会自动作为最后一个参数追加）", en: "Placeholders: {dir} work directory (prompt auto-appended as last argument)" },
  opencodeDescBefore: { zh: "使用 OpenCode 时，PageSprite 会调用", en: "PageSprite calls" },
  opencodeDescAfter: { zh: "来生成代码，提示词作为最后参数传入。", en: "to generate code. The prompt is passed as the last argument." },
  claudeDescBefore: { zh: "使用 Claude Code 时，PageSprite 会调用", en: "PageSprite calls" },
  claudeDescAfter: { zh: "来生成代码，提示词作为最后参数传入。", en: "to generate code. The prompt is passed as the last argument." },
  agentReadsBefore: { zh: "Agent 会修改工作目录中的", en: "The agent modifies" },
  agentReadsAfter: { zh: "文件，生成结果从该文件读取。", en: "in the work directory and reads the result from it." },
  apiEndpoint: { zh: "API 端点", en: "API Endpoint" },
  apiEndpointPlaceholder: { zh: "https://api.openai.com/v1", en: "https://api.openai.com/v1" },
  apiKey: { zh: "API Key", en: "API Key" },
  apiKeyPlaceholder: { zh: "sk-...", en: "sk-..." },
  model: { zh: "模型", en: "Model" },
  modelPlaceholder: { zh: "gpt-4o", en: "gpt-4o" },

  // Settings dialog — basic
  language: { zh: "语言 / Language", en: "Language" },
  theme: { zh: "主题 / Theme", en: "Theme" },
  langZh: { zh: "中文", en: "中文" },
  langEn: { zh: "English", en: "English" },
  themeLight: { zh: "浅色 / Light", en: "Light" },
  themeDark: { zh: "深色 / Dark", en: "Dark" },
  stylePrompt: { zh: "风格偏好 / Style Prompt", en: "Style Prompt" },
  stylePromptDesc: { zh: "控制 AI 输出的视觉风格，会追加到固定的系统提示词之后。留空则使用默认风格。", en: "Controls the visual style of AI output. Appended to the fixed system prompt. Leave empty for default style." },

  // Settings dialog — buttons
  cancel: { zh: "取消", en: "Cancel" },
  save: { zh: "保存", en: "Save" },

  // Workspace — region config
  confirm: { zh: "确认", en: "Confirm" },
  prompt: { zh: "提示词", en: "Prompt" },
  promptPlaceholderNew: { zh: "输入您想要创建的内容...", en: "Describe what you want to create..." },
  promptPlaceholderRevise: { zh: "请输入需要修改的内容", en: "Enter the changes you want..." },
  cancelGenerate: { zh: "取消生成", en: "Cancel Generation" },
  generateInRegion: { zh: "在此区域生成", en: "Generate Here" },
  generateFromAnnotations: { zh: "根据批注生成", en: "Generate from Annotations" },

  // Workspace — loading overlay
  analyzing: { zh: "AI 正在分析批注及页面结构...", en: "AI is analyzing annotations and page structure..." },
  generating: { zh: "AI 正在根据批注意见生成代码...", en: "AI is generating code based on annotations..." },
  generatingHtml: { zh: "AI 正在生成HTML代码...", en: "AI is generating HTML code..." },
  styling: { zh: "AI 正在优化页面样式...", en: "AI is polishing the page style..." },
  finishing: { zh: "AI 即将完成...", en: "AI is almost done..." },
  analyzingSub: { zh: "正在分析...", en: "Analyzing..." },
  generatingSub: { zh: "正在生成代码...", en: "Generating code..." },
  generatingHtmlSub: { zh: "正在生成HTML...", en: "Generating HTML..." },
  stylingSub: { zh: "正在优化样式...", en: "Polishing style..." },
  finishingSub: { zh: "正在收尾...", en: "Finalizing..." },

  // Workspace — misc
  close: { zh: "关闭", en: "Close" },
  changes: { zh: "改动意见", en: "Changes" },
  changesPlaceholder: { zh: "输入对此区域的改动意见...", en: "Describe the changes you want..." },
  annotationPlaceholder: { zh: "输入批注文字...", en: "Enter annotation text..." },

  // Error boundary
  renderError: { zh: "渲染错误", en: "Render Error" },
  retry: { zh: "重试", en: "Retry" },
};

export function useT() {
  const language = useChatStore((s) => s.settings.language);
  return (key: string): string => {
    return translations[key]?.[language] ?? key;
  };
}

export function tStatic(language: Language, key: string): string {
  return translations[key]?.[language] ?? key;
}
