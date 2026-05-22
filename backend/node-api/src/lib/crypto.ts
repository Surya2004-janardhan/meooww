import crypto from 'crypto';

/**
 * Encryption service for securely storing sensitive data like API keys
 * Uses AES-256-GCM encryption with a master key
 */
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

// Get master encryption key from environment or generate a derived key
function getMasterKey(): Buffer {
  const masterKeyEnv = process.env.ENCRYPTION_MASTER_KEY;
  
  if (masterKeyEnv) {
    // If a master key is provided, derive a 32-byte key from it
    return crypto.scryptSync(masterKeyEnv, 'salt', 32);
  }
  
  // Fallback: Use JWT_SECRET if available, or environment variable
  const fallbackKey = process.env.JWT_SECRET || 'default-insecure-key-change-in-production';
  return crypto.scryptSync(fallbackKey, 'salt', 32);
}

export const cryptoService = {
  /**
   * Encrypt a sensitive string (e.g., API key)
   * Returns: base64-encoded string containing IV + encrypted data + auth tag
   */
  encrypt(plaintext: string): string {
    try {
      const masterKey = getMasterKey();
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, masterKey, iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Combine IV + encrypted data + auth tag
      const combined = Buffer.concat([iv, Buffer.from(encrypted, 'hex'), authTag]);
      
      return combined.toString('base64');
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  },

  /**
   * Decrypt a base64-encoded encrypted string
   * Expects format: base64(IV + encrypted data + auth tag)
   */
  decrypt(encryptedBase64: string): string {
    try {
      const masterKey = getMasterKey();
      const combined = Buffer.from(encryptedBase64, 'base64');
      
      const iv = combined.slice(0, IV_LENGTH);
      const authTag = combined.slice(-AUTH_TAG_LENGTH);
      const encrypted = combined.slice(IV_LENGTH, -AUTH_TAG_LENGTH).toString('hex');
      
      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, masterKey, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  },

  /**
   * Hash a value using SHA-256 (for non-recoverable hashing)
   * Useful for storing hashes of API keys for comparison
   */
  hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  },

  /**
   * Generate a secure random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  },
};
