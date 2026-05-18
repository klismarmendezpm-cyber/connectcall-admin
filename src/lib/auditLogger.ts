import { supabase } from './supabaseClient';

export interface AuditLogEntry {
  actor: string; // username or user id
  action:
  | 'create'
  | 'update'
  | 'rotate'
  | 'disable'
  | 'view'
  | 'delete'
  | 'login'
  | 'login_failed';
  entity: string; // table name or module
  entity_id?: string | number;
  metadata?: Record<string, any>;
}

export const logAudit = async (entry: AuditLogEntry) => {
  try {
    const dbAction =
    entry.action === 'delete' ? 'disable' :
    entry.action === 'login' || entry.action === 'login_failed' ? 'view' :
    entry.action;

    const { error } = await supabase.from('audit_log').insert([
    {
      actor: entry.actor,
      action: dbAction,
      entity: entry.entity,
      entity_id: Number(entry.entity_id || 0),
      metadata: {
        ...entry.metadata,
        original_action: entry.action
      }
    }]
    );

    if (error) {
      console.error('Failed to write audit log:', error);
    }
  } catch (err) {
    console.error('Exception writing audit log:', err);
  }
};
