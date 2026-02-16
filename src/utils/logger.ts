const PREFIX = "[mister-maps]";

export function logError(context: string, error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return;

  if (import.meta.env.DEV) {
    // In dev, keep the original error object for stack traces.
    console.error(`${PREFIX} ${context}`, error);
    return;
  }

  // In prod, keep logs concise but still traceable.
  console.warn(`${PREFIX} ${context}`);
}
