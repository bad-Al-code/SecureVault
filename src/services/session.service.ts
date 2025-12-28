import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { SessionData } from '../types';
import { ConfigService } from './config.service';

export class SessionService {
  private static readonly HOME_DIR = os.homedir();
  private static readonly VAULT_DIR = path.join(
    SessionService.HOME_DIR,
    '.vault'
  );
  private static readonly SESSIONS_DIR = path.join(
    SessionService.VAULT_DIR,
    'sessions'
  );

  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 Minutes

  private static readonly OBFUSCATION_KEY = 'vault-session-key';
  private static readonly OBFUSCATION_ALGO = 'aes-256-cbc';

  /**
   * Retrieves valid passwords from the active session.
   * Returns an empty array if the session does not exist
   * or has expired.
   * @returns Decrypted passwords
   */
  public static async getActivePasswords(): Promise<string[]> {
    const session = await this.readSession();

    const config = await ConfigService.get();
    const ttl = config.sessionTimeout || this.DEFAULT_TTL;

    if (!session || this.isExpired(session, ttl)) {
      await this.clearSession();
      return [];
    }

    await this.updateTimestamp(session);

    return session.passwords.map(this.deobfuscate.bind(this));
  }

  /**
   * Adds a password to the current session keyring.
   * @param password The password to add
   */
  public static async addPassword(password: string): Promise<void> {
    const currentPasswords = await this.getActivePasswords();

    if (currentPasswords.includes(password)) {
      const session = await this.readSession();
      if (session) {
        await this.updateTimestamp(session);
      }

      return;
    }

    const session: SessionData = {
      passwords: [...currentPasswords, password].map(this.obfuscate.bind(this)),
      lastUsed: Date.now(),
    };

    await this.writeSession(session);
  }

  /**
   * Clears the current session (logout).
   */
  public static async clearSession(): Promise<void> {
    try {
      await fs.unlink(this.getSessionFilePath());
    } catch {
      // Ignore
    }
  }

  /**
   * Generates a unique session key based on
   * the Shell (PPID) and Project Path (CWD).
   * @returns {string} Unique session identifier
   */
  private static getSessionId(): string {
    return crypto
      .createHash('sha256')
      .update(process.ppid.toString() + process.cwd())
      .digest('hex');
  }

  /**
   * Returns the absolute path of the current session file.
   * @returns Session file path
   */
  private static getSessionFilePath(): string {
    return path.join(this.SESSIONS_DIR, `${this.getSessionId()}.json`);
  }

  /**
   * Reads and parses the current session file.
   * @returns Returns null if the session does not exist or is invalid.
   */
  private static async readSession(): Promise<SessionData | null> {
    try {
      const content = await fs.readFile(this.getSessionFilePath(), 'utf-8');

      return JSON.parse(content) as SessionData;
    } catch {
      return null;
    }
  }

  /**
   * Checks whether a session has expired based on TTL.
   * @param session The session object
   * @returns True if the session is expired
   */
  private static isExpired(session: SessionData, ttl: number): boolean {
    return Date.now() - session.lastUsed > ttl;
  }

  /**
   * Updates the last-used timestamp of a session
   * and persists it to disk.
   * @param session The session to update
   */
  private static async updateTimestamp(session: SessionData): Promise<void> {
    session.lastUsed = Date.now();
    await this.writeSession(session);
  }

  /**
   * Writes a session object to disk.
   * @param session The session to persist
   */
  private static async writeSession(session: SessionData): Promise<void> {
    await fs.mkdir(this.SESSIONS_DIR, { recursive: true });

    await fs.writeFile(this.getSessionFilePath(), JSON.stringify(session), {
      encoding: 'utf-8',
      mode: 0o600,
    });
  }

  /**
   * Encrypts a plaintext value before storing it.
   * @param text Plain text value
   * @returns Encrypted value (iv:hex)
   */
  private static obfuscate(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.OBFUSCATION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv(this.OBFUSCATION_ALGO, key, iv);

    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypts a previously obfuscated value.
   * @param text Encrypted value
   * @returns Decrypted plaintext
   */
  private static deobfuscate(text: string): string {
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    const key = crypto.scryptSync(this.OBFUSCATION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv(this.OBFUSCATION_ALGO, key, iv);

    const decrypted = Buffer.concat([
      decipher.update(encryptedText),
      decipher.final(),
    ]);

    return decrypted.toString();
  }
}
