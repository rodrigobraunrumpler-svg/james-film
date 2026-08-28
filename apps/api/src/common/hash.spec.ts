import { hashPassword, verifyPassword } from './hash.js';

describe('hash', () => {
  it('verifica la contraseña correcta y rechaza la incorrecta', async () => {
    const digest = await hashPassword('clave-de-james');

    expect(digest.startsWith('$argon2id$')).toBe(true);
    await expect(verifyPassword(digest, 'clave-de-james')).resolves.toBe(true);
    await expect(verifyPassword(digest, 'clave-equivocada')).resolves.toBe(false);
  });

  it('el mismo texto produce hashes distintos: la sal es aleatoria', async () => {
    // Esta propiedad es justo la razón por la que Session.tokenHash NO usa argon2:
    // con sal, `WHERE tokenHash = ?` nunca encontraría la fila.
    expect(await hashPassword('igual')).not.toBe(await hashPassword('igual'));
  });
});
