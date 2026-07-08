/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * src/modules/audit/hooks/useAuditSessions.ts
 * ─────────────────────────────────────────────────────────────
 * Data-access hooks for audit sessions and responses.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type {
  AuditSession,
  AuditSessionWithDetails,
  CreateSessionPayload,
  UpsertResponsesPayload,
} from '../types';

// ── Fetch sessions for the current user ───────────────────────────────────────

export function useAuditSessions() {
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbErr } = await (supabase as any)
        .from('audit_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbErr) throw dbErr;
      setSessions((data ?? []) as AuditSession[]);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  return { sessions, loading, error, refetch: fetchSessions };
}

// ── Fetch a single session with all items + responses ─────────────────────────

export function useAuditSessionDetail(sessionId: string | null) {
  const [session, setSession] = useState<AuditSessionWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch session
      const { data: sessionData, error: sessionErr } = await (supabase as any)
        .from('audit_sessions')
        .select('*')
        .eq('id', id)
        .single();
      if (sessionErr) throw sessionErr;

      // Fetch snapshot items
      const { data: itemsData, error: itemsErr } = await (supabase as any)
        .from('audit_session_items')
        .select('*')
        .eq('audit_session_id', id)
        .order('pillar', { ascending: true })
        .order('display_order', { ascending: true });
      if (itemsErr) throw itemsErr;

      // Fetch responses
      const { data: responsesData, error: responsesErr } = await (supabase as any)
        .from('audit_item_responses')
        .select('*')
        .eq('audit_session_id', id);
      if (responsesErr) throw responsesErr;

      setSession({
        ...(sessionData as AuditSession),
        items: itemsData ?? [],
        responses: responsesData ?? [],
      });
    } catch (e: any) {
      setError(e.message ?? 'Failed to load session details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionId) fetchDetail(sessionId);
    else setSession(null);
  }, [sessionId, fetchDetail]);

  return { session, loading, error, refetch: () => sessionId && fetchDetail(sessionId) };
}

// ── Create a new audit session ────────────────────────────────────────────────

export function useCreateAuditSession() {
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const createSession = useCallback(async (
    payload: CreateSessionPayload,
  ): Promise<AuditSession | null> => {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated session found');

      const { data, error: dbErr } = await (supabase as any)
        .from('audit_sessions')
        .insert({
          template_id:      payload.template_id,
          template_name:    payload.template_name,
          template_version: payload.template_version,
          auditor_id:       user.id,
          auditor_name:     payload.auditor_name,
          area_id:          payload.area_id ?? null,
          area_name:        payload.area_name ?? null,
          department_name:  payload.department_name ?? null,
          plant_name:       payload.plant_name ?? null,
          audit_date:       payload.audit_date ?? new Date().toISOString().slice(0, 10),
          status:           'DRAFT',
          notes:            payload.notes ?? null,
          industry:         payload.industry ?? null,
          workspace_type:   payload.workspace_type ?? null,
          expected_equipment: payload.expected_equipment ?? null,
          expected_safety_assets: payload.expected_safety_assets ?? null,
        })
        .select()
        .single();

      if (dbErr) throw dbErr;
      toast({ title: 'Audit session created', description: 'Checklist items have been loaded.' });
      return data as AuditSession;
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
      return null;
    } finally {
      setCreating(false);
    }
  }, [toast]);

  return { createSession, creating };
}

// ── Upsert responses for a session ────────────────────────────────────────────

export function useSubmitAuditResponses() {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const submitResponses = useCallback(async (
    payload: UpsertResponsesPayload,
    finalize: boolean = false,
  ): Promise<boolean> => {
    setSubmitting(true);
    try {
      // Upsert all responses
      const rows = payload.responses.map((r) => ({
        audit_session_id: payload.audit_session_id,
        session_item_id:  r.session_item_id,
        manual_score:     r.manual_score,
        notes:            r.notes ?? null,
      }));

      const { error: respErr } = await (supabase as any)
        .from('audit_item_responses')
        .upsert(rows, { onConflict: 'audit_session_id,session_item_id' });

      if (respErr) throw respErr;

      // Optionally mark session as COMPLETED
      if (finalize) {
        const { error: sessErr } = await (supabase as any)
          .from('audit_sessions')
          .update({
            status:       'COMPLETED',
            completed_at: new Date().toISOString(),
          })
          .eq('id', payload.audit_session_id);

        if (sessErr) throw sessErr;
        toast({ title: 'Audit completed', description: 'All responses saved successfully.' });
      } else {
        toast({ title: 'Progress saved', description: 'Responses have been saved.' });
      }

      return true;
    } catch (e: any) {
      toast({ title: 'Error saving responses', description: e.message, variant: 'destructive' });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [toast]);

  return { submitResponses, submitting };
}
