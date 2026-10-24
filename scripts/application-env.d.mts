export type ApplicationEnvironment = Readonly<Record<string, string | undefined>>;

export function readApplicationEnv(directory?: string): ApplicationEnvironment;
export function loadApplicationEnv(
  directory?: string,
  target?: Record<string, string | undefined>,
): ApplicationEnvironment;
