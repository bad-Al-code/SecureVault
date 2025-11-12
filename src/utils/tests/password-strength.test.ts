import { describe, expect, it } from 'vitest';

import { PasswordStrengthDescription } from '../../core';
import { PasswordStrengthMeter } from '../password-strength';

describe('PasswordStrengthMeter', () => {
  describe('analyze', () => {
    describe('Length validation', () => {
      it('should identify a password that is too short', () => {
        const result = PasswordStrengthMeter.analyze('short');
        expect(result.isStrong).toBe(false);
        expect(result.feedback).toContain(
          'Password must be at least 8 characters long.'
        );
      });

      it('should reject empty string', () => {
        const result = PasswordStrengthMeter.analyze('');
        expect(result.isStrong).toBe(false);
        expect(result.feedback).toContain(
          'Password must be at least 8 characters long.'
        );
      });

      it('should accept password with exactly 8 characters', () => {
        const result = PasswordStrengthMeter.analyze('Pass123!');
        expect(result.feedback).not.toContain(
          'Password must be at least 8 characters long.'
        );
      });

      it('should accept very long passwords', () => {
        const result = PasswordStrengthMeter.analyze(
          'VeryL0ng!Password123WithManyCharacters@#$'
        );
        expect(result.feedback).not.toContain(
          'Password must be at least 8 characters long.'
        );
      });
    });

    describe('Common passwords detection', () => {
      it('should identify a common password', () => {
        const result = PasswordStrengthMeter.analyze('password123');
        expect(result.isStrong).toBe(false);
        expect(result.feedback).toContain('Avoid using common passwords.');
      });

      it('should identify common password regardless of case', () => {
        const result = PasswordStrengthMeter.analyze('PASSWORD');
        expect(result.isStrong).toBe(false);
        expect(result.feedback).toContain('Avoid using common passwords.');
      });

      it('should identify "admin" as common password', () => {
        const result = PasswordStrengthMeter.analyze('admin');
        expect(result.isStrong).toBe(false);
        expect(result.feedback).toContain('Avoid using common passwords.');
      });

      it('should identify "QWERTY" in uppercase as common password', () => {
        const result = PasswordStrengthMeter.analyze('QWERTY');
        expect(result.isStrong).toBe(false);
        expect(result.feedback).toContain('Avoid using common passwords.');
      });

      it('should identify "letmein" as common password', () => {
        const result = PasswordStrengthMeter.analyze('letmein');
        expect(result.isStrong).toBe(false);
      });

      it('should identify "welcome" as common password', () => {
        const result = PasswordStrengthMeter.analyze('welcome');
        expect(result.isStrong).toBe(false);
      });

      it('should identify "monkey" as common password', () => {
        const result = PasswordStrengthMeter.analyze('monkey');
        expect(result.isStrong).toBe(false);
      });
    });

    describe('Keyboard pattern detection', () => {
      it('should identify a keyboard pattern', () => {
        const result = PasswordStrengthMeter.analyze('!@#qwerty123');
        expect(result.feedback).toContain(
          'Avoid using simple keyboard patterns.'
        );
      });

      it('should detect "asdfgh" keyboard pattern', () => {
        const result = PasswordStrengthMeter.analyze('Pass!1asdfgh');
        expect(result.feedback).toContain(
          'Avoid using simple keyboard patterns.'
        );
      });

      it('should detect "zxcvbn" keyboard pattern', () => {
        const result = PasswordStrengthMeter.analyze('Secure1!zxcvbn');
        expect(result.feedback).toContain(
          'Avoid using simple keyboard patterns.'
        );
      });

      it('should detect "123456" pattern', () => {
        const result = PasswordStrengthMeter.analyze('Pass!123456');
        expect(result.feedback).toContain(
          'Avoid using simple keyboard patterns.'
        );
      });

      it('should detect "qazwsx" keyboard pattern', () => {
        const result = PasswordStrengthMeter.analyze('Qazwsx!123');
        expect(result.feedback).toContain(
          'Avoid using simple keyboard patterns.'
        );
      });

      it('should detect keyboard pattern in middle of password', () => {
        const result = PasswordStrengthMeter.analyze('Pass!qwerty99');
        expect(result.feedback).toContain(
          'Avoid using simple keyboard patterns.'
        );
      });

      it('should detect keyboard pattern with mixed case', () => {
        const result = PasswordStrengthMeter.analyze('QWERTY!12Ab');
        expect(result.feedback).toContain(
          'Avoid using simple keyboard patterns.'
        );
      });
    });

    describe('Character requirements', () => {
      it('should require an uppercase letter', () => {
        const result = PasswordStrengthMeter.analyze('nouppercase!1');
        expect(result.isStrong).toBe(false);
        expect(result.feedback).toContain(
          'Password must contain at least one uppercase letter.'
        );
      });

      it('should require a lowercase letter', () => {
        const result = PasswordStrengthMeter.analyze('NOLOWERCASE!1');
        expect(result.isStrong).toBe(false);
        expect(result.feedback).toContain(
          'Password must contain at least one lowercase letter.'
        );
      });

      it('should require a number', () => {
        const result = PasswordStrengthMeter.analyze('NoNumberHere!');
        expect(result.isStrong).toBe(false);
        expect(result.feedback).toContain(
          'Password must contain at least one number.'
        );
      });

      it('should require a special character', () => {
        const result = PasswordStrengthMeter.analyze('NoSpecialChar1');
        expect(result.isStrong).toBe(false);
        expect(result.feedback).toContain(
          'Password must contain at least one special character.'
        );
      });

      it('should accept various special characters', () => {
        const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'];
        specialChars.forEach((char) => {
          const result = PasswordStrengthMeter.analyze(`Pass123${char}word`);
          expect(result.feedback).not.toContain(
            'Password must contain at least one special character.'
          );
        });
      });
    });

    describe('Multiple validation failures', () => {
      it('should list all validation errors for completely invalid password', () => {
        const result = PasswordStrengthMeter.analyze('short');
        expect(result.isStrong).toBe(false);
        expect(result.feedback.length).toBeGreaterThan(1);
      });

      it('should combine length and uppercase errors', () => {
        const result = PasswordStrengthMeter.analyze('no!123');
        expect(result.isStrong).toBe(false);
        expect(result.feedback).toContain(
          'Password must be at least 8 characters long.'
        );
        expect(result.feedback).toContain(
          'Password must contain at least one uppercase letter.'
        );
      });

      it('should show all character requirement errors', () => {
        const result = PasswordStrengthMeter.analyze('password');
        expect(result.isStrong).toBe(false);
        expect(result.feedback.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('Score calculation', () => {
      it('should have score of 0 for invalid password', () => {
        const result = PasswordStrengthMeter.analyze('weak');
        expect(result.score).toBe(0);
      });

      it('should have score of 4 for valid password (even if not in common list)', () => {
        const result = PasswordStrengthMeter.analyze('Password1!');
        expect(result.score).toBe(4);
      });

      it('should have score of 4 for strong password', () => {
        const result = PasswordStrengthMeter.analyze('S3cure&V@lidP@ss!');
        expect(result.score).toBe(4);
      });

      it('should cap score at 4', () => {
        const result = PasswordStrengthMeter.analyze(
          'SuperStr0ng!Pass@Word#123'
        );
        expect(result.score).toBeLessThanOrEqual(4);
      });

      it('should handle password with keyboard pattern in score', () => {
        const result = PasswordStrengthMeter.analyze('Pass1!qwerty');
        // Should still get base score even with pattern warning
        expect(result.score).toBeGreaterThanOrEqual(3);
      });
    });

    describe('Strong password validation', () => {
      it('should approve a strong and valid password', () => {
        const result = PasswordStrengthMeter.analyze('S3cure&V@lidP@ss!');
        expect(result.isStrong).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(4);
        expect(result.feedback).toHaveLength(0);
      });

      it('should approve password with all requirements met', () => {
        const result = PasswordStrengthMeter.analyze('MyP@ssw0rd');
        expect(result.isStrong).toBe(true);
      });

      it('should mark password as not strong if it is an exact match to common password', () => {
        const result = PasswordStrengthMeter.analyze('password1');
        expect(result.isStrong).toBe(false);
        expect(result.feedback).toContain('Avoid using common passwords.');
      });

      it('should mark password as not strong if missing requirements', () => {
        const result = PasswordStrengthMeter.analyze('password');
        expect(result.isStrong).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should handle password with only spaces', () => {
        const result = PasswordStrengthMeter.analyze('        ');
        expect(result.isStrong).toBe(false);
      });

      it('should handle password with unicode characters', () => {
        const result = PasswordStrengthMeter.analyze('Pássw0rd!™');
        expect(result.isStrong).toBe(true);
      });

      it('should handle password with repeated characters', () => {
        const result = PasswordStrengthMeter.analyze('Aaaa1111!!!!');
        expect(result.feedback).not.toContain(
          'Password must be at least 8 characters long.'
        );
      });

      it('should handle password that is substring of common password', () => {
        const result = PasswordStrengthMeter.analyze('Pass123!word');
        // Should not match exact common password
        expect(result.isStrong).toBe(true);
      });

      it('should handle numeric string', () => {
        const result = PasswordStrengthMeter.analyze('12345678');
        expect(result.isStrong).toBe(false);
      });

      it('should handle password with tabs and newlines', () => {
        const result = PasswordStrengthMeter.analyze('Pass\t123\n!Aa');
        expect(result.isStrong).toBe(true);
      });
    });
  });

  describe('validate', () => {
    it('should throw an error for a weak password', () => {
      expect(() => PasswordStrengthMeter.validate('weak')).toThrow();
      expect(() => PasswordStrengthMeter.validate('weak')).toThrow(
        /Password does not meet security requirements/
      );
    });

    it('should not throw an error for a strong password', () => {
      expect(() =>
        PasswordStrengthMeter.validate('S3cure&V@lidP@ss!')
      ).not.toThrow();
    });

    it('should throw error with feedback messages', () => {
      expect(() => PasswordStrengthMeter.validate('short')).toThrow(
        /Password must be at least 8 characters long/
      );
    });

    it('should throw error for common password', () => {
      expect(() => PasswordStrengthMeter.validate('password')).toThrow(
        /Avoid using common passwords/
      );
    });

    it('should throw error for password missing uppercase', () => {
      expect(() => PasswordStrengthMeter.validate('password123!')).toThrow(
        /Password must contain at least one uppercase letter/
      );
    });

    it('should throw error for password missing lowercase', () => {
      expect(() => PasswordStrengthMeter.validate('PASSWORD123!')).toThrow(
        /Password must contain at least one lowercase letter/
      );
    });

    it('should throw error for password missing number', () => {
      expect(() => PasswordStrengthMeter.validate('Password!')).toThrow(
        /Password must contain at least one number/
      );
    });

    it('should throw error for password missing special character', () => {
      expect(() => PasswordStrengthMeter.validate('Password123')).toThrow(
        /Password must contain at least one special character/
      );
    });

    it('should not throw for valid non-common password', () => {
      expect(() =>
        PasswordStrengthMeter.validate('MyUn1que!Pass')
      ).not.toThrow();
    });

    it('should throw for empty string', () => {
      expect(() => PasswordStrengthMeter.validate('')).toThrow();
    });
  });

  describe('getStrengthDescription', () => {
    it.each([
      { score: 0, expected: PasswordStrengthDescription.VeryWeak },
      { score: 1, expected: PasswordStrengthDescription.Weak },
      { score: 2, expected: PasswordStrengthDescription.Moderate },
      { score: 3, expected: PasswordStrengthDescription.Strong },
      { score: 4, expected: PasswordStrengthDescription.VeryStrong },
    ])(
      'should return "$expected" for a score of $score',
      ({ score, expected }) => {
        expect(PasswordStrengthMeter.getStrengthDescription(score)).toBe(
          expected
        );
      }
    );

    it('should return VeryWeak for negative scores', () => {
      expect(PasswordStrengthMeter.getStrengthDescription(-1)).toBe(
        PasswordStrengthDescription.VeryWeak
      );
    });

    it('should return VeryWeak for scores greater than 4', () => {
      expect(PasswordStrengthMeter.getStrengthDescription(5)).toBe(
        PasswordStrengthDescription.VeryWeak
      );
      expect(PasswordStrengthMeter.getStrengthDescription(100)).toBe(
        PasswordStrengthDescription.VeryWeak
      );
    });

    it('should return VeryWeak for scores outside valid range', () => {
      // Scores outside 0-4 should default to VeryWeak
      expect(PasswordStrengthMeter.getStrengthDescription(2.5)).toBe(
        PasswordStrengthDescription.VeryWeak
      );
      expect(PasswordStrengthMeter.getStrengthDescription(5)).toBe(
        PasswordStrengthDescription.VeryWeak
      );
    });
  });

  describe('Integration tests', () => {
    it('should provide consistent results between analyze and validate', () => {
      const weakPassword = 'weak';
      const result = PasswordStrengthMeter.analyze(weakPassword);

      if (!result.isStrong) {
        expect(() => PasswordStrengthMeter.validate(weakPassword)).toThrow();
      }
    });

    it('should handle full workflow for strong password', () => {
      const password = 'MyStr0ng!Password';
      const analysis = PasswordStrengthMeter.analyze(password);

      expect(analysis.isStrong).toBe(true);
      expect(() => PasswordStrengthMeter.validate(password)).not.toThrow();

      const description = PasswordStrengthMeter.getStrengthDescription(
        analysis.score
      );
      expect(description).toBe(PasswordStrengthDescription.VeryStrong);
    });

    it('should handle full workflow for weak password', () => {
      const password = 'weak';
      const analysis = PasswordStrengthMeter.analyze(password);

      expect(analysis.isStrong).toBe(false);
      expect(analysis.feedback.length).toBeGreaterThan(0);
      expect(() => PasswordStrengthMeter.validate(password)).toThrow();

      const description = PasswordStrengthMeter.getStrengthDescription(
        analysis.score
      );
      expect(description).toBe(PasswordStrengthDescription.VeryWeak);
    });
  });
});
