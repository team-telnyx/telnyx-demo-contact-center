import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../utils/encryption.js';

describe('Encryption Utilities', () => {
  describe('encrypt/decrypt roundtrip', () => {
    it('should encrypt and decrypt a simple string', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt an empty string', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt a long string', () => {
      const plaintext = 'A'.repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt special characters', () => {
      const plaintext = 'Hello! @#$%^&*() unicode: \u00e9\u00e8\u00ea \u{1F600}';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt JSON strings', () => {
      const plaintext = JSON.stringify({ key: 'value', nested: { arr: [1, 2, 3] } });
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('random IV', () => {
    it('should produce different ciphertexts for the same plaintext', () => {
      const plaintext = 'Same input text';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should still decrypt both to the same plaintext', () => {
      const plaintext = 'Same input text';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });
  });

  describe('tampered ciphertext', () => {
    it('should throw an error when auth tag is tampered', () => {
      const encrypted = encrypt('test data');
      const parts = encrypted.split(':');
      // Tamper with the auth tag by flipping a character
      const tamperedTag = parts[1][0] === 'a' ? 'b' + parts[1].slice(1) : 'a' + parts[1].slice(1);
      const tampered = `${parts[0]}:${tamperedTag}:${parts[2]}`;
      expect(() => decrypt(tampered)).toThrow();
    });

    it('should throw an error when ciphertext is tampered', () => {
      const encrypted = encrypt('test data');
      const parts = encrypted.split(':');
      const tamperedCiphertext = parts[2][0] === 'a' ? 'b' + parts[2].slice(1) : 'a' + parts[2].slice(1);
      const tampered = `${parts[0]}:${parts[1]}:${tamperedCiphertext}`;
      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe('invalid format', () => {
    it('should throw an error for missing parts', () => {
      expect(() => decrypt('onlyonepart')).toThrow('Invalid encrypted text format');
    });

    it('should throw an error for two parts', () => {
      expect(() => decrypt('part1:part2')).toThrow('Invalid encrypted text format');
    });

    it('should throw an error for four parts', () => {
      expect(() => decrypt('part1:part2:part3:part4')).toThrow('Invalid encrypted text format');
    });
  });
});
