import { passwordSchema } from '../schemas';
import { PasswordStrengthDescription, PasswordStrengthResult } from '../types';

export class PasswordStrengthMeter {
  private static readonly MIN_LENGTH = 8;
  private static readonly KEYBOARD_PATTERNS = [
    'qwerty',
    'asdfgh',
    'zxcvbn',
    '123456',
    'qazwsx',
  ];
  private static readonly COMMON_PASSWORDS = [
    'password',
    'password123',
    '123456',
    'qwerty',
    'admin',
    'letmein',
    'welcome',
    'monkey',
    'password1',
    'abc123',
    'passw0rd',
    'login',
    'secret',
  ];

  /**
   * Analyzes the strength of a password comprehensively.
   * @param password - The password to evaluate.
   * @returns A detailed strength analysis result.
   */
  public static analyze(password: string): PasswordStrengthResult {
    const validationResult = passwordSchema.safeParse(password);
    const feedback: string[] = [];
    let score = 0;

    if (!validationResult.success) {
      const zodErrors = validationResult.error.issues.map((e) => e.message);
      feedback.push(...zodErrors);
    } else {
      score = 3;
    }

    if (this.COMMON_PASSWORDS.includes(password.toLowerCase())) {
      feedback.push('Avoid using common passwords.');
    } else if (validationResult.success) {
      score++;
    }

    if (this.hasKeyboardPattern(password)) {
      feedback.push('Avoid using simple keyboard patterns.');
    }

    const isStrong =
      validationResult.success &&
      !this.COMMON_PASSWORDS.includes(password.toLowerCase());

    return {
      score: Math.min(score, 4),
      feedback,
      isStrong,
    };
  }

  /**
   *
   * @param password The password to check.
   * @returns True if a keyboard pattern is found, otherwise false.
   */
  private static hasKeyboardPattern(password: string): boolean {
    const lowerPassword = password.toLowerCase();

    return this.KEYBOARD_PATTERNS.some((pattern) =>
      lowerPassword.includes(pattern)
    );
  }

  /**
   * Provides a human-readable strength description based on a score.
   * @param score - The password strength score (0-4).
   * @returns A string describing the strength level from the enum.
   */
  public static getStrengthDescription(
    score: number
  ): PasswordStrengthDescription {
    const descriptions = [
      PasswordStrengthDescription.VeryWeak,
      PasswordStrengthDescription.Weak,
      PasswordStrengthDescription.Moderate,
      PasswordStrengthDescription.Strong,
      PasswordStrengthDescription.VeryStrong,
    ];

    return descriptions[score] || PasswordStrengthDescription.VeryWeak;
  }

  /**
   * Validates if a password meets the minimum security requiremenets.
   * @param password The password to validate.
   * @throws Error, if password is not strong enough.
   */
  public static validate(password: string): void {
    const analysis = this.analyze(password);

    if (!analysis.isStrong) {
      const errorMessage = [
        'Password does not meet security requirements:',
        ...analysis.feedback,
      ].join('\n  - ');

      throw new Error(errorMessage);
    }
  }
}
