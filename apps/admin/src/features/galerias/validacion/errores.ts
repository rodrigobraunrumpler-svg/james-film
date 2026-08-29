/**
 * El mensaje dice QUÉ HACER, nunca "formato inválido" (§4). James no tiene a
 * quién preguntar: si el error no trae la salida, se queda atascado.
 */
export class ErrorValidacion extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErrorValidacion';
  }
}
