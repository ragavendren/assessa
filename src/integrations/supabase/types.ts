export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      badges: {
        Row: {
          active: boolean;
          category: string;
          track: string;
          code: string;
          condition_topic: string | null;
          condition_type: string;
          condition_value: number;
          created_at: string;
          description: string;
          icon: string;
          id: string;
          name: string;
          xp_reward: number;
        };
        Insert: {
          active?: boolean;
          category?: string;
          track?: string;
          code: string;
          condition_topic?: string | null;
          condition_type: string;
          condition_value?: number;
          created_at?: string;
          description?: string;
          icon?: string;
          id?: string;
          name: string;
          xp_reward?: number;
        };
        Update: {
          active?: boolean;
          category?: string;
          track?: string;
          code?: string;
          condition_topic?: string | null;
          condition_type?: string;
          condition_value?: number;
          created_at?: string;
          description?: string;
          icon?: string;
          id?: string;
          name?: string;
          xp_reward?: number;
        };
        Relationships: [];
      };
      exam_attempts: {
        Row: {
          answers: Json;
          correct_count: number | null;
          duration_seconds: number | null;
          exam_id: string;
          extra_fields: Json;
          id: string;
          passed: boolean | null;
          question_ids: string[];
          score: number | null;
          started_at: string;
          status: Database["public"]["Enums"]["attempt_status"];
          submitted_at: string | null;
          user_id: string;
        };
        Insert: {
          answers?: Json;
          correct_count?: number | null;
          duration_seconds?: number | null;
          exam_id: string;
          extra_fields?: Json;
          id?: string;
          passed?: boolean | null;
          question_ids?: string[];
          score?: number | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["attempt_status"];
          submitted_at?: string | null;
          user_id: string;
        };
        Update: {
          answers?: Json;
          correct_count?: number | null;
          duration_seconds?: number | null;
          exam_id?: string;
          extra_fields?: Json;
          id?: string;
          passed?: boolean | null;
          question_ids?: string[];
          score?: number | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["attempt_status"];
          submitted_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exam_attempts_exam_id_fkey";
            columns: ["exam_id"];
            isOneToOne: false;
            referencedRelation: "exams";
            referencedColumns: ["id"];
          },
        ];
      };
      exam_invitations: {
        Row: {
          created_at: string;
          email: string;
          exam_id: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          exam_id: string;
          id?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          exam_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exam_invitations_exam_id_fkey";
            columns: ["exam_id"];
            isOneToOne: false;
            referencedRelation: "exams";
            referencedColumns: ["id"];
          },
        ];
      };
      departments: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      exams: {
        Row: {
          access: Database["public"]["Enums"]["exam_access"];
          active: boolean;
          created_at: string;
          created_by: string | null;
          description: string;
          duration_minutes: number;
          enable_badges: boolean;
          enable_leaderboard: boolean;
          enable_xp: boolean;
          extra_fields: Json;
          id: string;
          leaderboard_name_display: Database["public"]["Enums"]["name_display"];
          max_attempts: number;
          mode: Database["public"]["Enums"]["exam_mode"];
          organization: string | null;
          pass_mark: number;
          question_count: number;
          question_selection_method: Database["public"]["Enums"]["question_selection_method"];
          course_id: string | null;
          question_pool_id: string | null;
          blueprint_id: string | null;
          series_id: string | null;
          reuse_policy: Database["public"]["Enums"]["question_reuse_policy"] | null;
          reuse_last_n: number | null;
          generation_locked_at: string | null;
          show_others: boolean;
          show_rank: boolean;
          starts_at: string | null;
          ends_at: string | null;
          team_group: string | null;
          title: string;
          topic: string;
        };
        Insert: {
          access?: Database["public"]["Enums"]["exam_access"];
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          duration_minutes?: number;
          enable_badges?: boolean;
          enable_leaderboard?: boolean;
          enable_xp?: boolean;
          extra_fields?: Json;
          id?: string;
          leaderboard_name_display?: Database["public"]["Enums"]["name_display"];
          max_attempts?: number;
          mode?: Database["public"]["Enums"]["exam_mode"];
          organization?: string | null;
          pass_mark?: number;
          question_count?: number;
          question_selection_method?: Database["public"]["Enums"]["question_selection_method"];
          course_id?: string | null;
          question_pool_id?: string | null;
          blueprint_id?: string | null;
          series_id?: string | null;
          reuse_policy?: Database["public"]["Enums"]["question_reuse_policy"] | null;
          reuse_last_n?: number | null;
          generation_locked_at?: string | null;
          show_others?: boolean;
          show_rank?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          team_group?: string | null;
          title: string;
          topic?: string;
        };
        Update: {
          access?: Database["public"]["Enums"]["exam_access"];
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          duration_minutes?: number;
          enable_badges?: boolean;
          enable_leaderboard?: boolean;
          enable_xp?: boolean;
          extra_fields?: Json;
          id?: string;
          leaderboard_name_display?: Database["public"]["Enums"]["name_display"];
          max_attempts?: number;
          mode?: Database["public"]["Enums"]["exam_mode"];
          organization?: string | null;
          pass_mark?: number;
          question_count?: number;
          question_selection_method?: Database["public"]["Enums"]["question_selection_method"];
          course_id?: string | null;
          question_pool_id?: string | null;
          blueprint_id?: string | null;
          series_id?: string | null;
          reuse_policy?: Database["public"]["Enums"]["question_reuse_policy"] | null;
          reuse_last_n?: number | null;
          generation_locked_at?: string | null;
          show_others?: boolean;
          show_rank?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          team_group?: string | null;
          title?: string;
          topic?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exams_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exams_question_pool_id_fkey";
            columns: ["question_pool_id"];
            isOneToOne: false;
            referencedRelation: "question_pools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exams_blueprint_id_fkey";
            columns: ["blueprint_id"];
            isOneToOne: false;
            referencedRelation: "course_blueprints";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exams_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "assessment_series";
            referencedColumns: ["id"];
          },
        ];
      };
      courses: {
        Row: {
          id: string;
          name: string;
          status: Database["public"]["Enums"]["catalog_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          status?: Database["public"]["Enums"]["catalog_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          status?: Database["public"]["Enums"]["catalog_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      question_pools: {
        Row: {
          id: string;
          course_id: string;
          name: string;
          status: Database["public"]["Enums"]["catalog_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          name: string;
          status?: Database["public"]["Enums"]["catalog_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          name?: string;
          status?: Database["public"]["Enums"]["catalog_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_pools_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
        ];
      };
      pool_questions: {
        Row: {
          id: string;
          pool_id: string;
          prompt: string;
          options: Json;
          correct_index: number;
          correct_indexes: number[];
          multi_select: boolean;
          explanation: string;
          topic: string;
          subtopic: string;
          difficulty: Database["public"]["Enums"]["question_difficulty"];
          skill: string;
          tags: string[];
          marks: number;
          status: Database["public"]["Enums"]["catalog_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pool_id: string;
          prompt: string;
          options?: Json;
          correct_index?: number;
          correct_indexes?: number[];
          multi_select?: boolean;
          explanation?: string;
          topic?: string;
          subtopic?: string;
          difficulty?: Database["public"]["Enums"]["question_difficulty"];
          skill?: string;
          tags?: string[];
          marks?: number;
          status?: Database["public"]["Enums"]["catalog_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pool_id?: string;
          prompt?: string;
          options?: Json;
          correct_index?: number;
          correct_indexes?: number[];
          multi_select?: boolean;
          explanation?: string;
          topic?: string;
          subtopic?: string;
          difficulty?: Database["public"]["Enums"]["question_difficulty"];
          skill?: string;
          tags?: string[];
          marks?: number;
          status?: Database["public"]["Enums"]["catalog_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pool_questions_pool_id_fkey";
            columns: ["pool_id"];
            isOneToOne: false;
            referencedRelation: "question_pools";
            referencedColumns: ["id"];
          },
        ];
      };
      play_settings: {
        Row: { id: string; menu_enabled: boolean; updated_at: string };
        Insert: { id?: string; menu_enabled?: boolean; updated_at?: string };
        Update: { id?: string; menu_enabled?: boolean; updated_at?: string };
        Relationships: [];
      };
      challenges: {
        Row: {
          id: string;
          kind: string;
          name: string;
          course_id: string | null;
          pool_id: string | null;
          topic: string | null;
          rules: Json;
          status: Database["public"]["Enums"]["catalog_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kind: string;
          name: string;
          course_id?: string | null;
          pool_id?: string | null;
          topic?: string | null;
          rules?: Json;
          status?: Database["public"]["Enums"]["catalog_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          kind?: string;
          name?: string;
          course_id?: string | null;
          pool_id?: string | null;
          topic?: string | null;
          rules?: Json;
          status?: Database["public"]["Enums"]["catalog_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      challenge_instances: {
        Row: {
          id: string;
          challenge_id: string;
          period_key: string;
          question_ids: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          challenge_id: string;
          period_key: string;
          question_ids?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          challenge_id?: string;
          period_key?: string;
          question_ids?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      play_matches: {
        Row: {
          id: string;
          challenge_id: string;
          instance_id: string | null;
          inviter_id: string;
          invitee_id: string | null;
          invitee_email: string | null;
          status: string;
          winner_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          challenge_id: string;
          instance_id?: string | null;
          inviter_id: string;
          invitee_id?: string | null;
          invitee_email?: string | null;
          status?: string;
          winner_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          challenge_id?: string;
          instance_id?: string | null;
          inviter_id?: string;
          invitee_id?: string | null;
          invitee_email?: string | null;
          status?: string;
          winner_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      play_sessions: {
        Row: {
          id: string;
          user_id: string;
          challenge_id: string;
          instance_id: string | null;
          match_id: string | null;
          kind: string;
          topic: string | null;
          status: string;
          question_ids: string[];
          answers: Json;
          current_index: number;
          lives_left: number | null;
          ends_at: string | null;
          question_ends_at: string | null;
          score: number | null;
          correct_count: number | null;
          duration_seconds: number | null;
          time_bonus: number | null;
          extra: Json;
          started_at: string;
          submitted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          challenge_id: string;
          instance_id?: string | null;
          match_id?: string | null;
          kind: string;
          topic?: string | null;
          status?: string;
          question_ids?: string[];
          answers?: Json;
          current_index?: number;
          lives_left?: number | null;
          ends_at?: string | null;
          question_ends_at?: string | null;
          score?: number | null;
          correct_count?: number | null;
          duration_seconds?: number | null;
          time_bonus?: number | null;
          extra?: Json;
          started_at?: string;
          submitted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          challenge_id?: string;
          instance_id?: string | null;
          match_id?: string | null;
          kind?: string;
          topic?: string | null;
          status?: string;
          question_ids?: string[];
          answers?: Json;
          current_index?: number;
          lives_left?: number | null;
          ends_at?: string | null;
          question_ends_at?: string | null;
          score?: number | null;
          correct_count?: number | null;
          duration_seconds?: number | null;
          time_bonus?: number | null;
          extra?: Json;
          started_at?: string;
          submitted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "play_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      play_rewards: {
        Row: {
          id: string;
          user_id: string;
          session_id: string | null;
          source: string;
          code: string;
          label: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id?: string | null;
          source: string;
          code: string;
          label?: string;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string | null;
          source?: string;
          code?: string;
          label?: string;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      play_entitlements: {
        Row: {
          id: string;
          user_id: string;
          code: string;
          remaining: number;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          code: string;
          remaining?: number;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          code?: string;
          remaining?: number;
          expires_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      flash_progress: {
        Row: { user_id: string; question_id: string; known: boolean; updated_at: string };
        Insert: { user_id: string; question_id: string; known?: boolean; updated_at?: string };
        Update: { user_id?: string; question_id?: string; known?: boolean; updated_at?: string };
        Relationships: [];
      };
      escape_scenarios: {
        Row: {
          id: string;
          name: string;
          intro: string;
          course_id: string | null;
          pool_id: string | null;
          status: Database["public"]["Enums"]["catalog_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          intro?: string;
          course_id?: string | null;
          pool_id?: string | null;
          status?: Database["public"]["Enums"]["catalog_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          intro?: string;
          course_id?: string | null;
          pool_id?: string | null;
          status?: Database["public"]["Enums"]["catalog_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      escape_scenes: {
        Row: {
          id: string;
          scenario_id: string;
          sort_order: number;
          title: string;
          body: string;
          topic: string;
          question_count: number;
        };
        Insert: {
          id?: string;
          scenario_id: string;
          sort_order?: number;
          title: string;
          body?: string;
          topic?: string;
          question_count?: number;
        };
        Update: {
          id?: string;
          scenario_id?: string;
          sort_order?: number;
          title?: string;
          body?: string;
          topic?: string;
          question_count?: number;
        };
        Relationships: [];
      };
      play_tournaments: {
        Row: {
          id: string;
          name: string;
          size: number;
          pool_id: string | null;
          status: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          size?: number;
          pool_id?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          size?: number;
          pool_id?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      play_tournament_entrants: {
        Row: { tournament_id: string; user_id: string; seed: number | null };
        Insert: { tournament_id: string; user_id: string; seed?: number | null };
        Update: { tournament_id?: string; user_id?: string; seed?: number | null };
        Relationships: [
          {
            foreignKeyName: "play_tournament_entrants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      play_tournament_matches: {
        Row: {
          id: string;
          tournament_id: string;
          round: number;
          slot: number;
          player_a: string | null;
          player_b: string | null;
          match_id: string | null;
          winner_id: string | null;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          round: number;
          slot: number;
          player_a?: string | null;
          player_b?: string | null;
          match_id?: string | null;
          winner_id?: string | null;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          round?: number;
          slot?: number;
          player_a?: string | null;
          player_b?: string | null;
          match_id?: string | null;
          winner_id?: string | null;
        };
        Relationships: [];
      };
      course_blueprints: {
        Row: {
          id: string;
          course_id: string;
          name: string;
          version: number;
          status: Database["public"]["Enums"]["catalog_status"];
          default_total_questions: number;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          name: string;
          version?: number;
          status?: Database["public"]["Enums"]["catalog_status"];
          default_total_questions?: number;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          name?: string;
          version?: number;
          status?: Database["public"]["Enums"]["catalog_status"];
          default_total_questions?: number;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "course_blueprints_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
        ];
      };
      blueprint_rules: {
        Row: {
          id: string;
          blueprint_id: string;
          topic: string;
          subtopic: string | null;
          weightage: number;
          min_questions: number;
          max_questions: number | null;
          easy_percentage: number;
          medium_percentage: number;
          hard_percentage: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          blueprint_id: string;
          topic: string;
          subtopic?: string | null;
          weightage: number;
          min_questions?: number;
          max_questions?: number | null;
          easy_percentage?: number;
          medium_percentage?: number;
          hard_percentage?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          blueprint_id?: string;
          topic?: string;
          subtopic?: string | null;
          weightage?: number;
          min_questions?: number;
          max_questions?: number | null;
          easy_percentage?: number;
          medium_percentage?: number;
          hard_percentage?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blueprint_rules_blueprint_id_fkey";
            columns: ["blueprint_id"];
            isOneToOne: false;
            referencedRelation: "course_blueprints";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_series: {
        Row: {
          id: string;
          course_id: string;
          blueprint_id: string;
          question_pool_id: string;
          name: string;
          reuse_policy: Database["public"]["Enums"]["question_reuse_policy"];
          reuse_last_n: number;
          status: Database["public"]["Enums"]["catalog_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          blueprint_id: string;
          question_pool_id: string;
          name: string;
          reuse_policy?: Database["public"]["Enums"]["question_reuse_policy"];
          reuse_last_n?: number;
          status?: Database["public"]["Enums"]["catalog_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          blueprint_id?: string;
          question_pool_id?: string;
          name?: string;
          reuse_policy?: Database["public"]["Enums"]["question_reuse_policy"];
          reuse_last_n?: number;
          status?: Database["public"]["Enums"]["catalog_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_series_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_series_blueprint_id_fkey";
            columns: ["blueprint_id"];
            isOneToOne: false;
            referencedRelation: "course_blueprints";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_series_question_pool_id_fkey";
            columns: ["question_pool_id"];
            isOneToOne: false;
            referencedRelation: "question_pools";
            referencedColumns: ["id"];
          },
        ];
      };
      exam_generation_audit: {
        Row: {
          id: string;
          exam_id: string;
          method: Database["public"]["Enums"]["question_selection_method"];
          pool_id: string | null;
          blueprint_id: string | null;
          blueprint_version: number | null;
          series_id: string | null;
          reuse_policy: Database["public"]["Enums"]["question_reuse_policy"] | null;
          question_count: number;
          selected_pool_question_ids: string[];
          distribution: Json;
          generated_at: string;
        };
        Insert: {
          id?: string;
          exam_id: string;
          method?: Database["public"]["Enums"]["question_selection_method"];
          pool_id?: string | null;
          blueprint_id?: string | null;
          blueprint_version?: number | null;
          series_id?: string | null;
          reuse_policy?: Database["public"]["Enums"]["question_reuse_policy"] | null;
          question_count: number;
          selected_pool_question_ids?: string[];
          distribution?: Json;
          generated_at?: string;
        };
        Update: {
          id?: string;
          exam_id?: string;
          method?: Database["public"]["Enums"]["question_selection_method"];
          pool_id?: string | null;
          blueprint_id?: string | null;
          blueprint_version?: number | null;
          series_id?: string | null;
          reuse_policy?: Database["public"]["Enums"]["question_reuse_policy"] | null;
          question_count?: number;
          selected_pool_question_ids?: string[];
          distribution?: Json;
          generated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exam_generation_audit_exam_id_fkey";
            columns: ["exam_id"];
            isOneToOne: false;
            referencedRelation: "exams";
            referencedColumns: ["id"];
          },
        ];
      };
      levels: {
        Row: {
          level: number;
          min_xp: number;
          name: string;
        };
        Insert: {
          level: number;
          min_xp: number;
          name: string;
        };
        Update: {
          level?: number;
          min_xp?: number;
          name?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string;
          created_at: string;
          icon: string;
          id: string;
          kind: string;
          read: boolean;
          title: string;
          user_id: string;
        };
        Insert: {
          body?: string;
          created_at?: string;
          icon?: string;
          id?: string;
          kind?: string;
          read?: boolean;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          icon?: string;
          id?: string;
          kind?: string;
          read?: boolean;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_id: string | null;
          created_at: string;
          department: string | null;
          display_name: string | null;
          email: string;
          full_name: string;
          id: string;
          leaderboard_opt_out: boolean;
          mobile: string | null;
          organization: string | null;
          participant_id: string | null;
          team_group: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_id?: string | null;
          created_at?: string;
          department?: string | null;
          display_name?: string | null;
          email?: string;
          full_name?: string;
          id: string;
          leaderboard_opt_out?: boolean;
          mobile?: string | null;
          organization?: string | null;
          participant_id?: string | null;
          team_group?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_id?: string | null;
          created_at?: string;
          department?: string | null;
          display_name?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          leaderboard_opt_out?: boolean;
          mobile?: string | null;
          organization?: string | null;
          participant_id?: string | null;
          team_group?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          correct_index: number;
          correct_indexes: number[];
          multi_select: boolean;
          created_at: string;
          exam_id: string;
          explanation: string;
          id: string;
          options: Json;
          points: number;
          prompt: string;
          subtopic: string;
          source_pool_question_id: string | null;
        };
        Insert: {
          correct_index?: number;
          correct_indexes?: number[];
          multi_select?: boolean;
          created_at?: string;
          exam_id: string;
          explanation?: string;
          id?: string;
          options?: Json;
          points?: number;
          prompt: string;
          subtopic?: string;
          source_pool_question_id?: string | null;
        };
        Update: {
          correct_index?: number;
          correct_indexes?: number[];
          multi_select?: boolean;
          created_at?: string;
          exam_id?: string;
          explanation?: string;
          id?: string;
          options?: Json;
          points?: number;
          prompt?: string;
          subtopic?: string;
          source_pool_question_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "questions_exam_id_fkey";
            columns: ["exam_id"];
            isOneToOne: false;
            referencedRelation: "exams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_source_pool_question_id_fkey";
            columns: ["source_pool_question_id"];
            isOneToOne: false;
            referencedRelation: "pool_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      topic_mastery: {
        Row: {
          correct_count: number;
          id: string;
          mastery: number;
          subtopic: string;
          topic: string;
          total_count: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          correct_count?: number;
          id?: string;
          mastery?: number;
          subtopic?: string;
          topic: string;
          total_count?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          correct_count?: number;
          id?: string;
          mastery?: number;
          subtopic?: string;
          topic?: string;
          total_count?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_badges: {
        Row: {
          badge_id: string;
          earned_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          badge_id: string;
          earned_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          badge_id?: string;
          earned_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey";
            columns: ["badge_id"];
            isOneToOne: false;
            referencedRelation: "badges";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      user_streaks: {
        Row: {
          current_count: number;
          id: string;
          last_activity_at: string | null;
          longest_count: number;
          streak_type: string;
          user_id: string;
        };
        Insert: {
          current_count?: number;
          id?: string;
          last_activity_at?: string | null;
          longest_count?: number;
          streak_type: string;
          user_id: string;
        };
        Update: {
          current_count?: number;
          id?: string;
          last_activity_at?: string | null;
          longest_count?: number;
          streak_type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      xp_rules: {
        Row: {
          active: boolean;
          code: string;
          label: string;
          points: number;
        };
        Insert: {
          active?: boolean;
          code: string;
          label: string;
          points?: number;
        };
        Update: {
          active?: boolean;
          code?: string;
          label?: string;
          points?: number;
        };
        Relationships: [];
      };
      xp_transactions: {
        Row: {
          created_at: string;
          id: string;
          points: number;
          reference_id: string | null;
          source: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          points: number;
          reference_id?: string | null;
          source: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          points?: number;
          reference_id?: string | null;
          source?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_access_exam: {
        Args: { _exam_id: string; _user_id: string };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "participant";
      attempt_status: "in_progress" | "submitted";
      exam_access: "public" | "private" | "organization" | "group";
      exam_mode: "practice" | "assessment" | "competitive" | "certification";
      name_display: "full_name" | "first_initial" | "display_name" | "anonymous";
      question_selection_method: "upload" | "question_pool";
      question_reuse_policy:
        | "allow_reuse"
        | "no_reuse_course"
        | "no_reuse_series"
        | "until_pool_exhausted"
        | "no_reuse_last_n";
      question_difficulty: "easy" | "medium" | "hard";
      catalog_status: "active" | "inactive";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "participant"],
      attempt_status: ["in_progress", "submitted"],
      exam_access: ["public", "private", "organization", "group"],
      exam_mode: ["practice", "assessment", "competitive", "certification"],
      name_display: ["full_name", "first_initial", "display_name", "anonymous"],
      question_selection_method: ["upload", "question_pool"],
      question_reuse_policy: [
        "allow_reuse",
        "no_reuse_course",
        "until_pool_exhausted",
        "no_reuse_series",
        "no_reuse_last_n",
      ],
      question_difficulty: ["easy", "medium", "hard"],
      catalog_status: ["active", "inactive"],
    },
  },
} as const;
