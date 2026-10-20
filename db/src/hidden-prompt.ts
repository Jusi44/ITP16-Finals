import { stdin as processStdin, stdout as processStdout } from 'node:process';

export interface PasswordInputOptions {
  env?: NodeJS.ProcessEnv;
  stdin?: Pick<NodeJS.ReadStream, 'isTTY'>;
}

export async function readPasswordInput(options: PasswordInputOptions = {}): Promise<string> {
  const env = options.env ?? process.env;
  const input = options.stdin ?? processStdin;
  const configured = env.SET_PASSWORD;

  if (configured !== undefined && configured !== '') {
    return configured;
  }

  if (!input.isTTY) {
    throw new Error('SET_PASSWORD is not set and stdin is not an interactive terminal.');
  }

  return promptHidden('New password: ');
}

export async function promptHidden(prompt: string): Promise<string> {
  if (!processStdin.isTTY) {
    throw new Error('An interactive terminal is required for the hidden prompt.');
  }

  processStdout.write(prompt);
  processStdin.setRawMode(true);
  processStdin.resume();
  processStdin.setEncoding('utf8');

  return new Promise<string>((resolve, reject) => {
    let value = '';

    const cleanup = (): void => {
      processStdin.setRawMode(false);
      processStdin.pause();
      processStdin.removeListener('data', onData);
    };

    const onData = (chunk: string): void => {
      for (const character of chunk) {
        if (character === '\r' || character === '\n') {
          cleanup();
          processStdout.write('\n');
          resolve(value);
          return;
        }

        if (character === '\u0003') {
          cleanup();
          processStdout.write('\n');
          reject(new Error('Cancelled.'));
          return;
        }

        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
          continue;
        }

        value += character;
      }
    };

    processStdin.on('data', onData);
  });
}
