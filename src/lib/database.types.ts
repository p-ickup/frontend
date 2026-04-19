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
    PostgrestVersion: '12.2.12 (cd3cf9e)'
  }
  public: {
    Tables: {
      AlgorithmStatus: {
        Row: {
          algorithm_name: string
          created_at: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          run_id: string | null
          scheduled_for: string
          started_at: string | null
          status: string
          target: string | null
        }
        Insert: {
          algorithm_name: string
          created_at?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          run_id?: string | null
          scheduled_for: string
          started_at?: string | null
          status: string
          target?: string | null
        }
        Update: {
          algorithm_name?: string
          created_at?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          run_id?: string | null
          scheduled_for?: string
          started_at?: string | null
          status?: string
          target?: string | null
        }
        Relationships: []
      }
      ChangeLog: {
        Row: {
          action: string
          actor_role: string
          actor_user_id: string
          algorithm_run_id: string | null
          confirmed: boolean | null
          created_at: string | null
          id: string
          ignored_error: boolean | null
          metadata: Json | null
          target_group_id: number | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_role: string
          actor_user_id: string
          algorithm_run_id?: string | null
          confirmed?: boolean | null
          created_at?: string | null
          id?: string
          ignored_error?: boolean | null
          metadata?: Json | null
          target_group_id?: number | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_role?: string
          actor_user_id?: string
          algorithm_run_id?: string | null
          confirmed?: boolean | null
          created_at?: string | null
          id?: string
          ignored_error?: boolean | null
          metadata?: Json | null
          target_group_id?: number | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      Comments: {
        Row: {
          comment: string | null
          created_at: string
          id: number
          match_id: number | null
          ride_id: number | null
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: number
          match_id?: number | null
          ride_id?: number | null
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: number
          match_id?: number | null
          ride_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'Comments_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'Matches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'Comments_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'Users'
            referencedColumns: ['user_id']
          },
        ]
      }
      Feedback: {
        Row: {
          comments: string | null
          convenience: number | null
          created_at: string
          feedback_id: number
          flight_id: number
          overall: number | null
          user_id: string
        }
        Insert: {
          comments?: string | null
          convenience?: number | null
          created_at?: string
          feedback_id?: number
          flight_id: number
          overall?: number | null
          user_id: string
        }
        Update: {
          comments?: string | null
          convenience?: number | null
          created_at?: string
          feedback_id?: number
          flight_id?: number
          overall?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'Feedback_flight_id_fkey'
            columns: ['flight_id']
            isOneToOne: false
            referencedRelation: 'Flights'
            referencedColumns: ['flight_id']
          },
          {
            foreignKeyName: 'Feedback_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'Users'
            referencedColumns: ['user_id']
          },
        ]
      }
      Flights: {
        Row: {
          airline_iata: string
          airport: string | null
          bag_no: number | null
          bag_no_large: number | null
          bag_no_personal: number | null
          created_at: string
          date: string | null
          earliest_time: string | null
          flight_id: number
          flight_no: number | null
          last_arr_estimated_utc: string | null
          last_dep_estimated_utc: string | null
          last_notified_at: string | null
          last_notified_delay_min: number | null
          last_status: string | null
          latest_date: string | null
          latest_time: string | null
          matched: boolean | null
          max_dropoff: number | null
          max_price: number | null
          opt_in: boolean | null
          original_unmatched: boolean | null
          terminal: string | null
          to_airport: boolean | null
          unmatched_email_sent: boolean | null
          user_id: string | null
        }
        Insert: {
          airline_iata: string
          airport?: string | null
          bag_no?: number | null
          bag_no_large?: number | null
          bag_no_personal?: number | null
          created_at?: string
          date?: string | null
          earliest_time?: string | null
          flight_id?: number
          flight_no?: number | null
          last_arr_estimated_utc?: string | null
          last_dep_estimated_utc?: string | null
          last_notified_at?: string | null
          last_notified_delay_min?: number | null
          last_status?: string | null
          latest_date?: string | null
          latest_time?: string | null
          matched?: boolean | null
          max_dropoff?: number | null
          max_price?: number | null
          opt_in?: boolean | null
          original_unmatched?: boolean | null
          terminal?: string | null
          to_airport?: boolean | null
          unmatched_email_sent?: boolean | null
          user_id?: string | null
        }
        Update: {
          airline_iata?: string
          airport?: string | null
          bag_no?: number | null
          bag_no_large?: number | null
          bag_no_personal?: number | null
          created_at?: string
          date?: string | null
          earliest_time?: string | null
          flight_id?: number
          flight_no?: number | null
          last_arr_estimated_utc?: string | null
          last_dep_estimated_utc?: string | null
          last_notified_at?: string | null
          last_notified_delay_min?: number | null
          last_status?: string | null
          latest_date?: string | null
          latest_time?: string | null
          matched?: boolean | null
          max_dropoff?: number | null
          max_price?: number | null
          opt_in?: boolean | null
          original_unmatched?: boolean | null
          terminal?: string | null
          to_airport?: boolean | null
          unmatched_email_sent?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'Flights_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'Users'
            referencedColumns: ['user_id']
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          action: string
          id: string
          terms_version: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          action: string
          id?: string
          terms_version: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          action?: string
          id?: string
          terms_version?: string
          user_id?: string
        }
        Relationships: []
      }
      match_cancellations: {
        Row: {
          airport: string
          cancellation_type: string | null
          cancelled_after_deadline: boolean
          cancelled_at: string
          cancelled_before_1hr: boolean
          flight_id: number
          id: number
          is_subsidized: boolean | null
          match_date: string
          match_time: string
          reason: string | null
          ride_id: number
          to_airport: boolean
          user_id: string
        }
        Insert: {
          airport: string
          cancellation_type?: string | null
          cancelled_after_deadline: boolean
          cancelled_at?: string
          cancelled_before_1hr: boolean
          flight_id: number
          id?: number
          is_subsidized?: boolean | null
          match_date: string
          match_time: string
          reason?: string | null
          ride_id: number
          to_airport: boolean
          user_id: string
        }
        Update: {
          airport?: string
          cancellation_type?: string | null
          cancelled_after_deadline?: boolean
          cancelled_at?: string
          cancelled_before_1hr?: boolean
          flight_id?: number
          id?: number
          is_subsidized?: boolean | null
          match_date?: string
          match_time?: string
          reason?: string | null
          ride_id?: number
          to_airport?: boolean
          user_id?: string
        }
        Relationships: []
      }
      match_deletion_logs: {
        Row: {
          can_be_restored: boolean | null
          contingency_voucher: string | null
          date: string | null
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_context: string | null
          deletion_reason: string | null
          flight_id: number
          is_subsidized: boolean | null
          is_verified: boolean | null
          log_id: number
          match_created_at: string | null
          match_id: number
          ride_id: number
          source: string | null
          time: string | null
          user_id: string
          voucher: string | null
        }
        Insert: {
          can_be_restored?: boolean | null
          contingency_voucher?: string | null
          date?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_context?: string | null
          deletion_reason?: string | null
          flight_id: number
          is_subsidized?: boolean | null
          is_verified?: boolean | null
          log_id?: number
          match_created_at?: string | null
          match_id: number
          ride_id: number
          source?: string | null
          time?: string | null
          user_id: string
          voucher?: string | null
        }
        Update: {
          can_be_restored?: boolean | null
          contingency_voucher?: string | null
          date?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_context?: string | null
          deletion_reason?: string | null
          flight_id?: number
          is_subsidized?: boolean | null
          is_verified?: boolean | null
          log_id?: number
          match_created_at?: string | null
          match_id?: number
          ride_id?: number
          source?: string | null
          time?: string | null
          user_id?: string
          voucher?: string | null
        }
        Relationships: []
      }
      Matches: {
        Row: {
          contingency_voucher: string | null
          created_at: string
          date: string | null
          earliest_time: string | null
          email_sent: boolean | null
          flight_id: number
          group_ready_at: string | null
          id: number
          is_subsidized: boolean | null
          is_verified: boolean | null
          latest_time: string | null
          ready_for_pickup_at: string | null
          ready_for_pickup_status: string | null
          reason_for_delay: string | null
          reported_missing_user_ids: string[] | null
          ride_id: number
          source: string | null
          subsidized_override: boolean | null
          time: string | null
          uber_type: string | null
          uber_type_override: boolean | null
          user_id: string
          voucher: string | null
        }
        Insert: {
          contingency_voucher?: string | null
          created_at?: string
          date?: string | null
          earliest_time?: string | null
          email_sent?: boolean | null
          flight_id: number
          group_ready_at?: string | null
          id?: number
          is_subsidized?: boolean | null
          is_verified?: boolean | null
          latest_time?: string | null
          ready_for_pickup_at?: string | null
          ready_for_pickup_status?: string | null
          reason_for_delay?: string | null
          reported_missing_user_ids?: string[] | null
          ride_id?: number
          source?: string | null
          subsidized_override?: boolean | null
          time?: string | null
          uber_type?: string | null
          uber_type_override?: boolean | null
          user_id: string
          voucher?: string | null
        }
        Update: {
          contingency_voucher?: string | null
          created_at?: string
          date?: string | null
          earliest_time?: string | null
          email_sent?: boolean | null
          flight_id?: number
          group_ready_at?: string | null
          id?: number
          is_subsidized?: boolean | null
          is_verified?: boolean | null
          latest_time?: string | null
          ready_for_pickup_at?: string | null
          ready_for_pickup_status?: string | null
          reason_for_delay?: string | null
          reported_missing_user_ids?: string[] | null
          ride_id?: number
          source?: string | null
          subsidized_override?: boolean | null
          time?: string | null
          uber_type?: string | null
          uber_type_override?: boolean | null
          user_id?: string
          voucher?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'Rides_flight_id_fkey'
            columns: ['flight_id']
            isOneToOne: false
            referencedRelation: 'Flights'
            referencedColumns: ['flight_id']
          },
          {
            foreignKeyName: 'Rides_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'Users'
            referencedColumns: ['user_id']
          },
        ]
      }
      MatchRequests: {
        Row: {
          created_at: string | null
          id: string
          receiver_flight_id: number | null
          receiver_id: string | null
          sender_flight_id: number | null
          sender_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          receiver_flight_id?: number | null
          receiver_id?: string | null
          sender_flight_id?: number | null
          sender_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          receiver_flight_id?: number | null
          receiver_id?: string | null
          sender_flight_id?: number | null
          sender_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'MatchRequests_receiver_flight_id_fkey'
            columns: ['receiver_flight_id']
            isOneToOne: false
            referencedRelation: 'Flights'
            referencedColumns: ['flight_id']
          },
          {
            foreignKeyName: 'MatchRequests_sender_flight_id_fkey'
            columns: ['sender_flight_id']
            isOneToOne: false
            referencedRelation: 'Flights'
            referencedColumns: ['flight_id']
          },
        ]
      }
      Messages: {
        Row: {
          created_at: string
          id: number
          message: string | null
          ride_id: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          message?: string | null
          ride_id?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          message?: string | null
          ride_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'Messages_ride_id_fkey'
            columns: ['ride_id']
            isOneToOne: false
            referencedRelation: 'Rides'
            referencedColumns: ['ride_id']
          },
        ]
      }
      Rides: {
        Row: {
          ride_date: string
          ride_id: number
          ride_time: string | null
          ride_type: string | null
          subsidized: boolean | null
          voucher: string | null
        }
        Insert: {
          ride_date: string
          ride_id?: number
          ride_time?: string | null
          ride_type?: string | null
          subsidized?: boolean | null
          voucher?: string | null
        }
        Update: {
          ride_date?: string
          ride_id?: number
          ride_time?: string | null
          ride_type?: string | null
          subsidized?: boolean | null
          voucher?: string | null
        }
        Relationships: []
      }
      Users: {
        Row: {
          admin_scope: string | null
          created_at: string
          email: string | null
          firstname: string
          instagram: string | null
          lastname: string | null
          phonenumber: string | null
          photo_url: string | null
          role: string | null
          school: string
          sms_opt_in: boolean
          user_id: string
        }
        Insert: {
          admin_scope?: string | null
          created_at?: string
          email?: string | null
          firstname: string
          instagram?: string | null
          lastname?: string | null
          phonenumber?: string | null
          photo_url?: string | null
          role?: string | null
          school: string
          sms_opt_in?: boolean
          user_id?: string
        }
        Update: {
          admin_scope?: string | null
          created_at?: string
          email?: string | null
          firstname?: string
          instagram?: string | null
          lastname?: string | null
          phonenumber?: string | null
          photo_url?: string | null
          role?: string | null
          school?: string
          sms_opt_in?: boolean
          user_id?: string
        }
        Relationships: []
      }
      v_url: {
        Row: {
          secret: string | null
        }
        Insert: {
          secret?: string | null
        }
        Update: {
          secret?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      restore_deleted_match: {
        Args: { log_id_to_restore: number }
        Returns: {
          message: string
          restored_match_id: number
          success: boolean
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
