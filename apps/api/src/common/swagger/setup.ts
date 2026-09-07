import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { CategoriesModule } from '../../modules/categories/categories.module.js';
import { GalleriesModule } from '../../modules/galleries/galleries.module.js';
import { PackagesModule } from '../../modules/packages/packages.module.js';
import { SettingsModule } from '../../modules/settings/settings.module.js';
import { TestimonialsModule } from '../../modules/testimonials/testimonials.module.js';
import { AvailabilityModule } from '../../modules/availability/availability.module.js';
import { TrackingModule } from '../../modules/tracking/tracking.module.js';

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

  // Los módulos se listan A MANO: uno nuevo NO aparece solo, así que sus
  // endpoints públicos no llegarían al contrato que consume Astro y la fase 5
  // no los vería. `podar()` sigue quitando lo de /admin, que es la frontera real.
  const doc = SwaggerModule.createDocument(app, config, {
    include: [
      GalleriesModule,
      CategoriesModule,
      PackagesModule,
      TestimonialsModule,
      SettingsModule,
      // `GET /availability` lo hornea el BUILD de Astro. Si no está aquí, la
      // landing no sabe que existe — es lo que pasó con TrackingModule.
      AvailabilityModule,
      // `/track/whatsapp` lo llama el NAVEGADOR de la landing, no el build:
      // es el clic que mide el negocio entero, y si no está aquí la fase 5 no
      // sabe que existe.
      TrackingModule,
    ],
  });

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

/**
 * El de ADMIN no se monta en producción, y hasta ahora sí se montaba.
 *
 * CLAUDE.md lo dice por escrito —«con bearer, no se expone en producción»— y el
 * código montaba los dos sin condición. La UI de Swagger es una página
 * PÚBLICA: el bearer protege los endpoints, no el catálogo. O sea que
 * `/docs/admin` publicaba la superficie entera de administración —cada ruta,
 * cada parámetro, cada forma de cuerpo— a quien la pidiera.
 *
 * No es una fuga de datos, es un mapa. Y el mapa es justo lo que no hace falta
 * regalar de un panel con una sola cuenta.
 *
 * El PÚBLICO sí se queda: es el contrato que la fase 5 consume y que el CI
 * congela en `docs/openapi-public.json`. Ahí no hay nada que esconder — son las
 * mismas rutas que la landing llama desde el navegador de cualquiera.
 */
export function montarSwagger(app: INestApplication): void {
  SwaggerModule.setup('docs/public', app, construirDocPublico(app));

  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('docs/admin', app, construirDocAdmin(app));
  }
}
