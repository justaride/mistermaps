type ProviderRequestErrorOptions = {
  providerId: string;
  status?: number;
  code?: string;
  cause?: unknown;
};

export class ProviderRequestError extends Error {
  readonly providerId: string;
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, options: ProviderRequestErrorOptions) {
    super(message);
    this.name = "ProviderRequestError";
    this.providerId = options.providerId;
    this.status = options.status;
    this.code = options.code;
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function isRateLimitError(error: unknown): boolean {
  return error instanceof ProviderRequestError && error.status === 429;
}
