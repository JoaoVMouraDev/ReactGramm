import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  validateEmail,
  validateUsername,
} from "./auth";

describe("Password Hashing", () => {
  it("should hash a password", () => {
    const password = "myPassword123";
    const hash = hashPassword(password);
    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.length).toBe(64); // SHA-256 hex is 64 chars
  });

  it("should verify a correct password", () => {
    const password = "myPassword123";
    const hash = hashPassword(password);
    expect(verifyPassword(password, hash)).toBe(true);
  });

  it("should not verify an incorrect password", () => {
    const password = "myPassword123";
    const wrongPassword = "wrongPassword";
    const hash = hashPassword(password);
    expect(verifyPassword(wrongPassword, hash)).toBe(false);
  });

  it("should produce consistent hashes for the same password", () => {
    const password = "myPassword123";
    const hash1 = hashPassword(password);
    const hash2 = hashPassword(password);
    expect(hash1).toBe(hash2);
  });
});

describe("Password Validation", () => {
  it("should validate a strong password", () => {
    const result = validatePasswordStrength("MyPassword123");
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject a password shorter than 6 characters", () => {
    const result = validatePasswordStrength("pass");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Senha deve ter no mínimo 6 caracteres");
  });

  it("should reject an empty password", () => {
    const result = validatePasswordStrength("");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Senha é obrigatória");
  });

  it("should accept a password with exactly 6 characters", () => {
    const result = validatePasswordStrength("pass12");
    expect(result.isValid).toBe(true);
  });
});

describe("Email Validation", () => {
  it("should validate a correct email", () => {
    expect(validateEmail("user@example.com")).toBe(true);
  });

  it("should reject an email without @", () => {
    expect(validateEmail("userexample.com")).toBe(false);
  });

  it("should reject an email without domain", () => {
    expect(validateEmail("user@")).toBe(false);
  });

  it("should reject an email without local part", () => {
    expect(validateEmail("@example.com")).toBe(false);
  });

  it("should validate emails with multiple dots", () => {
    expect(validateEmail("user.name@example.co.uk")).toBe(true);
  });
});

describe("Username Validation", () => {
  it("should validate a correct username", () => {
    const result = validateUsername("john_doe");
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject a username shorter than 3 characters", () => {
    const result = validateUsername("ab");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Username deve ter no mínimo 3 caracteres");
  });

  it("should reject a username longer than 30 characters", () => {
    const result = validateUsername("a".repeat(31));
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Username deve ter no máximo 30 caracteres");
  });

  it("should reject a username with invalid characters", () => {
    const result = validateUsername("john-doe");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Username pode conter apenas letras, números e underscore"
    );
  });

  it("should accept a username with numbers and underscores", () => {
    const result = validateUsername("john_doe123");
    expect(result.isValid).toBe(true);
  });

  it("should reject an empty username", () => {
    const result = validateUsername("");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Username é obrigatório");
  });
});
