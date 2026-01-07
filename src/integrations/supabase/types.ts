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
      caregiver_alerts: {
        Row: {
          alert_type: string
          caregiver_id: string
          created_at: string
          id: string
          is_read: boolean
          medication_log_id: string
          message: string
          patient_id: string
        }
        Insert: {
          alert_type: string
          caregiver_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          medication_log_id: string
          message: string
          patient_id: string
        }
        Update: {
          alert_type?: string
          caregiver_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          medication_log_id?: string
          message?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_alerts_medication_log_id_fkey"
            columns: ["medication_log_id"]
            isOneToOne: false
            referencedRelation: "medication_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_alerts: {
        Row: {
          acknowledged_at: string | null
          caregiver_id: string
          created_at: string
          id: string
          is_acknowledged: boolean
          message: string
          patient_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          caregiver_id: string
          created_at?: string
          id?: string
          is_acknowledged?: boolean
          message?: string
          patient_id: string
        }
        Update: {
          acknowledged_at?: string | null
          caregiver_id?: string
          created_at?: string
          id?: string
          is_acknowledged?: boolean
          message?: string
          patient_id?: string
        }
        Relationships: []
      }
      medication_logs: {
        Row: {
          action_taken_at: string | null
          created_at: string
          id: string
          medication_id: string
          patient_id: string
          scheduled_date: string
          scheduled_time: string
          snooze_count: number | null
          snoozed_until: string | null
          status: Database["public"]["Enums"]["medication_status"]
          updated_at: string
        }
        Insert: {
          action_taken_at?: string | null
          created_at?: string
          id?: string
          medication_id: string
          patient_id: string
          scheduled_date: string
          scheduled_time: string
          snooze_count?: number | null
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["medication_status"]
          updated_at?: string
        }
        Update: {
          action_taken_at?: string | null
          created_at?: string
          id?: string
          medication_id?: string
          patient_id?: string
          scheduled_date?: string
          scheduled_time?: string
          snooze_count?: number | null
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["medication_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_logs_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string
          created_by: string | null
          dosage: string
          frequency: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          patient_id: string
          scheduled_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dosage: string
          frequency?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          patient_id: string
          scheduled_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dosage?: string
          frequency?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          patient_id?: string
          scheduled_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      patient_caregiver_links: {
        Row: {
          approved_at: string | null
          caregiver_id: string
          created_at: string
          id: string
          patient_id: string
          status: string
        }
        Insert: {
          approved_at?: string | null
          caregiver_id: string
          created_at?: string
          id?: string
          patient_id: string
          status?: string
        }
        Update: {
          approved_at?: string | null
          caregiver_id?: string
          created_at?: string
          id?: string
          patient_id?: string
          status?: string
        }
        Relationships: []
      }
      patient_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          patient_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          patient_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          patient_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_patient_code: { Args: never; Returns: string }
      get_linked_patient: { Args: { _caregiver_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      verify_patient_code: { Args: { _code: string }; Returns: string }
    }
    Enums: {
      app_role: "patient" | "caregiver"
      medication_status: "pending" | "taken" | "snoozed" | "missed"
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
      app_role: ["patient", "caregiver"],
      medication_status: ["pending", "taken", "snoozed", "missed"],
    },
  },
} as const
