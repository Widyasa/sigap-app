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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          body: string
          created_by: string | null
          dinas_id: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          is_pinned: boolean
          kelurahan: string | null
          published_at: string
          title: string
        }
        Insert: {
          body: string
          created_by?: string | null
          dinas_id?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          kelurahan?: string | null
          published_at?: string
          title: string
        }
        Update: {
          body?: string
          created_by?: string | null
          dinas_id?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          kelurahan?: string | null
          published_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_dinas_id_fkey"
            columns: ["dinas_id"]
            isOneToOne: false
            referencedRelation: "dinas"
            referencedColumns: ["id"]
          },
        ]
      }
      aspiration_votes: {
        Row: {
          aspiration_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          aspiration_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          aspiration_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aspiration_votes_aspiration_id_fkey"
            columns: ["aspiration_id"]
            isOneToOne: false
            referencedRelation: "aspirations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aspiration_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aspirations: {
        Row: {
          category: string | null
          created_at: string
          description: string
          embedding: string | null
          estimated_beneficiaries: number | null
          estimated_cost: number | null
          id: string
          image_urls: string[]
          kecamatan: string
          kelurahan: string
          linked_budget_item_id: string | null
          location_lat: number | null
          location_lng: number | null
          musrenbang_rank: number | null
          status: string
          title: string
          user_id: string
          vote_count: number
          voting_period_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description: string
          embedding?: string | null
          estimated_beneficiaries?: number | null
          estimated_cost?: number | null
          id?: string
          image_urls?: string[]
          kecamatan: string
          kelurahan: string
          linked_budget_item_id?: string | null
          location_lat?: number | null
          location_lng?: number | null
          musrenbang_rank?: number | null
          status?: string
          title: string
          user_id: string
          vote_count?: number
          voting_period_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string
          embedding?: string | null
          estimated_beneficiaries?: number | null
          estimated_cost?: number | null
          id?: string
          image_urls?: string[]
          kecamatan?: string
          kelurahan?: string
          linked_budget_item_id?: string | null
          location_lat?: number | null
          location_lng?: number | null
          musrenbang_rank?: number | null
          status?: string
          title?: string
          user_id?: string
          vote_count?: number
          voting_period_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aspirations_linked_budget_item_id_fkey"
            columns: ["linked_budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aspirations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aspirations_voting_period_id_fkey"
            columns: ["voting_period_id"]
            isOneToOne: false
            referencedRelation: "voting_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: number
          requester_ip: unknown
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: number
          requester_ip?: unknown
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: number
          requester_ip?: unknown
        }
        Relationships: []
      }
      auth_sessions: {
        Row: {
          created_at: string
          device_label: string | null
          expires_at: string
          id: string
          last_used_at: string
          refresh_token_hash: string
          revoked_at: string | null
          revoked_reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          expires_at: string
          id?: string
          last_used_at?: string
          refresh_token_hash: string
          revoked_at?: string | null
          revoked_reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          expires_at?: string
          id?: string
          last_used_at?: string
          refresh_token_hash?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          activity_name: string | null
          budget_allocated: number
          budget_realized: number
          contractor: string | null
          dinas_id: string | null
          embedding: string | null
          fiscal_year: number
          id: string
          kecamatan: string | null
          kelurahan: string | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          photo_urls: string[]
          program_name: string
          progress_percent: number
          updated_at: string
        }
        Insert: {
          activity_name?: string | null
          budget_allocated: number
          budget_realized?: number
          contractor?: string | null
          dinas_id?: string | null
          embedding?: string | null
          fiscal_year: number
          id?: string
          kecamatan?: string | null
          kelurahan?: string | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          photo_urls?: string[]
          program_name: string
          progress_percent?: number
          updated_at?: string
        }
        Update: {
          activity_name?: string | null
          budget_allocated?: number
          budget_realized?: number
          contractor?: string | null
          dinas_id?: string | null
          embedding?: string | null
          fiscal_year?: number
          id?: string
          kecamatan?: string | null
          kelurahan?: string | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          photo_urls?: string[]
          program_name?: string
          progress_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_dinas_id_fkey"
            columns: ["dinas_id"]
            isOneToOne: false
            referencedRelation: "dinas"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_timeline: {
        Row: {
          actor_id: string | null
          complaint_id: string
          created_at: string
          event_type: string
          id: number
          note: string | null
          photo_urls: string[]
        }
        Insert: {
          actor_id?: string | null
          complaint_id: string
          created_at?: string
          event_type: string
          id?: number
          note?: string | null
          photo_urls?: string[]
        }
        Update: {
          actor_id?: string | null
          complaint_id?: string
          created_at?: string
          event_type?: string
          id?: number
          note?: string | null
          photo_urls?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "complaint_timeline_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaint_timeline_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_upvotes: {
        Row: {
          complaint_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          complaint_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          complaint_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_upvotes_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaint_upvotes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          ai_confidence: number | null
          ai_summary: string | null
          assigned_dinas: string | null
          category: string | null
          created_at: string
          description: string
          duplicate_of: string | null
          embedding: string | null
          id: string
          image_urls: string[]
          kecamatan: string | null
          kelurahan: string | null
          location_address: string | null
          location_lat: number
          location_lng: number
          rejection_reason: string | null
          resolved_at: string | null
          sla_due_at: string | null
          status: string
          title: string | null
          upvote_count: number
          urgency: string | null
          user_id: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_summary?: string | null
          assigned_dinas?: string | null
          category?: string | null
          created_at?: string
          description: string
          duplicate_of?: string | null
          embedding?: string | null
          id?: string
          image_urls?: string[]
          kecamatan?: string | null
          kelurahan?: string | null
          location_address?: string | null
          location_lat: number
          location_lng: number
          rejection_reason?: string | null
          resolved_at?: string | null
          sla_due_at?: string | null
          status?: string
          title?: string | null
          upvote_count?: number
          urgency?: string | null
          user_id: string
        }
        Update: {
          ai_confidence?: number | null
          ai_summary?: string | null
          assigned_dinas?: string | null
          category?: string | null
          created_at?: string
          description?: string
          duplicate_of?: string | null
          embedding?: string | null
          id?: string
          image_urls?: string[]
          kecamatan?: string | null
          kelurahan?: string | null
          location_address?: string | null
          location_lat?: number
          location_lng?: number
          rejection_reason?: string | null
          resolved_at?: string | null
          sla_due_at?: string | null
          status?: string
          title?: string | null
          upvote_count?: number
          urgency?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_assigned_dinas_fkey"
            columns: ["assigned_dinas"]
            isOneToOne: false
            referencedRelation: "dinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dinas: {
        Row: {
          categories: string[]
          contact_email: string | null
          contact_phone: string | null
          head_name: string | null
          id: string
          name: string
          sla_hours_p0: number
          sla_hours_p1: number
          sla_hours_p2: number
        }
        Insert: {
          categories?: string[]
          contact_email?: string | null
          contact_phone?: string | null
          head_name?: string | null
          id: string
          name: string
          sla_hours_p0?: number
          sla_hours_p1?: number
          sla_hours_p2?: number
        }
        Update: {
          categories?: string[]
          contact_email?: string | null
          contact_phone?: string | null
          head_name?: string | null
          id?: string
          name?: string
          sla_hours_p0?: number
          sla_hours_p1?: number
          sla_hours_p2?: number
        }
        Relationships: []
      }
      emergency_alerts: {
        Row: {
          audio_url: string | null
          created_at: string
          emergency_type: string
          id: string
          location_address: string | null
          location_lat: number
          location_lng: number
          note: string | null
          resolved_at: string | null
          responded_at: string | null
          responded_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          emergency_type: string
          id?: string
          location_address?: string | null
          location_lat: number
          location_lng: number
          note?: string | null
          resolved_at?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          emergency_type?: string
          id?: string
          location_address?: string | null
          location_lat?: number
          location_lng?: number
          note?: string | null
          resolved_at?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_alerts_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      point_ledger: {
        Row: {
          created_at: string
          id: number
          points: number
          reason: string
          ref_id: string | null
          ref_table: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          points: number
          reason: string
          ref_id?: string | null
          ref_table?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          points?: number
          reason?: string
          ref_id?: string | null
          ref_table?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          dinas_id: string | null
          full_name: string
          id: string
          kecamatan: string | null
          kelurahan: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          dinas_id?: string | null
          full_name: string
          id: string
          kecamatan?: string | null
          kelurahan?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          dinas_id?: string | null
          full_name?: string
          id?: string
          kecamatan?: string | null
          kelurahan?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_dinas_id_fkey"
            columns: ["dinas_id"]
            isOneToOne: false
            referencedRelation: "dinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          document_urls: string[]
          form_data: Json
          handled_by: string | null
          id: string
          output_pdf_url: string | null
          rejection_reason: string | null
          service_type: string
          status: string
          user_id: string
          verification_code: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          document_urls?: string[]
          form_data: Json
          handled_by?: string | null
          id?: string
          output_pdf_url?: string | null
          rejection_reason?: string | null
          service_type: string
          status?: string
          user_id: string
          verification_code?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          document_urls?: string[]
          form_data?: Json
          handled_by?: string | null
          id?: string
          output_pdf_url?: string | null
          rejection_reason?: string | null
          service_type?: string
          status?: string
          user_id?: string
          verification_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          disabled_at: string | null
          email: string
          email_verified_at: string | null
          id: string
          last_login_at: string | null
        }
        Insert: {
          created_at?: string
          disabled_at?: string | null
          email: string
          email_verified_at?: string | null
          id?: string
          last_login_at?: string | null
        }
        Update: {
          created_at?: string
          disabled_at?: string | null
          email?: string
          email_verified_at?: string | null
          id?: string
          last_login_at?: string | null
        }
        Relationships: []
      }
      voting_periods: {
        Row: {
          ends_at: string
          fiscal_year: number
          id: string
          is_active: boolean
          name: string
          starts_at: string
        }
        Insert: {
          ends_at: string
          fiscal_year: number
          id?: string
          is_active?: boolean
          name: string
          starts_at: string
        }
        Update: {
          ends_at?: string
          fiscal_year?: number
          id?: string
          is_active?: boolean
          name?: string
          starts_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      kelurahan_leaderboard: {
        Row: {
          citizen_count: number | null
          kecamatan: string | null
          kelurahan: string | null
          report_count: number | null
          resolved_count: number | null
          total_points: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_otp_rate_limit: {
        Args: { p_email: string; p_ip: unknown }
        Returns: {
          allowed: boolean
          reason: string
          retry_after_seconds: number
        }[]
      }
      current_dinas_id: { Args: never; Returns: string }
      current_role_name: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      disable_user: {
        Args: { p_disabled: boolean; p_user_id: string }
        Returns: undefined
      }
      earth: { Args: never; Returns: number }
      find_duplicate_complaints: {
        Args: {
          query_embedding: string
          query_lat: number
          query_lng: number
          radius_meters?: number
          similarity_threshold?: number
        }
        Returns: {
          distance_meters: number
          id: string
          similarity: number
          title: string
          upvote_count: number
        }[]
      }
      find_or_create_user: {
        Args: { p_email: string }
        Returns: {
          is_disabled: boolean
          is_new: boolean
          user_id: string
        }[]
      }
      purge_expired_auth_rows: { Args: never; Returns: undefined }
      refresh_leaderboard: { Args: never; Returns: undefined }
      search_budget_items: {
        Args: {
          filter_year?: number
          match_count?: number
          query_embedding: string
        }
        Returns: {
          activity_name: string
          budget_allocated: number
          budget_realized: number
          dinas_id: string
          id: string
          kelurahan: string
          program_name: string
          progress_percent: number
          similarity: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      user_total_points: { Args: { target_user: string }; Returns: number }
      verify_service_document: {
        Args: { code: string }
        Returns: {
          issued_at: string
          service_type: string
          status: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      user_role:
        | "citizen"
        | "verifier"
        | "dinas_staff"
        | "dinas_head"
        | "emergency_operator"
        | "admin"
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
      user_role: [
        "citizen",
        "verifier",
        "dinas_staff",
        "dinas_head",
        "emergency_operator",
        "admin",
      ],
    },
  },
} as const
