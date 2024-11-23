export async function getPassword(confirm = false): Promise<string> {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const question = (prompt: string): Promise<string> => {
        return new Promise((resolve) => {
            let password = '';

            stdout.write(prompt);

            const listener = (char: string): void => {
                if (char === '\u0003') {
                    stdout.write('\n');
                    process.exit(1);
                }

                if (char === '\b' || char === '\x7f') {
                    if (password.length > 0) {
                        password = password.slice(0, -1);
                        stdout.write('\b \b');
                    }
                    return;
                }

                if (char === '\r' || char === '\n') {
                    stdout.write('\n');
                    stdin.removeListener('data', listener);
                    stdin.setRawMode(false);
                    stdin.pause();
                    resolve(password);
                    return;
                }

                password += char;
                stdout.write('*');
            };

            stdin.on('data', listener);
        });
    };

    const password = await question('New Vault password: ');

    if (confirm) {
        const confirmPassword = await question('Confirm New Vault password: ');
        if (password !== confirmPassword) {
            throw new Error('Passwords do not match');
        }
    }

    return password;
}
