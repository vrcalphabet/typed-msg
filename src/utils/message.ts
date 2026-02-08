export function stringifyMessage(scope: string, name: string) {
  return JSON.stringify({ scope, name });
}
