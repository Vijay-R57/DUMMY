export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      analysis_logs: {
        Row: {
          id: string
          employee_id: string
          employee_name: string
          department: string
          analysis_date: string
          created_at: string
          before_image: string | null
          after_image: string | null
          analysis_result: Json | null
          // columns added by add_storage_bucket_and_cv_columns migration
          before_image_path: string | null
          after_image_path: string | null
          scoring_method: string | null
          cv_metrics: Json | null
          // columns added by add_geotag_columns migration
          office_name: string | null
          before_latitude: number | null
          before_longitude: number | null
          before_captured_at: string | null
          after_latitude: number | null
          after_longitude: number | null
          after_captured_at: string | null
          captured_at: string | null
          // columns added by production_database_architecture migration
          worker_id: string | null
          area_id: string | null
          overall_score_before: number | null
          overall_score_after: number | null
          lean_maintenance_score: number | null
          upload_status: string | null
          retry_count: number | null
          upload_error: string | null
        }
        Insert: {
          id?: string
          employee_id: string
          employee_name: string
          department: string
          analysis_date?: string
          created_at?: string
          before_image?: string | null
          after_image?: string | null
          analysis_result?: Json | null
          before_image_path?: string | null
          after_image_path?: string | null
          scoring_method?: string | null
          cv_metrics?: Json | null
          office_name?: string | null
          before_latitude?: number | null
          before_longitude?: number | null
          before_captured_at?: string | null
          after_latitude?: number | null
          after_longitude?: number | null
          after_captured_at?: string | null
          captured_at?: string | null
          worker_id?: string | null
          area_id?: string | null
          overall_score_before?: number | null
          overall_score_after?: number | null
          lean_maintenance_score?: number | null
          upload_status?: string | null
          retry_count?: number | null
          upload_error?: string | null
        }
        Update: {
          id?: string
          employee_id?: string
          employee_name?: string
          department?: string
          analysis_date?: string
          created_at?: string
          before_image?: string | null
          after_image?: string | null
          analysis_result?: Json | null
          before_image_path?: string | null
          after_image_path?: string | null
          scoring_method?: string | null
          cv_metrics?: Json | null
          office_name?: string | null
          before_latitude?: number | null
          before_longitude?: number | null
          before_captured_at?: string | null
          after_latitude?: number | null
          after_longitude?: number | null
          after_captured_at?: string | null
          captured_at?: string | null
          worker_id?: string | null
          area_id?: string | null
          overall_score_before?: number | null
          overall_score_after?: number | null
          lean_maintenance_score?: number | null
          upload_status?: string | null
          retry_count?: number | null
          upload_error?: string | null
        }
        Relationships: []
      }
      audit_templates: {
        Row: {
          id: string
          name: string
          description: string | null
          version: string
          status: 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED'
          is_default: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          version?: string
          status?: 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED'
          is_default?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          version?: string
          status?: 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED'
          is_default?: boolean
          created_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_checklist_items: {
        Row: {
          id: string
          template_id: string
          pillar: 'SORT' | 'SET_IN_ORDER' | 'SHINE' | 'STANDARDIZE' | 'SUSTAIN'
          question_id: string | null
          question_text: string
          description: string | null
          max_points: number
          weight: number
          display_order: number
          is_mandatory: boolean
          severity: 'CRITICAL' | 'MAJOR' | 'MINOR'
          created_at: string
        }
        Insert: {
          id?: string
          template_id: string
          pillar: 'SORT' | 'SET_IN_ORDER' | 'SHINE' | 'STANDARDIZE' | 'SUSTAIN'
          question_id?: string | null
          question_text: string
          description?: string | null
          max_points?: number
          weight?: number
          display_order?: number
          is_mandatory?: boolean
          severity?: 'CRITICAL' | 'MAJOR' | 'MINOR'
          created_at?: string
        }
        Update: {
          pillar?: 'SORT' | 'SET_IN_ORDER' | 'SHINE' | 'STANDARDIZE' | 'SUSTAIN'
          question_id?: string | null
          question_text?: string
          description?: string | null
          max_points?: number
          weight?: number
          display_order?: number
          is_mandatory?: boolean
          severity?: 'CRITICAL' | 'MAJOR' | 'MINOR'
        }
        Relationships: []
      }
      audit_sessions: {
        Row: {
          id: string
          audit_number: string
          template_id: string
          template_name: string
          template_version: string
          auditor_id: string
          auditor_name: string
          area_id: string | null
          area_name: string | null
          department_name: string | null
          plant_name: string | null
          analysis_log_id: string | null
          audit_date: string
          status: 'DRAFT' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'COMPLETED' | 'ARCHIVED'
          total_score: number
          max_score: number
          percentage: number
          notes: string | null
          // Phase 2 fields
          score_breakdown: Json | null
          generated_after_image_url: string | null
          improvement_prompt: string | null
          prompt_version_id: string | null
          vision_model_used: string | null
          prompt_schema_version: string | null
          analysis_mode: 'MANUAL' | 'AI_ASSISTED' | 'FULL_AI'
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          template_id: string
          template_name: string
          template_version: string
          auditor_id: string
          auditor_name: string
          area_id?: string | null
          area_name?: string | null
          department_name?: string | null
          plant_name?: string | null
          analysis_log_id?: string | null
          audit_date?: string
          status?: 'DRAFT' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'COMPLETED' | 'ARCHIVED'
          notes?: string | null
          analysis_mode?: 'MANUAL' | 'AI_ASSISTED' | 'FULL_AI'
        }
        Update: {
          status?: 'DRAFT' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'COMPLETED' | 'ARCHIVED'
          notes?: string | null
          total_score?: number
          max_score?: number
          score_breakdown?: Json | null
          generated_after_image_url?: string | null
          improvement_prompt?: string | null
          prompt_version_id?: string | null
          vision_model_used?: string | null
          prompt_schema_version?: string | null
          analysis_mode?: 'MANUAL' | 'AI_ASSISTED' | 'FULL_AI'
          completed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_session_items: {
        Row: {
          id: string
          audit_session_id: string
          original_checklist_item_id: string | null
          pillar: 'SORT' | 'SET_IN_ORDER' | 'SHINE' | 'STANDARDIZE' | 'SUSTAIN'
          question_id: string | null
          question_text: string
          description: string | null
          max_points: number
          weight: number
          display_order: number
          is_mandatory: boolean
          severity: 'CRITICAL' | 'MAJOR' | 'MINOR'
          created_at: string
        }
        Insert: {
          id?: string
          audit_session_id: string
          original_checklist_item_id?: string | null
          pillar: 'SORT' | 'SET_IN_ORDER' | 'SHINE' | 'STANDARDIZE' | 'SUSTAIN'
          question_id?: string | null
          question_text: string
          description?: string | null
          max_points?: number
          weight?: number
          display_order?: number
          is_mandatory?: boolean
          severity?: 'CRITICAL' | 'MAJOR' | 'MINOR'
        }
        Update: Record<string, never>
        Relationships: []
      }
      audit_item_responses: {
        Row: {
          id: string
          audit_session_id: string
          session_item_id: string
          manual_score: number | null
          // Phase 2: ai_score replaced by ai_answer enum
          ai_answer: 'YES' | 'NO' | 'PARTIAL' | 'NOT_VISIBLE' | 'NOT_APPLICABLE' | null
          evidence: string | null
          ai_question_id: string | null
          final_score: number | null
          confidence: number | null  // metadata only — never used in scoring
          reviewer_comment: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          audit_session_id: string
          session_item_id: string
          manual_score?: number | null
          ai_answer?: 'YES' | 'NO' | 'PARTIAL' | 'NOT_VISIBLE' | 'NOT_APPLICABLE' | null
          evidence?: string | null
          ai_question_id?: string | null
          final_score?: number | null
          confidence?: number | null
          reviewer_comment?: string | null
          notes?: string | null
        }
        Update: {
          manual_score?: number | null
          ai_answer?: 'YES' | 'NO' | 'PARTIAL' | 'NOT_VISIBLE' | 'NOT_APPLICABLE' | null
          evidence?: string | null
          ai_question_id?: string | null
          final_score?: number | null
          confidence?: number | null
          reviewer_comment?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_critical_rules: {
        Row: {
          id: string
          template_id: string | null
          checklist_item_id: string
          pillar: 'SORT' | 'SET_IN_ORDER' | 'SHINE' | 'STANDARDIZE' | 'SUSTAIN'
          trigger_answer: 'YES' | 'NO' | 'PARTIAL' | 'NOT_VISIBLE' | 'NOT_APPLICABLE'
          score_cap: number
          description: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          template_id?: string | null
          checklist_item_id: string
          pillar: 'SORT' | 'SET_IN_ORDER' | 'SHINE' | 'STANDARDIZE' | 'SUSTAIN'
          trigger_answer?: 'YES' | 'NO' | 'PARTIAL' | 'NOT_VISIBLE' | 'NOT_APPLICABLE'
          score_cap: number
          description?: string | null
          is_active?: boolean
        }
        Update: {
          is_active?: boolean
          score_cap?: number
          description?: string | null
        }
        Relationships: []
      }
      audit_prompt_versions: {
        Row: {
          id: string
          prompt_type: string
          version: string
          vision_model: string
          temperature: number
          schema_version: string
          prompt_text: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          prompt_type: string
          version?: string
          vision_model?: string
          temperature?: number
          schema_version?: string
          prompt_text: string
          is_active?: boolean
        }
        Update: {
          is_active?: boolean
          prompt_text?: string
        }
        Relationships: []
      }
      audit_recommendations: {
        Row: {
          id: string
          audit_session_id: string
          pillar: 'SORT' | 'SET_IN_ORDER' | 'SHINE' | 'STANDARDIZE' | 'SUSTAIN'
          severity: 'CRITICAL' | 'MAJOR' | 'MINOR'
          priority: number
          title: string
          description: string
          root_cause: string | null
          corrective_action: string | null
          linked_question_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          audit_session_id: string
          pillar: 'SORT' | 'SET_IN_ORDER' | 'SHINE' | 'STANDARDIZE' | 'SUSTAIN'
          severity?: 'CRITICAL' | 'MAJOR' | 'MINOR'
          priority?: number
          title: string
          description: string
          root_cause?: string | null
          corrective_action?: string | null
          linked_question_id?: string | null
        }
        Update: Record<string, never>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      audit_answer_state: ['YES', 'NO', 'PARTIAL', 'NOT_VISIBLE', 'NOT_APPLICABLE'] as const,
      audit_severity:     ['CRITICAL', 'MAJOR', 'MINOR'] as const,
      audit_pillar:       ['SORT', 'SET_IN_ORDER', 'SHINE', 'STANDARDIZE', 'SUSTAIN'] as const,
    },
  },
} as const
