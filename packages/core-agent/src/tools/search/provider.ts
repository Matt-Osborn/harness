import type { SearchResult, SearchProviderType } from '@harness/shared';

export interface SearchProvider {
  readonly name: SearchProviderType;
  search(query: string, numResults?: number): Promise<SearchResult[]>;
}
