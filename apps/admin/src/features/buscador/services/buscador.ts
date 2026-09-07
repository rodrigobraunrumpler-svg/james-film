import type { SearchResultDto } from '@james-film/contracts';
import { api, type RequestOptions } from '@/lib/api/http';

export const buscador = {
  buscar: (q: string, opts?: RequestOptions) =>
    api.get<SearchResultDto[]>('/admin/search', { ...opts, query: { q } }),
};
