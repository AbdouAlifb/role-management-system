export const MENU_DEBUG = true; // set false once fixed

export function dlog(...args: any[]) {
  if (!MENU_DEBUG) return;
  // group logs nicely
  // eslint-disable-next-line no-console
  console.log(...args);
}
export function dwarn(...args: any[]) {
  if (!MENU_DEBUG) return;
  // eslint-disable-next-line no-console
  console.warn(...args);
}
export function derr(...args: any[]) {
  if (!MENU_DEBUG) return;
  // eslint-disable-next-line no-console
  console.error(...args);
}
