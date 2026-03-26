/**
 * Query routing logic - maps query patterns to handlers.
 * Open/Closed: Add new routes without modifying existing code.
 */

export interface Route {
  name: string
  pattern: (query: string) => boolean
  handler: 'sql' | 'vector'
  sqlType?: 'top_models' | 'top_repos' | 'embedding_models' | 'trends'
}

export const routes: Route[] = [
  {
    name: 'top_models',
    pattern: (q) => q.includes('top') && q.includes('model'),
    handler: 'sql',
    sqlType: 'top_models'
  },
  {
    name: 'top_repos',
    pattern: (q) => q.includes('top') && (q.includes('repo') || q.includes('framework')),
    handler: 'sql',
    sqlType: 'top_repos'
  },
  {
    name: 'embedding_models',
    pattern: (q) => q.includes('embedding') && (q.includes('top') || q.includes('best')),
    handler: 'sql',
    sqlType: 'embedding_models'
  },
  {
    name: 'trends',
    pattern: (q) => q.includes('trend'),
    handler: 'sql',
    sqlType: 'trends'
  },
  {
    name: 'vector_search',
    pattern: () => true, // Default fallback
    handler: 'vector'
  }
]

export function routeQuery(query: string): Route {
  const q = query.toLowerCase()
  return routes.find(route => route.pattern(q)) || routes[routes.length - 1]
}
