/** Terme de recherche partagé entre le header applicatif et les pages. */
export const useSearch = () => useState<string>('tanchi-search', () => '')
