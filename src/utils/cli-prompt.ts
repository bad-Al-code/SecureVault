import { PasswordStrengthMeter } from './password-strength';

/**
 * Reads a password securely from the terminal, hiding the input.
 * @param isNewVault If true, prompts for a new password wih strenth validation and confirmation.
 * @returns A promise that resolves to the entered password
 */
export async function getPassword(
  isNewVault: boolean = false
): Promise<string> {
  const stdin = process.stdin;
  const stdout = process.stdout;

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      let password = '';
      stdout.write(prompt);
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf-8');

      const onData = (char: string) => {
        switch (char) {
          case '\u0003': // Ctrl+C
            stdout.write('\n');
            process.exit(1);
            break;

          case '\r': // Enter
          case '\n': // Enter
            stdout.write('\n');
            stdin.setRawMode(false);
            stdin.pause();
            stdin.removeListener('data', onData);
            resolve(password);
            break;

          case '\b': // Backspace
          case '\x7f': // Backspace
            if (password.length > 0) {
              password = password.slice(0, -1);
              stdout.write('\b \b');
            }
            break;

          default:
            password += char;
            break;
        }
      };

      stdin.on('data', onData);
    });
  };

  let password: string;
  if (isNewVault) {
    while (true) {
      password = await question('New Vault Password: ');

      try {
        PasswordStrengthMeter.validate(password);

        break;
      } catch (error) {
        console.error(`\n${(error as Error).message}\n`);
      }
    }

    const confirmPassword = await question('Confirm Vault Password: ');
    if (password !== confirmPassword) {
      console.error('✘ Error: Passwords do not match');
      process.exit(1);
    }
  } else {
    password = await question('Vault Password: ');
  }

  return password;
}
