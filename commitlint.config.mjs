/**
 * Conventional commits, en inglés y con el asunto en 100 caracteres.
 *
 * Sin husky: `prepare` apunta `core.hooksPath` a `.githooks/` y pnpm lo ejecuta
 * al instalar. Una dependencia menos para lo que hace una línea de config.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 100 y no los 72 de la costumbre: los asuntos de este repo llevan ámbito
    // y un guion largo, y cortarlos a 72 obliga a decir menos de lo necesario.
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 100],
    'footer-max-line-length': [2, 'always', 100],
    // Los ámbitos son las cuatro áreas del monorepo. Fuera de esta lista suele
    // ser un typo, y un ámbito con typo no agrupa nada al leer el historial.
    'scope-enum': [2, 'always', ['api', 'admin', 'web', 'contracts', 'deps', 'ci', 'docs']],
  },
};
