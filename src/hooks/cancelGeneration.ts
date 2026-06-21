import { useChatStore } from "../stores/chatStore";

/** Cancel an active per-rect generation. Kills the CLI process or aborts the HTTP request. */
export function cancelGeneration(annotationId: string) {
  window.electronAPI.cancel.cancel(annotationId).catch(() => {});
  useChatStore.getState().removeGeneratingAnnotationId(annotationId);
}
