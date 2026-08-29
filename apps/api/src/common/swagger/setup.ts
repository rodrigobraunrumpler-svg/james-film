import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { GalleriesModule } from '../../modules/galleries/galleries.module.js';

/**
 * DOS documentos, no uno. El público es el contrato que consume Astro en build
 * time; el de admin lleva bearer y no tiene por qué ser accesible en producción.
 * Mezclarlos publicaría la superficie privada en el contrato de la landing.
 */
export function construirDocPublico(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('James Film · API pública')
    .setDescription(
      'Lo que consume la landing de Astro en build time. Toda respuesta va envuelta ' +
        'en `{ success, code, data, meta?, timestamp }`.',
    )
    .setVersion('1.0')
    .build();

  const doc = SwaggerModule.createDocument(app, config, { include: [GalleriesModule] });

  // `include` mete el MÓDULO entero, y GalleriesModule tiene los dos controllers:
  // sin este filtro el contrato que consume Astro documentaría la superficie
  // privada al completo. Se poda por ruta, que es la frontera real.
  return podar(doc);
}

/** Quita las rutas de admin y los esquemas que dejan de estar referenciados. */
function podar(doc: OpenAPIObject): OpenAPIObject {
  const paths = Object.fromEntries(
    Object.entries(doc.paths).filter(([ruta]) => !ruta.startsWith('/admin')),
  );

  const referenciados = new Set<string>();
  const recorrer = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(recorrer);
    if (v === null || typeof v !== 'object') return;
    for (const [k, valor] of Object.entries(v)) {
      if (k === '$ref' && typeof valor === 'string') {
        referenciados.add(valor.split('/').pop() as string);
      } else {
        recorrer(valor);
      }
    }
  };
  recorrer(paths);

  // Segunda pasada: un esquema referenciado puede referenciar otros.
  const todos = doc.components?.schemas ?? {};
  let anterior = 0;
  while (referenciados.size !== anterior) {
    anterior = referenciados.size;
    for (const nombre of Array.from(referenciados)) recorrer(todos[nombre]);
  }

  return {
    ...doc,
    paths,
    components: {
      ...doc.components,
      schemas: Object.fromEntries(
        Object.entries(todos).filter(([nombre]) => referenciados.has(nombre)),
      ),
    },
  };
}

export function construirDocAdmin(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('James Film · API de administración')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  return SwaggerModule.createDocument(app, config);
}

export function montarSwagger(app: INestApplication): void {
  SwaggerModule.setup('docs/public', app, construirDocPublico(app));
  SwaggerModule.setup('docs/admin', app, construirDocAdmin(app));
}
