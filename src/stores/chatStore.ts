import { create } from "zustand";
import type { Message, Annotation, AISettings, WorkspaceStatus, BoundingBox } from "../types";
import { generateId, DEFAULT_SYSTEM_PROMPT } from "../utils/code";

interface ChatState {
  messages: Message[];
  annotations: Annotation[];
  generatedCode: string | undefined;
  workspaceStatus: WorkspaceStatus;
  workspaceError: string | undefined;
  isStreaming: boolean;
  streamingContent: string;
  generatingAnnotationIds: string[];
  streamCount: number;
  revisionHistory: Record<string, string[]>;

  // Settings
  settings: AISettings;
  settingsOpen: boolean;

  // Actions
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string, code?: string) => void;
  updateStreamingContent: (content: string) => void;
  finishStreaming: () => void;
  setStreaming: (streaming: boolean) => void;
  setWorkspaceStatus: (status: WorkspaceStatus, error?: string) => void;
  setGeneratedCode: (code: string | undefined) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotationText: (id: string, text: string) => void;
  updateAnnotationBounds: (id: string, bounds: Partial<BoundingBox>) => void;
  setAnnotationCode: (id: string, code: string) => void;
  updateAnnotationColor: (id: string, color: string) => void;
  updateAnnotationPromptSize: (id: string, width: string, height: string) => void;
  addGeneratingAnnotationId: (id: string) => void;
  removeGeneratingAnnotationId: (id: string) => void;
  removeAnnotation: (id: string) => void;
  addRevisionEntry: (id: string, prompt: string) => void;
  clearRevisionHistory: (id: string) => void;
  translateChildAnnotations: (parentId: string, dx: number, dy: number) => void;
  scaleChildAnnotations: (parentId: string, oldBounds: BoundingBox, newBounds: BoundingBox) => void;
  clearAnnotations: () => void;
  updateSettings: (settings: Partial<AISettings>) => void;
  persistSettings: () => Promise<void>;
  setSettingsOpen: (open: boolean) => void;
  loadWorkspace: () => Promise<void>;
  reset: () => void;
}

