import neo4j, { Driver, Session, SessionMode } from 'neo4j-driver';
import { loadGraphDbConfig, GraphDbConfig } from './config';


export interface RunOptions {
  database?: string;
  mode?: 'read' | 'write';
}


export interface GraphRecord {
  [key: string]: unknown;
}


export class GraphDbClient {

  private driver: Driver | null = null;

  constructor(private readonly config: GraphDbConfig = loadGraphDbConfig()) {}


  connect(): Driver {

    if (this.driver) return this.driver;

    const auth = this.config.username
      ? neo4j.auth.basic(this.config.username, this.config.password)
      : neo4j.auth.basic('', '');

    this.driver = neo4j.driver(this.config.url, auth, {
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 30_000,
      disableLosslessIntegers: true,
    });

    return this.driver;
  }


  session(options: RunOptions = {}): Session {

    const driver = this.connect();
    const mode: SessionMode = options.mode === 'write' ? neo4j.session.WRITE : neo4j.session.READ;

    return driver.session({
      database: options.database ?? this.config.database,
      defaultAccessMode: mode,
    });
  }


  async run<T extends GraphRecord = GraphRecord>(
    cypher: string,
    params: Record<string, unknown> = {},
    options: RunOptions = {},
  ): Promise<T[]> {

    const session = this.session(options);

    try {
      const result = await session.run(cypher, params);
      return result.records.map((r) => r.toObject() as T);
    } finally {
      await session.close();
    }
  }


  async writeTransaction<T>(
    work: (tx: { run: (cypher: string, params?: Record<string, unknown>) => Promise<{ records: { toObject(): GraphRecord }[] }> }) => Promise<T>,
    options: RunOptions = {},
  ): Promise<T> {

    const session = this.session({ ...options, mode: 'write' });

    try {
      return await session.executeWrite(work);
    } finally {
      await session.close();
    }
  }


  async ping(): Promise<boolean> {

    try {
      await this.run('RETURN 1 AS ok');
      return true;
    } catch {
      return false;
    }
  }


  async close(): Promise<void> {

    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }
}
