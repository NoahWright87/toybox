/**
 * Token interpolation — fills `{playerName}`-style placeholders at runtime.
 * Missing tokens are left as the literal `{token}` text rather than
 * throwing, matching the "missing key never throws" rule for the rest of
 * the content layer.
 */
export function interpolate(
  template: string,
  tokens?: Record<string, string | number>
): string {
  if (!tokens) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = tokens[name];
    return value === undefined ? match : String(value);
  });
}
