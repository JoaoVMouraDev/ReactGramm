import crypto from "crypto";

/**
 * Hash a password using SHA-256
 */
export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/**
 * Validate password strength (minimum 6 characters)
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!password) {
    errors.push("Senha é obrigatória");
  } else if (password.length < 6) {
    errors.push("Senha deve ter no mínimo 6 caracteres");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate username (3-30 characters, alphanumeric and underscore)
 */
export function validateUsername(username: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!username) {
    errors.push("Username é obrigatório");
  } else if (username.length < 3) {
    errors.push("Username deve ter no mínimo 3 caracteres");
  } else if (username.length > 30) {
    errors.push("Username deve ter no máximo 30 caracteres");
  } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push("Username pode conter apenas letras, números e underscore");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
