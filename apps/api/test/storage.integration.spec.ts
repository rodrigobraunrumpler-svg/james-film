import { randomUUID } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { validateEnv } from '../src/config/env.schema.js';
import { StorageModule } from '../src/storage/storage.module.js';
import { StorageService } from '../src/storage/storage.service.js';

let storage: StorageService;

beforeAll(async () => {
  const mod = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, ignoreEnvFile: true }),
      StorageModule,
    ],
  }).compile();
  storage = mod.get(StorageService);
});

const clave = (ext = 'mp4') => `videos/${randomUUID()}.${ext}`;

describe('subida firmada', () => {
  it('la URL firmada permite subir, y el HEAD devuelve el tamaño real', async () => {
    const key = clave();
    const cuerpo = 'hola mundo!!';

    const url = await storage.getUploadUrl({
      key,
      contentType: 'video/mp4',
      contentLength: cuerpo.length,
    });

    const put = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': 'video/mp4' },
      body: cuerpo,
    });
    expect(put.ok).toBe(true);

    const head = await storage.headObject(key);
    expect(head).toEqual({ contentLength: cuerpo.length, contentType: 'video/mp4' });
  });

  it('headObject devuelve null si el objeto no existe, no lanza', async () => {
    // El confirm lo usa para distinguir "subida truncada" de "no llegó nada".
    expect(await storage.headObject('videos/no-existe.mp4')).toBeNull();
  });

  it('la firma lleva el Content-Length: sin él cualquiera sube 5 GB con tu credencial', async () => {
    const key = clave();
    const url = await storage.getUploadUrl({
      key,
      contentType: 'video/mp4',
      contentLength: 10,
    });

    // Se firma con 10 bytes y se intentan subir 5000: debe rechazarlo.
    const put = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': 'video/mp4' },
      body: 'x'.repeat(5000),
    });
    expect(put.ok).toBe(false);
    expect(await storage.headObject(key)).toBeNull();
  });

  it('la firma también fija el Content-Type', async () => {
    const key = clave();
    const url = await storage.getUploadUrl({ key, contentType: 'video/mp4', contentLength: 4 });

    const put = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': 'application/zip' },
      body: 'abcd',
    });
    expect(put.ok).toBe(false);
  });

  it('una firma caducada no sirve', async () => {
    const key = clave();
    const url = await storage.getUploadUrl({
      key,
      contentType: 'video/mp4',
      contentLength: 4,
      expiresIn: 1,
    });

    await new Promise((r) => setTimeout(r, 1500));
    const put = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': 'video/mp4' },
      body: 'abcd',
    });
    expect(put.status).toBe(403);
  });

  it('delete borra de verdad y es idempotente', async () => {
    const key = clave();
    const url = await storage.getUploadUrl({ key, contentType: 'video/mp4', contentLength: 4 });
    await fetch(url, { method: 'PUT', headers: { 'content-type': 'video/mp4' }, body: 'abcd' });

    await storage.delete(key);
    expect(await storage.headObject(key)).toBeNull();
    // Segunda vez sobre algo que ya no está: no debe lanzar. El cron de
    // huérfanos lo llamará sobre objetos que quizá ya se borraron.
    await expect(storage.delete(key)).resolves.toBeUndefined();
  });

  it('getPublicUrl construye desde CDN_BASE_URL, no desde el endpoint S3', async () => {
    // Es lo que permite cambiar de proveedor sin migrar la base: se guarda la
    // key, nunca la URL (§17).
    expect(storage.getPublicUrl('videos/abc.mp4')).toBe(
      'http://localhost:9000/jamesfilm/videos/abc.mp4',
    );
  });
});
