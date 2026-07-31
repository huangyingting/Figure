export function formatGeneratedDate(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid Date";

  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
}
