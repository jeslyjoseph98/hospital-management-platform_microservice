export class BusinessError extends Error {
  code: string;
  status: number;
  fieldErrors: { field: string; message: string }[];

  constructor(
    code: string,
    status: number,
    message: string,
    fieldErrors: { field: string; message: string }[] = []
  ) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}
