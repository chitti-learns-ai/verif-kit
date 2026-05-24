export interface ParameterizedQuery {
  sql: string;
  params: string[];
}

/**
 * Build a query that looks up a user by exact name.
 *
 * BUG (SQL injection): the username is concatenated directly into the SQL text
 * instead of being passed as a bound parameter. A username such as
 * `x' OR '1'='1` changes the structure of the query (the WHERE clause no longer
 * means "name equals this literal"), which is a classic SQL-injection hole.
 */
export function buildUserLookup(username: string): ParameterizedQuery {
  return {
    sql: `SELECT id, name FROM users WHERE name = '${username}'`,
    params: []
  };
}
