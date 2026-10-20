export const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,32}$/;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const PLACEHOLDER_PASSWORDS = new Set([
  'change_me',
  'changeme',
  'local_dev_only_change_me',
  'password',
  'replace_me',
  'replace_with_at_least_32_random_characters',
]);

export function validateUsername(username: string): string {
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error(
      `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters and match [A-Za-z0-9_.-].`,
    );
  }

  return username;
}

export function validatePassword(password: string): string {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new Error(`Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters.`);
  }

  if (PLACEHOLDER_PASSWORDS.has(password.trim().toLowerCase())) {
    throw new Error('Password must not be a known placeholder value.');
  }

  return password;
}

export function isPlaceholderPassword(password: string): boolean {
  return PLACEHOLDER_PASSWORDS.has(password.trim().toLowerCase());
}
