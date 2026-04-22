export interface GraphDbConfig {
  url: string;
  username: string;
  password: string;
  database?: string;
}


export function loadGraphDbConfig(): GraphDbConfig {

  return {
    url: process.env.GRAPH_DB_URL ?? 'bolt://localhost:7687',
    username: process.env.GRAPH_DB_USER ?? '',
    password: process.env.GRAPH_DB_PASSWORD ?? '',
    database: process.env.GRAPH_DB_DATABASE,
  };
}
