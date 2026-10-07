export function FieldErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="field-error">{message}</span>;
}
