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
      bot_config: {
        Row: {
          claim_instruction: string | null
          claim_interval_minutes: number
          created_at: string
          id: string
          is_running: boolean
          last_claim_at: string | null
          last_error: string | null
          next_claim_at: string | null
          program_id: string | null
          rpc_endpoint: string
          status: Database["public"]["Enums"]["bot_status"]
          total_claimed_sol: number
          total_transferred_sol: number
          updated_at: string
        }
        Insert: {
          claim_instruction?: string | null
          claim_interval_minutes?: number
          created_at?: string
          id?: string
          is_running?: boolean
          last_claim_at?: string | null
          last_error?: string | null
          next_claim_at?: string | null
          program_id?: string | null
          rpc_endpoint?: string
          status?: Database["public"]["Enums"]["bot_status"]
          total_claimed_sol?: number
          total_transferred_sol?: number
          updated_at?: string
        }
        Update: {
          claim_instruction?: string | null
          claim_interval_minutes?: number
          created_at?: string
          id?: string
          is_running?: boolean
          last_claim_at?: string | null
          last_error?: string | null
          next_claim_at?: string | null
          program_id?: string | null
          rpc_endpoint?: string
          status?: Database["public"]["Enums"]["bot_status"]
          total_claimed_sol?: number
          total_transferred_sol?: number
          updated_at?: string
        }
        Relationships: []
      }
      claim_logs: {
        Row: {
          amount_sol: number
          created_at: string
          error_message: string | null
          id: string
          status: string
          tx_signature: string | null
        }
        Insert: {
          amount_sol: number
          created_at?: string
          error_message?: string | null
          id?: string
          status?: string
          tx_signature?: string | null
        }
        Update: {
          amount_sol?: number
          created_at?: string
          error_message?: string | null
          id?: string
          status?: string
          tx_signature?: string | null
        }
        Relationships: []
      }
      claims: {
        Row: {
          amount: number
          created_at: string
          error_message: string | null
          id: string
          processed_at: string | null
          round_id: string
          signed_message: string | null
          status: Database["public"]["Enums"]["claim_status"]
          tx_signature: string | null
          user_id: string
          wallet_address: string
        }
        Insert: {
          amount: number
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          round_id: string
          signed_message?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          tx_signature?: string | null
          user_id: string
          wallet_address: string
        }
        Update: {
          amount?: number
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          round_id?: string
          signed_message?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          tx_signature?: string | null
          user_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "prediction_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_config: {
        Row: {
          cooldown_minutes: number
          created_at: string
          default_options: string[]
          id: string
          posts_to_display: number
          rss_feed_url: string
          updated_at: string
        }
        Insert: {
          cooldown_minutes?: number
          created_at?: string
          default_options?: string[]
          id?: string
          posts_to_display?: number
          rss_feed_url?: string
          updated_at?: string
        }
        Update: {
          cooldown_minutes?: number
          created_at?: string
          default_options?: string[]
          id?: string
          posts_to_display?: number
          rss_feed_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      leaderboard: {
        Row: {
          display_name: string | null
          id: string
          rank: number | null
          total_claimed_usd: number | null
          total_predictions: number | null
          total_wins: number | null
          updated_at: string
          user_id: string
          wallet_address: string
          win_rate: number | null
        }
        Insert: {
          display_name?: string | null
          id?: string
          rank?: number | null
          total_claimed_usd?: number | null
          total_predictions?: number | null
          total_wins?: number | null
          updated_at?: string
          user_id: string
          wallet_address: string
          win_rate?: number | null
        }
        Update: {
          display_name?: string | null
          id?: string
          rank?: number | null
          total_claimed_usd?: number | null
          total_predictions?: number | null
          total_wins?: number | null
          updated_at?: string
          user_id?: string
          wallet_address?: string
          win_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_stats: {
        Row: {
          id: string
          total_paid_usd: number | null
          total_predictions_made: number | null
          total_rounds_completed: number | null
          updated_at: string
        }
        Insert: {
          id?: string
          total_paid_usd?: number | null
          total_predictions_made?: number | null
          total_rounds_completed?: number | null
          updated_at?: string
        }
        Update: {
          id?: string
          total_paid_usd?: number | null
          total_predictions_made?: number | null
          total_rounds_completed?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_config: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poller_logs: {
        Row: {
          created_at: string
          id: string
          level: string
          message: string
          metadata: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string
          message: string
          metadata?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      prediction_options: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_winner: boolean | null
          keywords: string[]
          label: string
          round_id: string
          vote_count: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_winner?: boolean | null
          keywords: string[]
          label: string
          round_id: string
          vote_count?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_winner?: boolean | null
          keywords?: string[]
          label?: string
          round_id?: string
          vote_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prediction_options_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "prediction_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_rounds: {
        Row: {
          accumulated_from_previous: number | null
          cooldown_end_time: string | null
          created_at: string
          end_time: string
          finalized_at: string | null
          id: string
          payout_amount: number | null
          payout_per_winner: number | null
          prediction_start_time: string | null
          question: string
          refill_completed: boolean | null
          round_number: number
          start_time: string
          status: Database["public"]["Enums"]["round_status"]
          total_votes: number | null
          total_winners: number | null
          vault_balance_snapshot: number | null
          vote_lock_minutes: number | null
          winning_option_id: string | null
          winning_tweet_id: string | null
          winning_tweet_text: string | null
        }
        Insert: {
          accumulated_from_previous?: number | null
          cooldown_end_time?: string | null
          created_at?: string
          end_time: string
          finalized_at?: string | null
          id?: string
          payout_amount?: number | null
          payout_per_winner?: number | null
          prediction_start_time?: string | null
          question?: string
          refill_completed?: boolean | null
          round_number: number
          start_time: string
          status?: Database["public"]["Enums"]["round_status"]
          total_votes?: number | null
          total_winners?: number | null
          vault_balance_snapshot?: number | null
          vote_lock_minutes?: number | null
          winning_option_id?: string | null
          winning_tweet_id?: string | null
          winning_tweet_text?: string | null
        }
        Update: {
          accumulated_from_previous?: number | null
          cooldown_end_time?: string | null
          created_at?: string
          end_time?: string
          finalized_at?: string | null
          id?: string
          payout_amount?: number | null
          payout_per_winner?: number | null
          prediction_start_time?: string | null
          question?: string
          refill_completed?: boolean | null
          round_number?: number
          start_time?: string
          status?: Database["public"]["Enums"]["round_status"]
          total_votes?: number | null
          total_winners?: number | null
          vault_balance_snapshot?: number | null
          vote_lock_minutes?: number | null
          winning_option_id?: string | null
          winning_tweet_id?: string | null
          winning_tweet_text?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          total_claimed_usd: number | null
          total_predictions: number | null
          total_wins: number | null
          unclaimed_rewards_sol: number | null
          updated_at: string
          wallet_address: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          total_claimed_usd?: number | null
          total_predictions?: number | null
          total_wins?: number | null
          unclaimed_rewards_sol?: number | null
          updated_at?: string
          wallet_address: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          total_claimed_usd?: number | null
          total_predictions?: number | null
          total_wins?: number | null
          unclaimed_rewards_sol?: number | null
          updated_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
      recent_winners: {
        Row: {
          amount: number
          created_at: string
          id: string
          round_id: string
          tx_signature: string | null
          user_id: string
          wallet_address: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          round_id: string
          tx_signature?: string | null
          user_id: string
          wallet_address: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          round_id?: string
          tx_signature?: string | null
          user_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "recent_winners_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "prediction_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recent_winners_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_logs: {
        Row: {
          amount_sol: number
          created_at: string
          error_message: string | null
          id: string
          percentage_used: number
          round_id: string | null
          status: string
          tx_signature: string | null
          winner_count: number
        }
        Insert: {
          amount_sol: number
          created_at?: string
          error_message?: string | null
          id?: string
          percentage_used: number
          round_id?: string | null
          status?: string
          tx_signature?: string | null
          winner_count?: number
        }
        Update: {
          amount_sol?: number
          created_at?: string
          error_message?: string | null
          id?: string
          percentage_used?: number
          round_id?: string | null
          status?: string
          tx_signature?: string | null
          winner_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "transfer_logs_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "prediction_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      tweets: {
        Row: {
          author_avatar: string | null
          author_id: string
          author_name: string | null
          author_username: string
          created_at_twitter: string
          fetched_at: string
          id: string
          matched_keywords: string[] | null
          matched_option_id: string | null
          quoted_tweet_id: string | null
          quoted_tweet_text: string | null
          text: string
          tweet_id: string
          tweet_type: string
        }
        Insert: {
          author_avatar?: string | null
          author_id: string
          author_name?: string | null
          author_username: string
          created_at_twitter: string
          fetched_at?: string
          id?: string
          matched_keywords?: string[] | null
          matched_option_id?: string | null
          quoted_tweet_id?: string | null
          quoted_tweet_text?: string | null
          text: string
          tweet_id: string
          tweet_type: string
        }
        Update: {
          author_avatar?: string | null
          author_id?: string
          author_name?: string | null
          author_username?: string
          created_at_twitter?: string
          fetched_at?: string
          id?: string
          matched_keywords?: string[] | null
          matched_option_id?: string | null
          quoted_tweet_id?: string | null
          quoted_tweet_text?: string | null
          text?: string
          tweet_id?: string
          tweet_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tweets_matched_option_id_fkey"
            columns: ["matched_option_id"]
            isOneToOne: false
            referencedRelation: "prediction_options"
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          created_at: string
          id: string
          option_id: string
          round_id: string
          token_balance_at_vote: number
          user_id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          round_id: string
          token_balance_at_vote: number
          user_id: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          round_id?: string
          token_balance_at_vote?: number
          user_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "prediction_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "prediction_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_balances: {
        Row: {
          claimable_rewards_sol: number
          id: string
          last_updated_at: string
          payout_balance_sol: number
          vault_balance_sol: number
        }
        Insert: {
          claimable_rewards_sol?: number
          id?: string
          last_updated_at?: string
          payout_balance_sol?: number
          vault_balance_sol?: number
        }
        Update: {
          claimable_rewards_sol?: number
          id?: string
          last_updated_at?: string
          payout_balance_sol?: number
          vault_balance_sol?: number
        }
        Relationships: []
      }
      wallet_config: {
        Row: {
          created_at: string
          id: string
          min_token_balance: number | null
          payout_percentage: number | null
          payout_wallet_address: string
          token_contract_address: string
          twitter_user_id: string | null
          twitter_username: string | null
          updated_at: string
          vault_wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_token_balance?: number | null
          payout_percentage?: number | null
          payout_wallet_address: string
          token_contract_address: string
          twitter_user_id?: string | null
          twitter_username?: string | null
          updated_at?: string
          vault_wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          min_token_balance?: number | null
          payout_percentage?: number | null
          payout_wallet_address?: string
          token_contract_address?: string
          twitter_user_id?: string | null
          twitter_username?: string | null
          updated_at?: string
          vault_wallet_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_by_wallet: { Args: { _wallet: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_wallet: { Args: { _wallet: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      bot_status: "stopped" | "running" | "error" | "paused"
      claim_status: "pending" | "processing" | "completed" | "failed"
      log_type: "claim" | "transfer" | "error" | "info"
      round_status:
        | "upcoming"
        | "open"
        | "finalizing"
        | "finalized"
        | "paid"
        | "no_winner"
        | "cooldown"
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
      app_role: ["admin", "user"],
      bot_status: ["stopped", "running", "error", "paused"],
      claim_status: ["pending", "processing", "completed", "failed"],
      log_type: ["claim", "transfer", "error", "info"],
      round_status: [
        "upcoming",
        "open",
        "finalizing",
        "finalized",
        "paid",
        "no_winner",
        "cooldown",
      ],
    },
  },
} as const