const defaultSettings: AISettings = {
  endpoint: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  agentType: "streaming",
};

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  annotations: [],
  generatedCode: undefined,
  workspaceStatus: "empty",
  workspaceError: undefined,
  isStreaming: false,
  streamingContent: "",
  generatingAnnotationIds: [],
  streamCount: 0,
  revisionHistory: {},
  settings: defaultSettings,
  settingsOpen: false,

  addUserMessage: (content) => {
    const msg: Message = {
      id: generateId(),
      role: "user",
      content,
      timestamp: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, msg] }));
  },

  addAssistantMessage: (content, code) => {
    const msg: Message = {
      id: generateId(),
      role: "assistant",
      content,
      code,
      timestamp: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, msg] }));
  },

  updateStreamingContent: (content) => {
    set({ streamingContent: content });
  },

  setStreaming: (start) => set((s) => {
    const newCount = start ? s.streamCount + 1 : Math.max(0, s.streamCount - 1);
    return { streamCount: newCount, isStreaming: newCount > 0 };
  }),

  finishStreaming: () => set((s) => {
    const newCount = Math.max(0, s.streamCount - 1);
    return {
      streamCount: newCount,
      isStreaming: newCount > 0,
      streamingContent: newCount === 0 ? "" : s.streamingContent,
    };
  }),

  setWorkspaceStatus: (status, error) =>
    set({ workspaceStatus: status, workspaceError: error }),

  setGeneratedCode: (code) => set({ generatedCode: code }),

  addAnnotation: (annotation) =>
    set((s) => {
      // Reject rect annotations with zero or tiny dimensions
      if (annotation.type === "rect" && annotation.boundingBox) {
        const { width, height } = annotation.boundingBox;
        if (!width || !height || width < 100 || height < 100) {
          console.warn("Rejected rect annotation with invalid dimensions:", width, height);
          return s;
        }
      }
      return { annotations: [...s.annotations, annotation] };
    }),

  updateAnnotationText: (id, text) =>
    set((s) => ({
      annotations: s.annotations.map((a) =>
        a.id === id ? { ...a, text } : a,
      ),
    })),
  updateAnnotationBounds: (id, bounds) =>
    set((s) => ({
      annotations: s.annotations.map((a) =>
        a.id === id && a.boundingBox
          ? { ...a, boundingBox: { ...a.boundingBox, ...bounds } }
          : a,
      ),
    })),
  setAnnotationCode: (id, code) =>
    set((s) => ({
      annotations: s.annotations.map((a) =>
        a.id === id ? { ...a, generatedCode: code } : a,
      ),
    })),
  updateAnnotationColor: (id, color) =>
    set((s) => ({
      annotations: s.annotations.map((a) =>
        a.id === id ? { ...a, color } : a,
      ),
    })),
  updateAnnotationPromptSize: (id, width, height) =>
    set((s) => ({
      annotations: s.annotations.map((a) =>
        a.id === id ? { ...a, promptWidth: width, promptHeight: height } : a,
      ),
    })),
  addGeneratingAnnotationId: (id) => set((s) => ({
    generatingAnnotationIds: [...s.generatingAnnotationIds, id],
  })),
  removeGeneratingAnnotationId: (id) => set((s) => ({
    generatingAnnotationIds: s.generatingAnnotationIds.filter((i) => i !== id),
  })),
  removeAnnotation: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.revisionHistory;
      return {
        annotations: s.annotations.filter((a) => a.id !== id && a.parentId !== id),
        revisionHistory: rest,
      };
    }),
  addRevisionEntry: (id, prompt) => set((s) => ({
    revisionHistory: {
      ...s.revisionHistory,
      [id]: [...(s.revisionHistory[id] || []), prompt],
    },
  })),
  clearRevisionHistory: (id) => set((s) => {
    const { [id]: _, ...rest } = s.revisionHistory;
    return { revisionHistory: rest };
  }),
  translateChildAnnotations: (parentId: string, dx: number, dy: number) =>
    set((s) => ({
      annotations: s.annotations.map((a) => {
        if (a.parentId !== parentId) return a;
        return {
          ...a,
          points: a.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
          boundingBox: a.boundingBox
            ? {
                ...a.boundingBox,
                x: a.boundingBox.x + dx,
                y: a.boundingBox.y + dy,
              }
            : undefined,
        };
      }),
    })),
  scaleChildAnnotations: (parentId: string, oldBounds: BoundingBox, newBounds: BoundingBox) =>
    set((s) => {
      const sx = newBounds.width / oldBounds.width;
      const sy = newBounds.height / oldBounds.height;
      return {
        annotations: s.annotations.map((a) => {
          if (a.parentId !== parentId) return a;
          return {
            ...a,
            points: a.points.map((p) => ({
              x: newBounds.x + (p.x - oldBounds.x) * sx,
              y: newBounds.y + (p.y - oldBounds.y) * sy,
            })),
            boundingBox: a.boundingBox
              ? {
                  x: newBounds.x + (a.boundingBox.x - oldBounds.x) * sx,
                  y: newBounds.y + (a.boundingBox.y - oldBounds.y) * sy,
                  width: a.boundingBox.width * sx,
                  height: a.boundingBox.height * sy,
                }
              : undefined,
          };
        }),
      };
    }),

  clearAnnotations: () => set({ annotations: [] }),

  updateSettings: (partial) =>
    set((s) => ({ settings: { ...s.settings, ...partial } })),

  persistSettings: async () => {
    const { settings } = get();
    try {
      await window.electronAPI.settings.save({
        endpoint: settings.endpoint,
        api_key: settings.apiKey,
        model: settings.model,
        system_prompt: settings.systemPrompt,
        agent_type: settings.agentType,
        agent_command: settings.agentCommand ?? null,
        agent_args_template: settings.agentArgsTemplate ?? null,
      });
    } catch (e) {
      console.error("Failed to persist settings:", e);
    }
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),

  loadWorkspace: async () => {
    try {
      const data = await window.electronAPI.workspace.load() as {
        annotations: Annotation[];
        messages: Message[];
        generatedCode: string | null;
        revisionHistory?: Record<string, string[]>;
      } | null;
      if (data) {
        set({
          annotations: data.annotations,
          messages: data.messages,
          generatedCode: data.generatedCode ?? undefined,
          revisionHistory: data.revisionHistory ?? {},
          workspaceStatus: data.annotations.length > 0 ? "ready" : "empty",
        });
      }
    } catch (e) {
      console.error("Failed to load workspace:", e);
    }
  },

  reset: () => {
    window.electronAPI.workspace.clearTemp().catch(() => {});
    window.electronAPI.workspace.save({
      annotations: [], messages: [], generatedCode: null, revisionHistory: {}, updatedAt: Date.now(),
    }).catch(() => {});
    set({
      messages: [],
      annotations: [],
      generatedCode: undefined,
      workspaceStatus: "empty",
      workspaceError: undefined,
      isStreaming: false,
      streamingContent: "",
      generatingAnnotationIds: [],
      streamCount: 0,
    });
  },
}));

// ── Auto-persist ──────────────────────────────────────────────

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const s = useChatStore.getState();
    // Don't persist while streaming — wait for completion
    if (s.isStreaming) {
      schedulePersist();
      return;
    }
    window.electronAPI.workspace.save({
      annotations: s.annotations,
      messages: s.messages,
      generatedCode: s.generatedCode ?? null,
      revisionHistory: s.revisionHistory,
      updatedAt: Date.now(),
    }).catch((e) => console.error("Auto-save failed:", e));
  }, 800);
}

/** Start auto-persisting workspace state on every change. Call once on app mount. */
export function startAutoPersist() {
  useChatStore.subscribe(() => {
    schedulePersist();
  });
}

/**
 * Save workspace immediately (no debounce). Useful for shutdown/save-on-demand.
 */
export function saveWorkspaceNow() {
  const s = useChatStore.getState();
  window.electronAPI.workspace.save({
    annotations: s.annotations,
    messages: s.messages,
    generatedCode: s.generatedCode ?? null,
    revisionHistory: s.revisionHistory,
    updatedAt: Date.now(),
  }).catch((e) => console.error("Save failed:", e));
}

/** Load workspace state from disk. Call once on app mount. */
export async function loadSavedWorkspace() {
  await useChatStore.getState().loadWorkspace();
}
