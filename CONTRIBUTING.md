# Contributing to SecureVault

Thanks for considering a contribution. SecureVault is a small, focused project and we'd rather have a few good pull requests than a lot of noise, so a bit of structure goes a long way.

## Before you start

For anything beyond a typo fix, open an issue first describing what you want to change and why. This avoids wasted work if the change doesn't fit the project's direction.

## Development setup

```bash
git clone https://github.com/bad-Al-code/SecureVault.git
cd SecureVault
npm install
npm run build
```

Run the CLI locally with `node ./dist/cli.js <command>`.

## Before opening a PR

```bash
npm run lint
npm run format:check
npm test
```

All three must pass. `husky` and `lint-staged` will also run lint and format automatically on commit.

## Pull request guidelines

- Keep PRs focused on a single change. Small, reviewable PRs get merged faster than large ones.
- Add or update tests for any change to `src/services` or `src/commands`, especially anything touching `crypto.service.ts` or `session.service.ts`.
- Follow the existing code style (the linter and formatter will catch most of this).
- Update the README if you're adding or changing a CLI command.

## Reporting bugs

Open a GitHub issue with:

- The command you ran
- What you expected to happen
- What actually happened
- Your OS and Node version

## Reporting security issues

If you find a vulnerability in the encryption, key derivation, or session handling, please do not open a public issue. Email badal@softwarecrafting.in so it can be fixed before details are public.

## Code of conduct

Be respectful. Disagreements about code are fine; personal attacks are not.
