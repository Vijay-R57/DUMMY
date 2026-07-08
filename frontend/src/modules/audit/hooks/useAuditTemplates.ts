/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * src/modules/audit/hooks/useAuditTemplates.ts
 * ─────────────────────────────────────────────────────────────
 * Data-access hooks for audit templates and checklist items.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AuditTemplate, AuditChecklistItem } from '../types';

// ── Fetch all active templates ────────────────────────────────────────────────

export function useAuditTemplates() {
  const [templates, setTemplates] = useState<AuditTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbErr } = await (supabase as any)
        .from('audit_templates')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (dbErr) throw dbErr;
      setTemplates((data ?? []) as AuditTemplate[]);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  return { templates, loading, error, refetch: fetchTemplates };
}

// ── Fetch checklist items for a template ─────────────────────────────────────

export function useTemplateItems(templateId: string | null) {
  const [items, setItems] = useState<AuditChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!templateId) { setItems([]); return; }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { data, error: dbErr } = await (supabase as any)
          .from('audit_checklist_items')
          .select('*')
          .eq('template_id', templateId)
          .order('pillar', { ascending: true })
          .order('display_order', { ascending: true });

        if (dbErr) throw dbErr;
        if (!cancelled) setItems((data ?? []) as AuditChecklistItem[]);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? 'Failed to load checklist items');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [templateId]);

  return { items, loading, error };
}

// ── Create a new template ─────────────────────────────────────────────────────

export interface CreateTemplateInput {
  name: string;
  description?: string;
  version?: string;
}

export function useCreateAuditTemplate() {
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const createTemplate = useCallback(async (
    input: CreateTemplateInput,
  ): Promise<AuditTemplate | null> => {
    setCreating(true);
    try {
      const { data, error: dbErr } = await (supabase as any)
        .from('audit_templates')
        .insert({
          name: input.name,
          description: input.description ?? null,
          version: input.version ?? '1.0',
          status: 'ACTIVE',
          is_default: false,
        })
        .select()
        .single();

      if (dbErr) throw dbErr;

      toast({ title: 'Template created', description: input.name });
      return data as AuditTemplate;
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
      return null;
    } finally {
      setCreating(false);
    }
  }, [toast]);

  return { createTemplate, creating };
}
