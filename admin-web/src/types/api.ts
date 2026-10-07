// Shared API envelope types — see SVC-00 §7 (API Response Format).

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  errorCode: string;
  message: string;
  fieldErrors: FieldError[];
  data: { affected?: AffectedRow[] } & Record<string, unknown> | null;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiError;

export interface AffectedRow {
  date: string;
  booked: number;
}

/** Thrown by the api client whenever the gateway responds with success:false. */
export class ApiRequestError extends Error {
  errorCode: string;
  fieldErrors: FieldError[];
  data: { affected?: AffectedRow[] } & Record<string, unknown> | null;
  status: number;

  constructor(status: number, body: ApiError) {
    super(body.message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.errorCode = body.errorCode;
    this.fieldErrors = body.fieldErrors ?? [];
    this.data = body.data ?? null;
  }
}
