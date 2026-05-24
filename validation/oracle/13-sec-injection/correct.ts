export interface ParameterizedQuery {
  sql: string;
  params: string[];
}

/**
 * Build a query that looks up a user by exact name.
 * The username is bound as a parameter, never interpolated into the SQL text,
 * so its content cannot change the structure of the query.
 */
export function buildUserLookup(username: string): ParameterizedQuery {
  return {
    sql: 'SELECT id, name FROM users WHERE name = ?',
    params: [username]
  };
}
