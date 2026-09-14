import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Basale wachtwoordbeleid-check. Bewust eenvoudig gehouden voor de MVP.
export function isPasswordStrongEnough(plain: string): boolean {
  return typeof plain === "string" && plain.length >= 10;
}
