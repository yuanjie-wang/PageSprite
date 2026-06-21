interface ElectronAPI {
  settings: {
    load: () => Promise<{
      endpoint: string;
      api_key: string;
      model: string;
      system_prompt: string;
      agent_type?: string;
      agent_command?: string | null;
      agent_args_template?: string | null;
    }>;
    save: (settings: Record<string, unknown>) => Promise<void>;
  };
  workspace: {
    load: () => Promise<Record<string, unknown> | null>;
    save: (data: Record<string, unknown>) => Promise<void>;
    clearTemp: () => Promise<void>;
  };
  project: {
    save: (data: Record<string, unknown>) => Promise<void>;
    load: () => Promise<Record<string, unknown>>;
  };
  agent: {
    generate: (config: Record<string, unknown>, settings: Record<string, unknown>) => Promise<string>;
    prepareWorkDir: (rectId: string, existingCode: string | null) => Promise<void>;
    checkInstalled: (command: string) => Promise<boolean>;
  };
  cancel: {
    cancel: (id: string) => Promise<void>;
  };
  assets: {
    getFontAwesomeCSS: () => Promise<string>;
  };
  onProgress: (callback: (data: { rectId: string; type: "stdout" | "stderr"; text: string }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
