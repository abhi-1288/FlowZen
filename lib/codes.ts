import { randomBytes } from "crypto";

export function createJoinCode(prefix = "TV") {
  return `${prefix}-${randomBytes(5).toString("base64url").toUpperCase()}`;
}

export function createRoleJoinCode(baseCode: string, digits = 2) {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  const suffix = Math.floor(min + Math.random() * (max - min + 1));
  return `${baseCode}-${suffix}`;
}

export function createTemporaryPassword() {
  const suffix = Math.floor(100 + Math.random() * 900);
  return `pass@#${suffix}`;
}
