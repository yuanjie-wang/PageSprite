# PageSprite

[![CI](https://github.com/wang444444/PageSprite/actions/workflows/build.yml/badge.svg)](https://github.com/wang444444/PageSprite/actions/workflows/build.yml)

> AI 驱动的静态页面生成器——在无限画布上绘制区域，用批注驱动 AI 逐区域生成 HTML。

<!-- TODO: 添加主界面截图 -->
<!-- ![Workspace overview](screenshots/workspace.png) -->

## ✨ 特性

- **无限画布** — 自由缩放和平移的绘制空间，支持多点触控和鼠标拖拽
- **可视化区域定义** — 绘制矩形区域（Rect），指定尺寸和内容类型（手机/平板/网页/自由）
- **AI 逐区域生成** — 每个区域独立生成 HTML，渲染在嵌入式 iframe 中，互不干扰
- **批注反馈** — 在生成内容上绘制箭头、矩形、圆形、高亮、文字，驱动 AI 修改
- **对齐吸附** — 拖拽/缩放时自动吸附到相邻区域边缘
- **多后端支持** — 内置 OpenAI 兼容 API / OpenCode CLI / Claude Code CLI / 自定义 CLI
- **离线图标** — 内置 Font Awesome 6 Free，生成页面可直接使用图标 class
- **撤销/重做** — 支持区域创建和删除的撤销/重做

## 🖼️ 截图

<!-- TODO: 运行 npm run electron:dev 后截取以下画面 -->

| 画布工作区 | 区域生成 |
|:---:|:---:|
| <!-- ![workspace](screenshots/workspace.png) --> | <!-- ![generation](screenshots/generation.png) --> |
| 无限画布上的 Rect 区域与浮动工具栏 | AI 生成的 HTML 在 iframe 中渲染 |

| 批注反馈 | 设置面板 |
|:---:|:---:|
| <!-- ![annotation](screenshots/annotation.png) --> | <!-- ![settings](screenshots/settings.png) --> |
| 在生成内容上绘制箭头和文字批注 | Agent 类型选择与 API 配置 |

## 🚀 快速开始

### 环境要求

- Node.js 20+
- npm

### 启动开发环境

```bash
npm install
npm run electron:dev
```

### 构建安装包

```bash
npm run electron:build
```

产物输出在 `release/` 目录。

## 🔧 生成后端

| 后端 | 说明 |
|------|------|
| **内置 Agent**（默认） | 直接通过 OpenAI 兼容 API 生成，tool-use 循环支持自我审阅和调整 |
| **OpenCode CLI** | 调用 `opencode run --dir {dir} --format json <prompt>` 生成 |
| **Claude Code CLI** | 调用 `claude -p <prompt>` 生成，自动读取工作目录上下文 |
| **自定义 CLI** | 任意 CLI 工具，支持 `{dir}` 和 `{contextFile}` 占位符 |

## 🏗️ 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 19, TypeScript, Vite, Zustand, OGL (WebGL 背景) |
| 桌面端 | Electron, electron-builder |
| AI | OpenAI 兼容 SSE 流式 API / CLI 进程集成 |
| CI | GitHub Actions (macOS + Windows + Linux) |

## 📁 项目结构

```
src/                     # React 前端
├── components/          # 组件（Workspace, Toolbar, SettingsDialog...）
├── hooks/               # Canvas 绘制、Agent 管理、取消
├── stores/              # Zustand 状态管理
├── types/               # TypeScript 类型定义
├── utils/               # HTML 嵌入、ZIndex 常量、吸附逻辑
electron/                # Electron 主进程
├── main.js              # 窗口创建 + IPC 注册
├── preload.cjs          # contextBridge 暴露 API
├── ipc/                 # IPC 处理器（settings, workspace, project, cancel）
├── ai/                  # AI 客户端（SSE 流式 + tool-use agent + CLI agent）
└── assets/              # Font Awesome 离线注入
```

## 🤝 贡献

参见项目根目录的 [CLAUDE.md](./CLAUDE.md) 了解详细架构和开发命令。

## 📄 许可证

本项目未明确许可证，保留所有权利。
