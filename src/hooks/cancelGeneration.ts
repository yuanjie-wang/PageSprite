import { invoke } from "@tauri-apps/api/core";
import { useChatStore } from "../stores/chatStore";

/** Cancel an active per-rect generation. Kills the CLI process or aborts the HTTP request. */
export function cancelGeneration(annotationId: string) {
  invoke("cancel_generation", { id: annotationId }).catch(() => {});
  useChatStore.getState().removeGeneratingAnnotationId(annotationId);
}
