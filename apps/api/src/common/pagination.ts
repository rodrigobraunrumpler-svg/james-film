import type { PaginationMeta } from '@james-film/contracts';
import type { ListaPaginada } from './interceptors/response-envelope.interceptor.js';

/**
 * Con cero resultados: pageCount 0, ambos extremos en true, ambos vecinos null.
 * Fijarlo aquí evita que cada cliente invente su propia interpretación.
 */
export function paginar<T>(
  items: T[],
  totalCount: number,
  currentPage: number,
  pageSize: number,
): ListaPaginada<T> {
  const pageCount = Math.ceil(totalCount / pageSize);
  const meta: PaginationMeta = {
    totalCount,
    pageCount,
    currentPage,
    pageSize,
    isFirstPage: currentPage <= 1,
    isLastPage: currentPage >= pageCount,
    previousPage: currentPage > 1 ? currentPage - 1 : null,
    nextPage: currentPage < pageCount ? currentPage + 1 : null,
  };
  return { items, meta };
}
