export type MoneyString = string;

const MONEY_PATTERN = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;

export function assertMoneyString(value: string): MoneyString {
  if (!MONEY_PATTERN.test(value)) {
    throw new Error('Money values must be non-negative decimal strings with at most 2 decimals.');
  }

  return value;
}
