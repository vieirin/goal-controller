import { createHash } from 'crypto';
import { getDb } from '../db';

export type VariableValues = Record<string, boolean | number>;

interface ModelVariablesRow {
  model_hash: string;
  variables: string;
  created_at: string;
  updated_at: string;
}

/**
 * Variables model - handles all operations related to model variables storage
 */
export const VariablesModel = {
  /**
   * Generate a hash from the model content to use as a unique key
   */
  hashContent(modelJson: string): string {
    return createHash('sha256').update(modelJson).digest('hex').substring(0, 16);
  },

  /**
   * Store or update variables for a model
   */
  upsert(modelHash: string, variables: VariableValues): void {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO model_variables (model_hash, variables, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(model_hash) DO UPDATE SET
        variables = excluded.variables,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(modelHash, JSON.stringify(variables));
  },

  /**
   * Retrieve stored variables for a model by hash
   */
  findByHash(modelHash: string): VariableValues | null {
    const db = getDb();
    const stmt = db.prepare(
      'SELECT variables FROM model_variables WHERE model_hash = ?'
    );
    const row = stmt.get(modelHash) as Pick<ModelVariablesRow, 'variables'> | undefined;

    if (row) {
      try {
        return JSON.parse(row.variables);
      } catch {
        return null;
      }
    }
    return null;
  },

  /**
   * Delete stored variables for a model
   */
  delete(modelHash: string): void {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM model_variables WHERE model_hash = ?');
    stmt.run(modelHash);
  },

  /**
   * Check if variables exist for a model
   */
  exists(modelHash: string): boolean {
    const db = getDb();
    const stmt = db.prepare(
      'SELECT 1 FROM model_variables WHERE model_hash = ? LIMIT 1'
    );
    return stmt.get(modelHash) !== undefined;
  },

  /**
   * Get all stored model variables (for debugging/admin purposes)
   */
  findAll(): Array<{ modelHash: string; variables: VariableValues; updatedAt: string }> {
    const db = getDb();
    const stmt = db.prepare('SELECT model_hash, variables, updated_at FROM model_variables');
    const rows = stmt.all() as ModelVariablesRow[];

    return rows.map((row) => ({
      modelHash: row.model_hash,
      variables: JSON.parse(row.variables),
      updatedAt: row.updated_at,
    }));
  },
};

