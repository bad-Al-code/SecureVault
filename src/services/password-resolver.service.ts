import { ResolvedData } from '../types';
import { getPassword } from '../utils';
import { CryptoService } from './crypto.service';
import { SessionService } from './session.service';

export class PasswordResolverService {
  public static async resolve(
    encryptedContent: string,
    filename: string
  ): Promise<ResolvedData> {
    const cachedPassword = await SessionService.getActivePasswords();

    for (const cachedPass of cachedPassword) {
      try {
        const content = await CryptoService.decrypt(
          encryptedContent,
          cachedPass,
          filename
        );

        return { password: cachedPass, decryptedContent: content };
      } catch {
        // Ignore
      }
    }

    const inputPassword = await getPassword();
    const content = await CryptoService.decrypt(
      encryptedContent,
      inputPassword,
      filename
    );

    await SessionService.addPassword(inputPassword);

    return { password: inputPassword, decryptedContent: content };
  }
}
