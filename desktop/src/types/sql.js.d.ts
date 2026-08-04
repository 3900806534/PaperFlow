declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database
    (config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>
  }
  interface Database {
    run(sql: string, params?: any[] | Record<string, any>): Database
    exec(sql: string): QueryExecResult[]
    prepare(sql: string): Statement
    export(): Uint8Array
    close(): void
  }
  interface Statement {
    bind(params?: any[] | Record<string, any>): boolean
    step(): boolean
    getAsObject(): Record<string, any>
    free(): boolean
  }
  interface QueryExecResult {
    columns: string[]
    values: any[][]
  }
  export default function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>
}
