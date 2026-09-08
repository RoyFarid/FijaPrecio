import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/** argon2id con parámetros OWASP (19 MiB, 2 iteraciones, paralelismo 1). */
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return hash(plain, OPTS);
  }

  async verify(storedHash: string, plain: string): Promise<boolean> {
    try {
      return await verify(storedHash, plain, OPTS);
    } catch {
      return false;
    }
  }
}
