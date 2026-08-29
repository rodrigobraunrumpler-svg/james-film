import { ApiDoc } from '../../../common/swagger/api-doc.decorator.js';
import {
  AdminDifferentiatorEntity,
  AdminSocialLinkEntity,
  DifferentiatorEntity,
  SiteSettingsEntity,
  SocialLinkEntity,
} from './settings.entities.js';

export const DocLeerAjustes = (auth = false): MethodDecorator =>
  ApiDoc({
    summary: 'Devuelve los ajustes del sitio',
    description: 'Registro único. Si no existiera, se crea vacío en vez de devolver 404.',
    ok: SiteSettingsEntity,
    auth,
  });

export const DocActualizarAjustes = (): MethodDecorator =>
  ApiDoc({
    summary: 'Actualiza los ajustes del sitio',
    description:
      'Parcial: `null` borra un campo y omitirlo lo deja como está. El `whatsappNumber` se ' +
      'valida en formato internacional **sin el «+»** — sin prefijo el botón de la landing no ' +
      'funciona y nadie se entera, porque no falla: simplemente nadie escribe.',
    ok: SiteSettingsEntity,
    errors: [422],
    auth: true,
  });

export const DocListarDiferenciadores = (): MethodDecorator =>
  ApiDoc({ summary: 'Lista los diferenciadores activos', okArray: DifferentiatorEntity });

export const DocListarDiferenciadoresAdmin = (): MethodDecorator =>
  ApiDoc({ summary: 'Lista todos los diferenciadores', okArray: AdminDifferentiatorEntity, auth: true });

export const DocCrearDiferenciador = (): MethodDecorator =>
  ApiDoc({
    summary: 'Crea un diferenciador',
    description: 'El título es único: uno repetido devuelve 409 **nombrando el campo**.',
    ok: AdminDifferentiatorEntity,
    status: 201,
    errors: [409],
    auth: true,
  });

export const DocActualizarDiferenciador = (): MethodDecorator =>
  ApiDoc({ summary: 'Actualiza un diferenciador', ok: AdminDifferentiatorEntity, errors: [404, 409], auth: true });

export const DocBorrarDiferenciador = (): MethodDecorator =>
  ApiDoc({ summary: 'Borra un diferenciador', status: 204, errors: [404], auth: true });

export const DocReordenarDiferenciadores = (): MethodDecorator =>
  ApiDoc({ summary: 'Reordena los diferenciadores', okArray: AdminDifferentiatorEntity, auth: true });

export const DocListarRedes = (): MethodDecorator =>
  ApiDoc({ summary: 'Lista las redes activas', okArray: SocialLinkEntity });

export const DocListarRedesAdmin = (): MethodDecorator =>
  ApiDoc({ summary: 'Lista todas las redes', okArray: AdminSocialLinkEntity, auth: true });

export const DocCrearRed = (): MethodDecorator =>
  ApiDoc({
    summary: 'Añade una red',
    description: 'La plataforma es única: una repetida devuelve 409 nombrando el campo.',
    ok: AdminSocialLinkEntity,
    status: 201,
    errors: [409],
    auth: true,
  });

export const DocActualizarRed = (): MethodDecorator =>
  ApiDoc({ summary: 'Actualiza una red', ok: AdminSocialLinkEntity, errors: [404, 409], auth: true });

export const DocBorrarRed = (): MethodDecorator =>
  ApiDoc({ summary: 'Borra una red', status: 204, errors: [404], auth: true });

export const DocReordenarRedes = (): MethodDecorator =>
  ApiDoc({ summary: 'Reordena las redes', okArray: AdminSocialLinkEntity, auth: true });
