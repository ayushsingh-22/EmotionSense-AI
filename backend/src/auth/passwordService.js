import bcrypt from 'bcryptjs';

export function createPasswordService({ cost = 12, minLength = 12 } = {}) {
  if (!Number.isInteger(cost) || cost < 4 || cost > 16) throw new Error('Invalid bcrypt cost');
  if (!Number.isInteger(minLength) || minLength < 8) throw new Error('Invalid password minimum');
  let dummy;
  const validate = (password) => {
    if (typeof password !== 'string' || [...password].length < minLength || Buffer.byteLength(password, 'utf8') > 72)
      throw new Error('Invalid password length');
  };
  return {
    validate,
    async hash(password) { validate(password); return bcrypt.hash(password, cost); },
    async verify(password, storedHash) {
      // Perform a bcrypt comparison even for missing or structurally invalid inputs.
      dummy ??= bcrypt.hash('dummy timing value never used for authentication', cost);
      const candidate = typeof password === 'string' && Buffer.byteLength(password, 'utf8') <= 72 ? password : 'invalid input';
      const validFormat = typeof storedHash === 'string' && /^\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$/.test(storedHash);
      const match = await bcrypt.compare(candidate, validFormat ? storedHash : await dummy);
      const valid = validFormat && match && candidate === password;
      const rounds = valid ? bcrypt.getRounds(storedHash) : cost;
      return { valid, needsRehash: valid && rounds < cost };
    },
    async rehashIfNeeded(password, storedHash) {
      const result = await this.verify(password, storedHash);
      return { ...result, hash: result.needsRehash ? await this.hash(password) : null };
    }
  };
}
