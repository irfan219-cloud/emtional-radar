import { query, transaction } from '@/utils/database';
import { PaginationOptions, PaginatedResponse } from '@/types/feedback';

export interface WhereCondition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'IN' | 'NOT IN' | 'LIKE' | 'ILIKE' | 'IS NULL' | 'IS NOT NULL';
  value?: any;
}

export interface JoinCondition {
  table: string;
  alias?: string;
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  on: string;
}

export interface QueryOptions {
  select?: string[];
  where?: WhereCondition[];
  joins?: JoinCondition[];
  orderBy?: { field: string; direction: 'ASC' | 'DESC' }[];
  groupBy?: string[];
  having?: WhereCondition[];
}

export abstract class BaseRepository<T> {
  protected tableName: string;
  protected primaryKey: string;

  constructor(tableName: string, primaryKey: string = 'id') {
    this.tableName = tableName;
    this.primaryKey = primaryKey;
  }

  /**
   * Find record by primary key
   */
  async findById(id: string): Promise<T | null> {
    const result = await query(
      `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find multiple records with conditions
   */
  async findMany(options: QueryOptions = {}): Promise<T[]> {
    const queryBuilder = this.buildSelectQuery(options);
    const result = await query(queryBuilder.sql, queryBuilder.params);

    return result.rows.map((row: Record<string, any>) => this.mapRowToEntity(row));
  }

  /**
   * Find one record with conditions
   */
  async findOne(options: QueryOptions = {}): Promise<T | null> {
    const queryBuilder = this.buildSelectQuery({ ...options });
    queryBuilder.sql += ' LIMIT 1';

    const result = await query(queryBuilder.sql, queryBuilder.params);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find records with pagination
   */
  async findPaginated(
    options: QueryOptions = {},
    pagination: PaginationOptions = { page: 1, limit: 50 }
  ): Promise<PaginatedResponse<T>> {
    // Get total count
    const countQuery = this.buildCountQuery(options);
    const countResult = await query(countQuery.sql, countQuery.params);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data
    const offset = (pagination.page - 1) * pagination.limit;
    const dataQuery = this.buildSelectQuery(options);

    // Add pagination
    dataQuery.sql += ` LIMIT $${dataQuery.params.length + 1} OFFSET $${dataQuery.params.length + 2}`;
    dataQuery.params.push(pagination.limit, offset);

    const dataResult = await query(dataQuery.sql, dataQuery.params);
    const data = dataResult.rows.map((row: Record<string, any>) => this.mapRowToEntity(row));

    return {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        total_pages: Math.ceil(total / pagination.limit),
        has_next: pagination.page * pagination.limit < total,
        has_prev: pagination.page > 1
      }
    };
  }

  /**
   * Create a new record
   */
  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

    const result = await query(
      `INSERT INTO ${this.tableName} (${fields.join(', ')}) 
       VALUES (${placeholders}) 
       RETURNING *`,
      values
    );

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update a record by primary key
   */
  async update(id: string, data: Partial<Omit<T, 'id' | 'created_at'>>): Promise<T | null> {
    const fields = Object.keys(data);
    const values = Object.values(data);

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const params = [id, ...values];

    const result = await query(
      `UPDATE ${this.tableName} 
       SET ${setClause}, updated_at = NOW() 
       WHERE ${this.primaryKey} = $1 
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Delete a record by primary key
   */
  async delete(id: string): Promise<boolean> {
    const result = await query(
      `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = $1`,
      [id]
    );

    return result.rowCount > 0;
  }

  /**
   * Count records with conditions
   */
  async count(options: QueryOptions = {}): Promise<number> {
    const queryBuilder = this.buildCountQuery(options);
    const result = await query(queryBuilder.sql, queryBuilder.params);

    return parseInt(result.rows[0].count);
  }

  /**
   * Check if record exists
   */
  async exists(id: string): Promise<boolean> {
    const result = await query(
      `SELECT 1 FROM ${this.tableName} WHERE ${this.primaryKey} = $1 LIMIT 1`,
      [id]
    );

    return result.rows.length > 0;
  }

  /**
   * Execute raw SQL query
   */
  async raw(sql: string, params: any[] = []): Promise<any> {
    return await query(sql, params);
  }

  /**
   * Execute multiple operations in a transaction
   */
  async transaction(operations: Array<{ sql: string; params?: any[] }>): Promise<any[]> {
    return await transaction(operations.map(op => ({ text: op.sql, params: op.params })));
  }

  /**
   * Build SELECT query from options
   */
  protected buildSelectQuery(options: QueryOptions): { sql: string; params: any[] } {
    let sql = `SELECT ${options.select?.join(', ') || '*'} FROM ${this.tableName}`;
    const params: any[] = [];
    let paramIndex = 1;

    // Add JOINs
    if (options.joins) {
      for (const join of options.joins) {
        const alias = join.alias ? ` ${join.alias}` : '';
        sql += ` ${join.type} JOIN ${join.table}${alias} ON ${join.on}`;
      }
    }

    // Add WHERE conditions
    if (options.where && options.where.length > 0) {
      const whereClause = this.buildWhereClause(options.where, paramIndex);
      sql += ` WHERE ${whereClause.clause}`;
      params.push(...whereClause.params);
      paramIndex += whereClause.params.length;
    }

    // Add GROUP BY
    if (options.groupBy && options.groupBy.length > 0) {
      sql += ` GROUP BY ${options.groupBy.join(', ')}`;
    }

    // Add HAVING
    if (options.having && options.having.length > 0) {
      const havingClause = this.buildWhereClause(options.having, paramIndex);
      sql += ` HAVING ${havingClause.clause}`;
      params.push(...havingClause.params);
    }

    // Add ORDER BY
    if (options.orderBy && options.orderBy.length > 0) {
      const orderClauses = options.orderBy.map(order => `${order.field} ${order.direction}`);
      sql += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    return { sql, params };
  }

  /**
   * Build COUNT query from options
   */
  protected buildCountQuery(options: QueryOptions): { sql: string; params: any[] } {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params: any[] = [];
    let paramIndex = 1;

    // Add JOINs
    if (options.joins) {
      for (const join of options.joins) {
        const alias = join.alias ? ` ${join.alias}` : '';
        sql += ` ${join.type} JOIN ${join.table}${alias} ON ${join.on}`;
      }
    }

    // Add WHERE conditions
    if (options.where && options.where.length > 0) {
      const whereClause = this.buildWhereClause(options.where, paramIndex);
      sql += ` WHERE ${whereClause.clause}`;
      params.push(...whereClause.params);
    }

    return { sql, params };
  }

  /**
   * Build WHERE clause from conditions
   */
  protected buildWhereClause(conditions: WhereCondition[], startIndex: number = 1): { clause: string; params: any[] } {
    const clauses: string[] = [];
    const params: any[] = [];
    let paramIndex = startIndex;

    for (const condition of conditions) {
      switch (condition.operator) {
        case 'IS NULL':
        case 'IS NOT NULL':
          clauses.push(`${condition.field} ${condition.operator}`);
          break;
        case 'IN':
        case 'NOT IN':
          if (Array.isArray(condition.value) && condition.value.length > 0) {
            clauses.push(`${condition.field} ${condition.operator} ($${paramIndex})`);
            params.push(condition.value);
            paramIndex++;
          }
          break;
        default:
          clauses.push(`${condition.field} ${condition.operator} $${paramIndex}`);
          params.push(condition.value);
          paramIndex++;
      }
    }

    return {
      clause: clauses.join(' AND '),
      params
    };
  }

  /**
   * Abstract method to map database row to entity
   * Must be implemented by concrete repositories
   */
  protected abstract mapRowToEntity(row: Record<string, any>): T;
}