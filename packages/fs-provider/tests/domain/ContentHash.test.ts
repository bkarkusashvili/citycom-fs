import { ContentHash } from '../../src/domain/value-objects/ContentHash';

describe('ContentHash', () => {
  describe('fromContent', () => {
    it('should create hash from string content', () => {
      const hash = ContentHash.fromContent('hello world');
      expect(hash.value).toHaveLength(64);
      expect(hash.value).toBe(
        'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
      );
    });

    it('should create hash from buffer content', () => {
      const buffer = Buffer.from('hello world', 'utf-8');
      const hash = ContentHash.fromContent(buffer);
      expect(hash.value).toBe(
        'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
      );
    });

    it('should produce different hashes for different content', () => {
      const hash1 = ContentHash.fromContent('hello');
      const hash2 = ContentHash.fromContent('world');
      expect(hash1.value).not.toBe(hash2.value);
    });

    it('should produce same hash for same content', () => {
      const hash1 = ContentHash.fromContent('same content');
      const hash2 = ContentHash.fromContent('same content');
      expect(hash1.value).toBe(hash2.value);
    });
  });

  describe('fromHash', () => {
    it('should create from valid hash string', () => {
      const validHash = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
      const hash = ContentHash.fromHash(validHash);
      expect(hash.value).toBe(validHash);
    });

    it('should normalize to lowercase', () => {
      const upperHash = 'B94D27B9934D3E08A52E52D7DA7DABFAC484EFE37A5380EE9088F7ACE2EFCDE9';
      const hash = ContentHash.fromHash(upperHash);
      expect(hash.value).toBe(upperHash.toLowerCase());
    });

    it('should throw for invalid hash', () => {
      expect(() => ContentHash.fromHash('invalid')).toThrow('Invalid SHA-256');
      expect(() => ContentHash.fromHash('zzzz'.repeat(16))).toThrow('Invalid SHA-256');
    });
  });

  describe('isValidHash', () => {
    it('should return true for valid hash', () => {
      const validHash = 'a'.repeat(64);
      expect(ContentHash.isValidHash(validHash)).toBe(true);
    });

    it('should return false for invalid length', () => {
      expect(ContentHash.isValidHash('a'.repeat(63))).toBe(false);
      expect(ContentHash.isValidHash('a'.repeat(65))).toBe(false);
    });

    it('should return false for invalid characters', () => {
      const invalidHash = 'z'.repeat(64);
      expect(ContentHash.isValidHash(invalidHash)).toBe(false);
    });
  });

  describe('equals', () => {
    it('should return true for equal hashes', () => {
      const hash1 = ContentHash.fromContent('test');
      const hash2 = ContentHash.fromContent('test');
      expect(hash1.equals(hash2)).toBe(true);
    });

    it('should return false for different hashes', () => {
      const hash1 = ContentHash.fromContent('test1');
      const hash2 = ContentHash.fromContent('test2');
      expect(hash1.equals(hash2)).toBe(false);
    });
  });
});
