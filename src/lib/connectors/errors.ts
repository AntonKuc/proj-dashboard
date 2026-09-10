export class ConnectorNotConfiguredError extends Error {
  constructor(connector: string, missingEnvVars: string[]) {
    super(
      `${connector}: не настроен. Задай переменные окружения: ${missingEnvVars.join(", ")}.`,
    );
    this.name = "ConnectorNotConfiguredError";
  }
}

export function requireEnv(...names: string[]): Record<string, string> {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length > 0) {
    throw new ConnectorNotConfiguredError("connector", missing);
  }
  return Object.fromEntries(names.map((n) => [n, process.env[n] as string]));
}
