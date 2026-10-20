import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function isEntrypoint(moduleUrl: string): boolean {
  const invoked = process.argv[1];
  return invoked !== undefined && resolve(invoked) === fileURLToPath(moduleUrl);
}
