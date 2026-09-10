/** Render de plantillas de notificación: `{{clave}}` → valor. Texto fuera del código. */
export function renderTemplate(
  template: string,
  vars: Record<string, unknown>,
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key];
    return value == null ? '' : String(value);
  });
}
