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
      badges: {
        Row: {
          active: boolean
          category: string
          code: string
          condition_topic: string | null
          condition_type: string
          condition_value: number
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          xp_reward: number
        }
        Insert: {
          active?: boolean
          category?: string
          code: string
          condition_topic?: string | null
          condition_type: string
          condition_value?: number
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name: string
          xp_reward?: number
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          condition_topic?: string | null
          condition_type?: string
          condition_value?: number
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          xp_reward?: number
        }
        Relationships: []
      }
      exam_attempts: {
        Row: {
          answers: Json
          correct_count: number | null
          duration_seconds: number | null
          exam_id: string
          extra_fields: Json
          id: string
          passed: boolean | null
          question_ids: string[]
          score: number | null
          started_at: string
          status: Database["public"]["Enums"]["attempt_status"]
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          answers?: Json
          correct_count?: number | null
          duration_seconds?: number | null
          exam_id: string
          extra_fields?: Json
          id?: string
          passed?: boolean | null
          question_ids?: string[]
          score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          submitted_at?: string | null
          user_id: string
        }
        Update: {
          answers?: Json
          correct_count?: number | null
          duration_seconds?: number | null
          exam_id?: string
          extra_fields?: Json
          id?: string
          passed?: boolean | null
          question_ids?: string[]
          score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_invitations: {
        Row: {
          created_at: string
          email: string
          exam_id: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          exam_id: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          exam_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_invitations_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          access: Database["public"]["Enums"]["exam_access"]
          active: boolean
          created_at: string
          created_by: string | null
          description: string
          duration_minutes: number
          enable_badges: boolean
          enable_leaderboard: boolean
          enable_xp: boolean
          extra_fields: Json
          id: string
          leaderboard_name_display: Database["public"]["Enums"]["name_display"]
          max_attempts: number
          mode: Database["public"]["Enums"]["exam_mode"]
          organization: string | null
          pass_mark: number
          question_count: number
          show_others: boolean
          show_rank: boolean
          starts_at: string | null
          ends_at: string | null
          team_group: string | null
          title: string
          topic: string
        }
        Insert: {
          access?: Database["public"]["Enums"]["exam_access"]
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string
          duration_minutes?: number
          enable_badges?: boolean
          enable_leaderboard?: boolean
          enable_xp?: boolean
          extra_fields?: Json
          id?: string
          leaderboard_name_display?: Database["public"]["Enums"]["name_display"]
          max_attempts?: number
          mode?: Database["public"]["Enums"]["exam_mode"]
          organization?: string | null
          pass_mark?: number
          question_count?: number
          show_others?: boolean
          show_rank?: boolean
          starts_at?: string | null
          ends_at?: string | null
          team_group?: string | null
          title: string
          topic?: string
        }
        Update: {
          access?: Database["public"]["Enums"]["exam_access"]
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string
          duration_minutes?: number
          enable_badges?: boolean
          enable_leaderboard?: boolean
          enable_xp?: boolean
          extra_fields?: Json
          id?: string
          leaderboard_name_display?: Database["public"]["Enums"]["name_display"]
          max_attempts?: number
          mode?: Database["public"]["Enums"]["exam_mode"]
          organization?: string | null
          pass_mark?: number
          question_count?: number
          show_others?: boolean
          show_rank?: boolean
          starts_at?: string | null
          ends_at?: string | null
          team_group?: string | null
          title?: string
          topic?: string
        }
        Relationships: []
      }
      levels: {
        Row: {
          level: number
          min_xp: number
          name: string
        }
        Insert: {
          level: number
          min_xp: number
          name: string
        }
        Update: {
          level?: number
          min_xp?: number
          name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          icon: string
          id: string
          kind: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          icon?: string
          id?: string
          kind?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          icon?: string
          id?: string
          kind?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          display_name: string | null
          email: string
          full_name: string
          id: string
          leaderboard_opt_out: boolean
          mobile: string | null
          organization: string | null
          participant_id: string | null
          team_group: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          display_name?: string | null
          email?: string
          full_name?: string
          id: string
          leaderboard_opt_out?: boolean
          mobile?: string | null
          organization?: string | null
          participant_id?: string | null
          team_group?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          display_name?: string | null
          email?: string
          full_name?: string
          id?: string
          leaderboard_opt_out?: boolean
          mobile?: string | null
          organization?: string | null
          participant_id?: string | null
          team_group?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_index: number
          correct_indexes: number[]
          created_at: string
          exam_id: string
          explanation: string
          id: string
          options: Json
          points: number
          prompt: string
          subtopic: string
        }
        Insert: {
          correct_index?: number
          correct_indexes?: number[]
          created_at?: string
          exam_id: string
          explanation?: string
          id?: string
          options?: Json
          points?: number
          prompt: string
          subtopic?: string
        }
        Update: {
          correct_index?: number
          correct_indexes?: number[]
          created_at?: string
          exam_id?: string
          explanation?: string
          id?: string
          options?: Json
          points?: number
          prompt?: string
          subtopic?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_mastery: {
        Row: {
          correct_count: number
          id: string
          mastery: number
          subtopic: string
          topic: string
          total_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          correct_count?: number
          id?: string
          mastery?: number
          subtopic?: string
          topic: string
          total_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          correct_count?: number
          id?: string
          mastery?: number
          subtopic?: string
          topic?: string
          total_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          current_count: number
          id: string
          last_activity_at: string | null
          longest_count: number
          streak_type: string
          user_id: string
        }
        Insert: {
          current_count?: number
          id?: string
          last_activity_at?: string | null
          longest_count?: number
          streak_type: string
          user_id: string
        }
        Update: {
          current_count?: number
          id?: string
          last_activity_at?: string | null
          longest_count?: number
          streak_type?: string
          user_id?: string
        }
        Relationships: []
      }
      xp_rules: {
        Row: {
          active: boolean
          code: string
          label: string
          points: number
        }
        Insert: {
          active?: boolean
          code: string
          label: string
          points?: number
        }
        Update: {
          active?: boolean
          code?: string
          label?: string
          points?: number
        }
        Relationships: []
      }
      xp_transactions: {
        Row: {
          created_at: string
          id: string
          points: number
          reference_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points: number
          reference_id?: string | null
          source: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          reference_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_exam: {
        Args: { _exam_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "participant"
      attempt_status: "in_progress" | "submitted"
      exam_access: "public" | "private" | "organization" | "group"
      exam_mode: "practice" | "assessment" | "competitive" | "certification"
      name_display: "full_name" | "first_initial" | "display_name" | "anonymous"
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
      app_role: ["admin", "participant"],
      attempt_status: ["in_progress", "submitted"],
      exam_access: ["public", "private", "organization", "group"],
      exam_mode: ["practice", "assessment", "competitive", "certification"],
      name_display: ["full_name", "first_initial", "display_name", "anonymous"],
    },
  },
} as const
