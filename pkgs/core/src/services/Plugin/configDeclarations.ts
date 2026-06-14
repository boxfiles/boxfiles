export function assertPluginDeclarationId(
  id: string,
  createError: (message: string) => Error,
): void {
  if (id.trim().length > 0) return;
  throw createError("Plugin id must be non-empty.");
}

export function omitPluginDeclaration(
  plugins: Readonly<Record<string, string>>,
  id: string,
): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.entries(plugins).filter(([pluginId]) => pluginId !== id));
}
