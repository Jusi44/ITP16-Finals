export function getDatabaseName(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  return decodeURIComponent(url.pathname.replace(/^\//, ''));
}

export function assertTestDatabase(
  databaseUrl: string,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string {
  if (nodeEnv === 'production') {
    throw new Error('Refusing to use the test database helper when NODE_ENV=production.');
  }

  const databaseName = getDatabaseName(databaseUrl);

  if (!databaseName.endsWith('_test')) {
    throw new Error('Refusing to use a database whose name does not end in _test.');
  }

  return databaseName;
}
