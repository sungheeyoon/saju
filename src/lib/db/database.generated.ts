export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_disposal: {
        Row: {
          attempts: number
          disposed_at: string | null
          id: string
          last_attempt_at: string | null
          last_error: string | null
          requested_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          disposed_at?: string | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          requested_at: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          disposed_at?: string | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          requested_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      app_user: {
        Row: {
          contact_consent: boolean | null
          created_at: string
          deletion_requested_at: string | null
          id: string
          improvement_consent: boolean | null
          intro: string | null
          nickname: string | null
          notice_ack_at: string | null
          notice_ends_on: string | null
          notice_schedule_id: number | null
          notice_version: string | null
          self_person_id: string | null
          signed_up_at: string | null
          signup_code: string | null
          status: string
        }
        Insert: {
          contact_consent?: boolean | null
          created_at?: string
          deletion_requested_at?: string | null
          id: string
          improvement_consent?: boolean | null
          intro?: string | null
          nickname?: string | null
          notice_ack_at?: string | null
          notice_ends_on?: string | null
          notice_schedule_id?: number | null
          notice_version?: string | null
          self_person_id?: string | null
          signed_up_at?: string | null
          signup_code?: string | null
          status?: string
        }
        Update: {
          contact_consent?: boolean | null
          created_at?: string
          deletion_requested_at?: string | null
          id?: string
          improvement_consent?: boolean | null
          intro?: string | null
          nickname?: string | null
          notice_ack_at?: string | null
          notice_ends_on?: string | null
          notice_schedule_id?: number | null
          notice_version?: string | null
          self_person_id?: string | null
          signed_up_at?: string | null
          signup_code?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_user_notice_schedule_id_fkey"
            columns: ["notice_schedule_id"]
            isOneToOne: false
            referencedRelation: "beta_schedule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_user_self_person_id_fkey"
            columns: ["self_person_id"]
            isOneToOne: true
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_user_signup_code_fkey"
            columns: ["signup_code"]
            isOneToOne: false
            referencedRelation: "signup_code"
            referencedColumns: ["code"]
          },
        ]
      }
      beta_schedule: {
        Row: {
          ends_on: string
          id: number
          note: string | null
          operator_contact: string | null
          operator_name: string | null
          operator_officer: string | null
          purge_within_days: number
          set_at: string
        }
        Insert: {
          ends_on: string
          id?: never
          note?: string | null
          operator_contact?: string | null
          operator_name?: string | null
          operator_officer?: string | null
          purge_within_days?: number
          set_at?: string
        }
        Update: {
          ends_on?: string
          id?: never
          note?: string | null
          operator_contact?: string | null
          operator_name?: string | null
          operator_officer?: string | null
          purge_within_days?: number
          set_at?: string
        }
        Relationships: []
      }
      block: {
        Row: {
          blocked_user_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          blocked_user_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          blocked_user_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_blocked_user_id_fkey"
            columns: ["blocked_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message: {
        Row: {
          body: string
          created_at: string
          id: string
          room_id: string
          sender_user_id: string | null
          seq: number
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          room_id: string
          sender_user_id?: string | null
          seq?: never
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          room_id?: string
          sender_user_id?: string | null
          seq?: never
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_room"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rate_limit_hit: {
        Row: {
          created_at: string
          id: string
          room_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          room_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          room_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_rate_limit_hit_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_room"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_rate_limit_hit_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_read: {
        Row: {
          last_read_seq: number
          read_at: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          last_read_seq?: number
          read_at?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          last_read_seq?: number
          read_at?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_read_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_room"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_read_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_report_snapshot: {
        Row: {
          captured_at: string
          context_after: number
          context_before: number
          match_id: string
          message_id: string
          messages: Json
          report_id: string
        }
        Insert: {
          captured_at?: string
          context_after: number
          context_before: number
          match_id: string
          message_id: string
          messages: Json
          report_id: string
        }
        Update: {
          captured_at?: string
          context_after?: number
          context_before?: number
          match_id?: string
          message_id?: string
          messages?: Json
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_report_snapshot_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: true
            referencedRelation: "report"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_room: {
        Row: {
          closed_at: string | null
          closed_by_user_id: string | null
          closed_reason: string | null
          id: string
          match_id: string
          opened_at: string
          user_high: string | null
          user_low: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by_user_id?: string | null
          closed_reason?: string | null
          id?: string
          match_id: string
          opened_at?: string
          user_high?: string | null
          user_low?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by_user_id?: string | null
          closed_reason?: string | null
          id?: string
          match_id?: string
          opened_at?: string
          user_high?: string | null
          user_low?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_room_closed_by_user_id_fkey"
            columns: ["closed_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_room_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "match"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_room_user_high_fkey"
            columns: ["user_high"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_room_user_low_fkey"
            columns: ["user_low"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_candidate: {
        Row: {
          generated_at: string
          id: string
          policy_version: string
          seq: number
          user_id: string
          viewer_summary: Json
        }
        Insert: {
          generated_at?: string
          id?: string
          policy_version: string
          seq?: never
          user_id: string
          viewer_summary: Json
        }
        Update: {
          generated_at?: string
          id?: string
          policy_version?: string
          seq?: never
          user_id?: string
          viewer_summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "discovery_candidate_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_candidate_slot: {
        Row: {
          balance_band: string
          candidate_summary: Json
          candidate_user_id: string
          exploration: boolean
          position: number
          snapshot_id: string
          supplied_elements: string[]
        }
        Insert: {
          balance_band: string
          candidate_summary: Json
          candidate_user_id: string
          exploration: boolean
          position: number
          snapshot_id: string
          supplied_elements: string[]
        }
        Update: {
          balance_band?: string
          candidate_summary?: Json
          candidate_user_id?: string
          exploration?: boolean
          position?: number
          snapshot_id?: string
          supplied_elements?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "discovery_candidate_slot_candidate_user_id_fkey"
            columns: ["candidate_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_candidate_slot_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "discovery_candidate"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_impression: {
        Row: {
          candidate_summary: Json
          candidate_user_id: string
          combined_balance: number
          complement: number
          exploration: boolean
          id: string
          policy_version: string
          position: number
          shown_at: string
          supplied_elements: string[]
          viewer_summary: Json
          viewer_user_id: string
        }
        Insert: {
          candidate_summary: Json
          candidate_user_id: string
          combined_balance: number
          complement: number
          exploration: boolean
          id?: string
          policy_version: string
          position: number
          shown_at?: string
          supplied_elements: string[]
          viewer_summary: Json
          viewer_user_id: string
        }
        Update: {
          candidate_summary?: Json
          candidate_user_id?: string
          combined_balance?: number
          complement?: number
          exploration?: boolean
          id?: string
          policy_version?: string
          position?: number
          shown_at?: string
          supplied_elements?: string[]
          viewer_summary?: Json
          viewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_impression_candidate_user_id_fkey"
            columns: ["candidate_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_impression_viewer_user_id_fkey"
            columns: ["viewer_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_passed: {
        Row: {
          passed_at: string
          passed_user_id: string
          user_id: string
        }
        Insert: {
          passed_at?: string
          passed_user_id: string
          user_id?: string
        }
        Update: {
          passed_at?: string
          passed_user_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_passed_passed_user_id_fkey"
            columns: ["passed_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_passed_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_profile: {
        Row: {
          created_at: string
          element_chart_engine_version: string | null
          element_input_version: number | null
          element_summary: Json | null
          need_chart_engine_version: string | null
          need_input_version: number | null
          need_summary: Json | null
          opted_in_at: string | null
          opted_out_at: string | null
          prefer_gender: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          element_chart_engine_version?: string | null
          element_input_version?: number | null
          element_summary?: Json | null
          need_chart_engine_version?: string | null
          need_input_version?: number | null
          need_summary?: Json | null
          opted_in_at?: string | null
          opted_out_at?: string | null
          prefer_gender?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          element_chart_engine_version?: string | null
          element_input_version?: number | null
          element_summary?: Json | null
          need_chart_engine_version?: string | null
          need_input_version?: number | null
          need_summary?: Json | null
          opted_in_at?: string | null
          opted_out_at?: string | null
          prefer_gender?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      match: {
        Row: {
          chart_engine_high: string | null
          chart_engine_low: string | null
          chart_high: Json | null
          chart_low: Json | null
          created_at: string
          id: string
          request_id: string | null
          user_high: string | null
          user_low: string | null
        }
        Insert: {
          chart_engine_high?: string | null
          chart_engine_low?: string | null
          chart_high?: Json | null
          chart_low?: Json | null
          created_at?: string
          id?: string
          request_id?: string | null
          user_high?: string | null
          user_low?: string | null
        }
        Update: {
          chart_engine_high?: string | null
          chart_engine_low?: string | null
          chart_high?: Json | null
          chart_low?: Json | null
          created_at?: string
          id?: string
          request_id?: string | null
          user_high?: string | null
          user_low?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "match_request"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_user_high_fkey"
            columns: ["user_high"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_user_low_fkey"
            columns: ["user_low"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      match_request: {
        Row: {
          addressee_input_version: number | null
          addressee_user_id: string
          balance_band: string
          created_at: string
          decided_at: string | null
          expires_at: string
          id: string
          impression_id: string | null
          pair_high: string | null
          pair_low: string | null
          policy_version: string
          requester_input_version: number | null
          requester_user_id: string
          status: string
          supplied_to_addressee: string[]
          supplied_to_requester: string[]
        }
        Insert: {
          addressee_input_version?: number | null
          addressee_user_id: string
          balance_band: string
          created_at?: string
          decided_at?: string | null
          expires_at?: string
          id?: string
          impression_id?: string | null
          pair_high?: string | null
          pair_low?: string | null
          policy_version: string
          requester_input_version?: number | null
          requester_user_id: string
          status?: string
          supplied_to_addressee: string[]
          supplied_to_requester: string[]
        }
        Update: {
          addressee_input_version?: number | null
          addressee_user_id?: string
          balance_band?: string
          created_at?: string
          decided_at?: string | null
          expires_at?: string
          id?: string
          impression_id?: string | null
          pair_high?: string | null
          pair_low?: string | null
          policy_version?: string
          requester_input_version?: number | null
          requester_user_id?: string
          status?: string
          supplied_to_addressee?: string[]
          supplied_to_requester?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "match_request_addressee_user_id_fkey"
            columns: ["addressee_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_request_impression_id_fkey"
            columns: ["impression_id"]
            isOneToOne: false
            referencedRelation: "discovery_impression"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_request_requester_user_id_fkey"
            columns: ["requester_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      notification: {
        Row: {
          created_at: string
          id: string
          kind: string
          match_id: string | null
          read_at: string | null
          request_id: string | null
          run_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          match_id?: string | null
          read_at?: string | null
          request_id?: string | null
          run_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          match_id?: string | null
          read_at?: string | null
          request_id?: string | null
          run_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "match_request"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "reading_run"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      operator: {
        Row: {
          added_at: string
          note: string
          user_id: string
        }
        Insert: {
          added_at?: string
          note: string
          user_id: string
        }
        Update: {
          added_at?: string
          note?: string
          user_id?: string
        }
        Relationships: []
      }
      ops_alert: {
        Row: {
          created_at: string
          day: string
          detail: string
          id: string
          kind: string
        }
        Insert: {
          created_at?: string
          day?: string
          detail: string
          id?: string
          kind: string
        }
        Update: {
          created_at?: string
          day?: string
          detail?: string
          id?: string
          kind?: string
        }
        Relationships: []
      }
      pair_relation: {
        Row: {
          created_at: string
          person_high: string
          person_low: string
          relation: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          person_high: string
          person_low: string
          relation: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          person_high?: string
          person_low?: string
          relation?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pair_relation_person_high_fkey"
            columns: ["person_high"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pair_relation_person_low_fkey"
            columns: ["person_low"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pair_relation_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_event: {
        Row: {
          amount: number | null
          id: number
          kind: string
          order_id: string | null
          outcome: string
          provider: string
          provider_event_id: string
          received_at: string
        }
        Insert: {
          amount?: number | null
          id?: never
          kind: string
          order_id?: string | null
          outcome: string
          provider: string
          provider_event_id: string
          received_at?: string
        }
        Update: {
          amount?: number | null
          id?: never
          kind?: string
          order_id?: string | null
          outcome?: string
          provider?: string
          provider_event_id?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_event_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "reading_order"
            referencedColumns: ["id"]
          },
        ]
      }
      person: {
        Row: {
          birth_time: string | null
          calendar: string | null
          chart_engine_version: string
          city: string | null
          created_at: string
          current_chart: Json
          gender: string | null
          id: string
          input_version: number
          late_night_rule: string | null
          original_date: string | null
          solar_date: string | null
          time_basis: string | null
        }
        Insert: {
          birth_time?: string | null
          calendar?: string | null
          chart_engine_version: string
          city?: string | null
          created_at?: string
          current_chart: Json
          gender?: string | null
          id?: string
          input_version?: number
          late_night_rule?: string | null
          original_date?: string | null
          solar_date?: string | null
          time_basis?: string | null
        }
        Update: {
          birth_time?: string | null
          calendar?: string | null
          chart_engine_version?: string
          city?: string | null
          created_at?: string
          current_chart?: Json
          gender?: string | null
          id?: string
          input_version?: number
          late_night_rule?: string | null
          original_date?: string | null
          solar_date?: string | null
          time_basis?: string | null
        }
        Relationships: []
      }
      profile_photo: {
        Row: {
          bytes: string
          content_type: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bytes: string
          content_type: string
          position: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          bytes?: string
          content_type?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_photo_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_photo_upload: {
        Row: {
          uploaded_at: string
          user_id: string
        }
        Insert: {
          uploaded_at?: string
          user_id: string
        }
        Update: {
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_photo_upload_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      push_delivery: {
        Row: {
          attempts: number
          claimed_at: string | null
          created_at: string
          due_at: string
          id: string
          room_id: string
          sent_at: string | null
          settled_at: string | null
          status: string
          subscription_id: string
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          due_at?: string
          id?: string
          room_id: string
          sent_at?: string | null
          settled_at?: string | null
          status?: string
          subscription_id: string
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          due_at?: string
          id?: string
          room_id?: string
          sent_at?: string | null
          settled_at?: string | null
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_delivery_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_room"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_delivery_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscription: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_success_at: string | null
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_success_at?: string | null
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_success_at?: string | null
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscription_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      reading: {
        Row: {
          chart_a: Json
          chart_b: Json | null
          created_at: string
          evidence: string
          generation: Json
          id: string
          kind: string
          match_id: string | null
          metaphor: string | null
          model: string
          output: string
          owner_user_id: string | null
          person_a: string
          person_b: string | null
          prompt: string
          prompt_version: string
          score: number | null
          score_baseline: number | null
          score_relation: string | null
          score_version: string | null
          source_run_id: string | null
          target_key: string | null
          viewed_at: string
        }
        Insert: {
          chart_a: Json
          chart_b?: Json | null
          created_at?: string
          evidence: string
          generation?: Json
          id?: string
          kind: string
          match_id?: string | null
          metaphor?: string | null
          model: string
          output: string
          owner_user_id?: string | null
          person_a: string
          person_b?: string | null
          prompt: string
          prompt_version: string
          score?: number | null
          score_baseline?: number | null
          score_relation?: string | null
          score_version?: string | null
          source_run_id?: string | null
          target_key?: string | null
          viewed_at: string
        }
        Update: {
          chart_a?: Json
          chart_b?: Json | null
          created_at?: string
          evidence?: string
          generation?: Json
          id?: string
          kind?: string
          match_id?: string | null
          metaphor?: string | null
          model?: string
          output?: string
          owner_user_id?: string | null
          person_a?: string
          person_b?: string | null
          prompt?: string
          prompt_version?: string
          score?: number | null
          score_baseline?: number | null
          score_relation?: string | null
          score_version?: string | null
          source_run_id?: string | null
          target_key?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_person_a_fkey"
            columns: ["person_a"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_person_b_fkey"
            columns: ["person_b"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_source_run_id_fkey"
            columns: ["source_run_id"]
            isOneToOne: false
            referencedRelation: "reading_run"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_bundle: {
        Row: {
          acquired_at: string
          credits: number
          currency: string
          id: string
          order_id: string
          price: number
          refunded_credits: number
          user_id: string
        }
        Insert: {
          acquired_at?: string
          credits: number
          currency?: string
          id?: string
          order_id: string
          price: number
          refunded_credits?: number
          user_id: string
        }
        Update: {
          acquired_at?: string
          credits?: number
          currency?: string
          id?: string
          order_id?: string
          price?: number
          refunded_credits?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_bundle_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "reading_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_bundle_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_credit_grant: {
        Row: {
          extra: number
          granted_at: string
          note: string
          user_id: string
        }
        Insert: {
          extra: number
          granted_at?: string
          note: string
          user_id: string
        }
        Update: {
          extra?: number
          granted_at?: string
          note?: string
          user_id?: string
        }
        Relationships: []
      }
      reading_credit_use: {
        Row: {
          bundle_id: string | null
          confirmed_at: string | null
          id: number
          released_at: string | null
          request_id: string | null
          reserved_at: string
          run_id: string | null
          share: string
          source: string
          state: string
          user_id: string
        }
        Insert: {
          bundle_id?: string | null
          confirmed_at?: string | null
          id?: never
          released_at?: string | null
          request_id?: string | null
          reserved_at?: string
          run_id?: string | null
          share: string
          source: string
          state?: string
          user_id: string
        }
        Update: {
          bundle_id?: string | null
          confirmed_at?: string | null
          id?: never
          released_at?: string | null
          request_id?: string | null
          reserved_at?: string
          run_id?: string | null
          share?: string
          source?: string
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_credit_use_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "reading_bundle"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_credit_use_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "match_request"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_credit_use_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "reading_run"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_credit_use_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_feedback: {
        Row: {
          comment: string | null
          felt_length: string
          issue_tags: string[]
          perceived_fit: number
          reading_run_id: string
          respondent_user_id: string
          submitted_at: string
          usefulness: number
        }
        Insert: {
          comment?: string | null
          felt_length: string
          issue_tags?: string[]
          perceived_fit: number
          reading_run_id: string
          respondent_user_id: string
          submitted_at?: string
          usefulness: number
        }
        Update: {
          comment?: string | null
          felt_length?: string
          issue_tags?: string[]
          perceived_fit?: number
          reading_run_id?: string
          respondent_user_id?: string
          submitted_at?: string
          usefulness?: number
        }
        Relationships: [
          {
            foreignKeyName: "reading_feedback_reading_run_id_fkey"
            columns: ["reading_run_id"]
            isOneToOne: false
            referencedRelation: "reading_run"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_feedback_respondent_user_id_fkey"
            columns: ["respondent_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_job: {
        Row: {
          about: Json
          birth_a: Json
          birth_b: Json | null
          body_written: boolean
          chart_a: Json
          chart_b: Json | null
          created_at: string
          evidence: string | null
          generation: Json | null
          prompt: string | null
          prompt_version: string | null
          requested_model: string | null
          response_id: string | null
          run_id: string
          score_baseline: number | null
          score_relation: string | null
          score_version: string | null
          sections_begun: number
          status: string
          viewed_at: string | null
        }
        Insert: {
          about: Json
          birth_a: Json
          birth_b?: Json | null
          body_written?: boolean
          chart_a: Json
          chart_b?: Json | null
          created_at?: string
          evidence?: string | null
          generation?: Json | null
          prompt?: string | null
          prompt_version?: string | null
          requested_model?: string | null
          response_id?: string | null
          run_id: string
          score_baseline?: number | null
          score_relation?: string | null
          score_version?: string | null
          sections_begun?: number
          status?: string
          viewed_at?: string | null
        }
        Update: {
          about?: Json
          birth_a?: Json
          birth_b?: Json | null
          body_written?: boolean
          chart_a?: Json
          chart_b?: Json | null
          created_at?: string
          evidence?: string | null
          generation?: Json | null
          prompt?: string | null
          prompt_version?: string | null
          requested_model?: string | null
          response_id?: string | null
          run_id?: string
          score_baseline?: number | null
          score_relation?: string | null
          score_version?: string | null
          sections_begun?: number
          status?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reading_job_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "reading_run"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_order: {
        Row: {
          amount: number
          approved_at: string | null
          bundle_credits: number
          close_reason: string | null
          closed_at: string | null
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          last_refunded_at: string | null
          provider: string
          provider_order_id: string
          provider_payment_id: string | null
          refunded_amount: number
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          bundle_credits: number
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          idempotency_key: string
          last_refunded_at?: string | null
          provider: string
          provider_order_id: string
          provider_payment_id?: string | null
          refunded_amount?: number
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          bundle_credits?: number
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          last_refunded_at?: string | null
          provider?: string
          provider_order_id?: string
          provider_payment_id?: string | null
          refunded_amount?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_order_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_order_refund: {
        Row: {
          amount: number
          credits: number
          id: string
          order_id: string
          provider_refund_id: string | null
          reason: string
          refunded_at: string
        }
        Insert: {
          amount: number
          credits: number
          id?: string
          order_id: string
          provider_refund_id?: string | null
          reason: string
          refunded_at?: string
        }
        Update: {
          amount?: number
          credits?: number
          id?: string
          order_id?: string
          provider_refund_id?: string | null
          reason?: string
          refunded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_order_refund_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "reading_order"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_run: {
        Row: {
          created_at: string
          failure_code: string | null
          failure_detail: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          kind: string
          match_id: string | null
          model: string | null
          person_a: string | null
          person_b: string | null
          prompt_version: string | null
          status: string
          usage: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          failure_code?: string | null
          failure_detail?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key: string
          kind: string
          match_id?: string | null
          model?: string | null
          person_a?: string | null
          person_b?: string | null
          prompt_version?: string | null
          status?: string
          usage?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          failure_code?: string | null
          failure_detail?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          kind?: string
          match_id?: string | null
          model?: string | null
          person_a?: string | null
          person_b?: string | null
          prompt_version?: string | null
          status?: string
          usage?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_run_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_run_person_a_fkey"
            columns: ["person_a"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_run_person_b_fkey"
            columns: ["person_b"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_run_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_share: {
        Row: {
          body: string
          created_at: string
          kind: string
          metaphor: string | null
          name_a: string | null
          name_b: string | null
          score: number | null
          shared_by: string
          token: string
          version_key: string
        }
        Insert: {
          body: string
          created_at?: string
          kind: string
          metaphor?: string | null
          name_a?: string | null
          name_b?: string | null
          score?: number | null
          shared_by: string
          token: string
          version_key: string
        }
        Update: {
          body?: string
          created_at?: string
          kind?: string
          metaphor?: string | null
          name_a?: string | null
          name_b?: string | null
          score?: number | null
          shared_by?: string
          token?: string
          version_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_share_shared_by_fkey"
            columns: ["shared_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_webhook_event: {
        Row: {
          event_id: string
          event_type: string
          processed_at: string | null
          received_at: string
          response_id: string
        }
        Insert: {
          event_id: string
          event_type: string
          processed_at?: string | null
          received_at?: string
          response_id: string
        }
        Update: {
          event_id?: string
          event_type?: string
          processed_at?: string | null
          received_at?: string
          response_id?: string
        }
        Relationships: []
      }
      report: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          reason: string
          reported_user_id: string
          reporter_user_id: string
          review_note: string | null
          review_outcome: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sanctioned_by: string | null
          sanctioned_user_id: string | null
          warning_acknowledged_at: string | null
          warning_category: string | null
          warning_email_result: string | null
          warning_emailed_at: string | null
          warning_ref: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          reason: string
          reported_user_id: string
          reporter_user_id: string
          review_note?: string | null
          review_outcome?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sanctioned_by?: string | null
          sanctioned_user_id?: string | null
          warning_acknowledged_at?: string | null
          warning_category?: string | null
          warning_email_result?: string | null
          warning_emailed_at?: string | null
          warning_ref?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          reason?: string
          reported_user_id?: string
          reporter_user_id?: string
          review_note?: string | null
          review_outcome?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sanctioned_by?: string | null
          sanctioned_user_id?: string | null
          warning_acknowledged_at?: string | null
          warning_category?: string | null
          warning_email_result?: string | null
          warning_emailed_at?: string | null
          warning_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warning_ref_is_registered"
            columns: ["warning_ref", "id"]
            isOneToOne: false
            referencedRelation: "warning_reference"
            referencedColumns: ["ref", "report_id"]
          },
        ]
      }
      service_survey: {
        Row: {
          credits_left: number | null
          free_text: string | null
          improve: string[]
          improve_text: string | null
          liked: string[]
          price_asked: string[]
          price_factors: string[]
          price_options: string[]
          price_pair: string | null
          price_solo: string | null
          saved_at: string
          schedule_id: number
          submitted_at: string | null
          survey_version: string
          unknown_features: string[]
          updated_at: string | null
          usage: Json
          user_id: string
          wants: string[]
          wants_new: string[]
        }
        Insert: {
          credits_left?: number | null
          free_text?: string | null
          improve?: string[]
          improve_text?: string | null
          liked?: string[]
          price_asked?: string[]
          price_factors?: string[]
          price_options?: string[]
          price_pair?: string | null
          price_solo?: string | null
          saved_at?: string
          schedule_id: number
          submitted_at?: string | null
          survey_version: string
          unknown_features?: string[]
          updated_at?: string | null
          usage?: Json
          user_id: string
          wants?: string[]
          wants_new?: string[]
        }
        Update: {
          credits_left?: number | null
          free_text?: string | null
          improve?: string[]
          improve_text?: string | null
          liked?: string[]
          price_asked?: string[]
          price_factors?: string[]
          price_options?: string[]
          price_pair?: string | null
          price_solo?: string | null
          saved_at?: string
          schedule_id?: number
          submitted_at?: string | null
          survey_version?: string
          unknown_features?: string[]
          updated_at?: string | null
          usage?: Json
          user_id?: string
          wants?: string[]
          wants_new?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "service_survey_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_code: {
        Row: {
          code: string
          created_at: string
          max_uses: number
          note: string | null
          valid_on: string
          valid_until: string
        }
        Insert: {
          code: string
          created_at?: string
          max_uses: number
          note?: string | null
          valid_on: string
          valid_until: string
        }
        Update: {
          code?: string
          created_at?: string
          max_uses?: number
          note?: string | null
          valid_on?: string
          valid_until?: string
        }
        Relationships: []
      }
      signup_code_miss: {
        Row: {
          missed_at: string
          user_id: string
        }
        Insert: {
          missed_at?: string
          user_id: string
        }
        Update: {
          missed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signup_code_miss_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_pause: {
        Row: {
          id: number
          paused_at: string
          reason: string
          resumed_at: string | null
        }
        Insert: {
          id?: never
          paused_at?: string
          reason: string
          resumed_at?: string | null
        }
        Update: {
          id?: never
          paused_at?: string
          reason?: string
          resumed_at?: string | null
        }
        Relationships: []
      }
      taste_artifact: {
        Row: {
          answer_direction: string | null
          attempt_started_at: string
          attempts: number
          cache_read_tokens: number | null
          cache_write_tokens: number | null
          continuation_question: string | null
          created_at: string
          distinctive_pattern: string | null
          evidence_fingerprint: string
          expires_at: string
          failure_code: string | null
          id: string
          input_tokens: number | null
          model_config_version: string
          output_tokens: number | null
          preview_markdown: string | null
          prompt_version: string
          reasoning_tokens: number | null
          response_ms: number | null
          status: string
          supporting_claims: string[] | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          answer_direction?: string | null
          attempt_started_at?: string
          attempts?: number
          cache_read_tokens?: number | null
          cache_write_tokens?: number | null
          continuation_question?: string | null
          created_at?: string
          distinctive_pattern?: string | null
          evidence_fingerprint: string
          expires_at?: string
          failure_code?: string | null
          id?: string
          input_tokens?: number | null
          model_config_version: string
          output_tokens?: number | null
          preview_markdown?: string | null
          prompt_version: string
          reasoning_tokens?: number | null
          response_ms?: number | null
          status?: string
          supporting_claims?: string[] | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          answer_direction?: string | null
          attempt_started_at?: string
          attempts?: number
          cache_read_tokens?: number | null
          cache_write_tokens?: number | null
          continuation_question?: string | null
          created_at?: string
          distinctive_pattern?: string | null
          evidence_fingerprint?: string
          expires_at?: string
          failure_code?: string | null
          id?: string
          input_tokens?: number | null
          model_config_version?: string
          output_tokens?: number | null
          preview_markdown?: string | null
          prompt_version?: string
          reasoning_tokens?: number | null
          response_ms?: number | null
          status?: string
          supporting_claims?: string[] | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      taste_daily_count: {
        Row: {
          day: string
          metric: string
          value: number
        }
        Insert: {
          day: string
          metric: string
          value?: number
        }
        Update: {
          day?: string
          metric?: string
          value?: number
        }
        Relationships: []
      }
      taste_passage: {
        Row: {
          body: string
          checked: boolean
          key: string
          made_at: string
          model: string
        }
        Insert: {
          body: string
          checked?: boolean
          key: string
          made_at?: string
          model: string
        }
        Update: {
          body?: string
          checked?: boolean
          key?: string
          made_at?: string
          model?: string
        }
        Relationships: []
      }
      taste_rate_event: {
        Row: {
          at: string
          id: string
          kind: string
          subject_hmac: string
        }
        Insert: {
          at?: string
          id?: string
          kind: string
          subject_hmac: string
        }
        Update: {
          at?: string
          id?: string
          kind?: string
          subject_hmac?: string
        }
        Relationships: []
      }
      taste_session: {
        Row: {
          answer_direction: string | null
          artifact_id: string | null
          browser_hmac: string
          claimed_at: string | null
          claimed_by: string | null
          continuation_question: string | null
          created_at: string
          distinctive_pattern: string | null
          evidence_fingerprint: string
          expires_at: string
          id: string
          model_config_version: string
          preview_markdown: string | null
          prompt_version: string
          reading_run_id: string | null
          snapshot_at: string | null
          status: string
          supporting_claims: string[] | null
          topic: string | null
        }
        Insert: {
          answer_direction?: string | null
          artifact_id?: string | null
          browser_hmac: string
          claimed_at?: string | null
          claimed_by?: string | null
          continuation_question?: string | null
          created_at?: string
          distinctive_pattern?: string | null
          evidence_fingerprint: string
          expires_at?: string
          id?: string
          model_config_version: string
          preview_markdown?: string | null
          prompt_version: string
          reading_run_id?: string | null
          snapshot_at?: string | null
          status?: string
          supporting_claims?: string[] | null
          topic?: string | null
        }
        Update: {
          answer_direction?: string | null
          artifact_id?: string | null
          browser_hmac?: string
          claimed_at?: string | null
          claimed_by?: string | null
          continuation_question?: string | null
          created_at?: string
          distinctive_pattern?: string | null
          evidence_fingerprint?: string
          expires_at?: string
          id?: string
          model_config_version?: string
          preview_markdown?: string | null
          prompt_version?: string
          reading_run_id?: string | null
          snapshot_at?: string | null
          status?: string
          supporting_claims?: string[] | null
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "taste_session_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "taste_artifact"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taste_session_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taste_session_reading_run_id_fkey"
            columns: ["reading_run_id"]
            isOneToOne: true
            referencedRelation: "reading_run"
            referencedColumns: ["id"]
          },
        ]
      }
      taste_session_step: {
        Row: {
          counted_at: string
          session_id: string
          step: string
        }
        Insert: {
          counted_at?: string
          session_id: string
          step: string
        }
        Update: {
          counted_at?: string
          session_id?: string
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "taste_session_step_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "taste_session"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity: {
        Row: {
          last_active_at: string
          user_id: string
        }
        Insert: {
          last_active_at?: string
          user_id: string
        }
        Update: {
          last_active_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      user_person_access: {
        Row: {
          created_at: string
          listed: boolean
          local_label: string
          note: string | null
          person_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          listed?: boolean
          local_label: string
          note?: string | null
          person_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          listed?: boolean
          local_label?: string
          note?: string | null
          person_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_person_access_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_person_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_account: {
        Row: {
          added_at: string
          note: string
          user_id: string
        }
        Insert: {
          added_at?: string
          note: string
          user_id: string
        }
        Update: {
          added_at?: string
          note?: string
          user_id?: string
        }
        Relationships: []
      }
      warning_reference: {
        Row: {
          ref: string
          report_id: string
        }
        Insert: {
          ref: string
          report_id: string
        }
        Update: {
          ref?: string
          report_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      reading_spend_daily: {
        Row: {
          attempts: number | null
          day: string | null
          failed: number | null
          input_tokens: number | null
          kind: string | null
          output_tokens: number | null
          succeeded: number | null
          total_tokens: number | null
          usage_unknown: number | null
          verification_attempts: number | null
          verification_failed: number | null
          verification_succeeded: number | null
          verification_total_tokens: number | null
        }
        Relationships: []
      }
      taste_daily: {
        Row: {
          avg_response_ms: number | null
          cache_read_tokens: number | null
          cache_write_tokens: number | null
          call_model: number | null
          calls_failed: number | null
          calls_late: number | null
          calls_succeeded: number | null
          calls_timed_out: number | null
          day: string | null
          input_tokens: number | null
          limited_browser: number | null
          limited_global: number | null
          limited_ip: number | null
          limited_request: number | null
          max_response_ms: number | null
          model_calls: number | null
          more_clicked: number | null
          output_tokens: number | null
          preview_shown: number | null
          reading_started: number | null
          reading_succeeded: number | null
          reasoning_tokens: number | null
          retries_exhausted: number | null
          reuse_succeeded: number | null
          session_claimed: number | null
          signup_completed: number | null
          signup_started: number | null
          wait_running: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      account_disposal_deadline: { Args: never; Returns: string }
      account_disposal_grace: { Args: never; Returns: string }
      account_residue: {
        Args: {
          p_mail: string
          p_matches: string[]
          p_sides: string[]
          p_user_id: string
        }
        Returns: string[]
      }
      acknowledge_warning: { Args: { p_ref: string }; Returns: boolean }
      activity_band_of: { Args: { p_user_id: string }; Returns: string }
      add_my_photo: {
        Args: { p_base64: string; p_content_type: string }
        Returns: number
      }
      adopt_reading_job: {
        Args: { p_response_id: string; p_run_id: string }
        Returns: boolean
      }
      approve_reading_order: {
        Args: {
          p_amount: number
          p_event_id?: string
          p_order_id: string
          p_provider_payment_id: string
        }
        Returns: {
          bundle_id: string
          outcome: string
        }[]
      }
      audit_export_batch: {
        Args: { p_limit?: number }
        Returns: {
          action: string
          actor_name: string
          actor_user_id: string
          after_id: number
          at: string
          channel: string
          error_class: string
          filter_summary: string
          id: number
          outcome: string
          purpose: string
          result: string
          result_of: number
          sql_sha256: string
          target_report_id: string
          target_report_ids: string[]
        }[]
      }
      audit_export_begin: {
        Args: never
        Returns: {
          attempt_id: number
          busy: boolean
        }[]
      }
      audit_export_done: {
        Args: {
          p_after_id: number
          p_first_id: number
          p_last_id: number
          p_object_key: string
          p_rows: number
          p_sha256: string
        }
        Returns: undefined
      }
      audit_export_finish: {
        Args: {
          p_attempt_id: number
          p_error_class?: string
          p_first_id?: number
          p_last_id?: number
          p_objects?: number
          p_outcome: string
          p_rows?: number
        }
        Returns: undefined
      }
      beta_is_over: { Args: never; Returns: boolean }
      block_user: { Args: { p_user_id: string }; Returns: boolean }
      cancel_match_request: { Args: { p_request_id: string }; Returns: string }
      cancel_reading_order: {
        Args: { p_order_id: string; p_reason: string }
        Returns: string
      }
      chat_message_max_length: { Args: never; Returns: number }
      chat_policy: {
        Args: never
        Returns: {
          max_length: number
          rate_limit: number
          rate_window_seconds: number
          retention_days: number
          snapshot_context: number
        }[]
      }
      chat_rate_limit: { Args: never; Returns: number }
      chat_rate_window: { Args: never; Returns: string }
      chat_retention: { Args: never; Returns: string }
      chat_room_readable: { Args: { p_room_id: string }; Returns: boolean }
      chat_snapshot_context: { Args: never; Returns: number }
      claim_push_deliveries: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          auth: string
          delivery_id: string
          endpoint: string
          match_id: string
          p256dh: string
        }[]
      }
      claim_reading_job: {
        Args: { p_response_id: string }
        Returns: {
          birth_a: Json
          birth_b: Json
          evidence: string
          generation: Json
          kind: string
          prompt: string
          prompt_version: string
          requested_model: string
          run_id: string
          viewed_at: string
        }[]
      }
      claim_taste_session: {
        Args: {
          p_browser_hmac: string
          p_evidence_fingerprint: string
          p_session_id: string
          p_user_id: string
        }
        Returns: {
          answer_direction: string
          continuation_question: string
          distinctive_pattern: string
          model_config_version: string
          outcome: string
          preview_markdown: string
          prompt_version: string
          reading_run_id: string
          reading_run_status: string
          supporting_claims: string[]
          topic: string
        }[]
      }
      claimed_by: { Args: { target_person: string }; Returns: string }
      complete_signup: {
        Args: {
          p_code: string
          p_contact: boolean
          p_improvement: boolean
          p_nickname: string
          p_schedule_id: number
          p_version: string
        }
        Returns: boolean
      }
      count_taste_step: { Args: { p_step: string }; Returns: undefined }
      count_taste_step_once: {
        Args: { p_browser_hmac: string; p_session_id: string; p_step: string }
        Returns: boolean
      }
      create_managed_person: {
        Args: {
          p_birth_time: string
          p_calendar: string
          p_chart: Json
          p_chart_engine_version: string
          p_city: string
          p_gender: string
          p_late_night_rule: string
          p_local_label: string
          p_note: string
          p_original_date: string
          p_solar_date: string
          p_time_basis: string
        }
        Returns: string
      }
      create_pair_for_reading: {
        Args: {
          p_a_birth_time: string
          p_a_calendar: string
          p_a_chart: Json
          p_a_chart_engine_version: string
          p_a_city: string
          p_a_gender: string
          p_a_late_night_rule: string
          p_a_local_label: string
          p_a_note: string
          p_a_original_date: string
          p_a_person: string
          p_a_solar_date: string
          p_a_time_basis: string
          p_b_birth_time: string
          p_b_calendar: string
          p_b_chart: Json
          p_b_chart_engine_version: string
          p_b_city: string
          p_b_gender: string
          p_b_late_night_rule: string
          p_b_local_label: string
          p_b_note: string
          p_b_original_date: string
          p_b_person: string
          p_b_solar_date: string
          p_b_time_basis: string
          p_listed: boolean
          p_relation: string
        }
        Returns: {
          person_a: string
          person_b: string
        }[]
      }
      create_self_person: {
        Args: {
          p_birth_time: string
          p_calendar: string
          p_chart: Json
          p_chart_engine_version: string
          p_city: string
          p_gender: string
          p_late_night_rule: string
          p_local_label: string
          p_original_date: string
          p_solar_date: string
          p_time_basis: string
          p_user_id: string
        }
        Returns: string
      }
      current_beta_schedule: {
        Args: never
        Returns: {
          ends_on: string
          operator_contact: string
          operator_name: string
          operator_officer: string
          purge_by: string
          purge_within_days: number
          schedule_id: number
        }[]
      }
      day_master_element_of: { Args: { p_user_id: string }; Returns: string }
      discovery_balance_band: {
        Args: { combined_balance: number }
        Returns: string
      }
      discovery_count_balance_v1: {
        Args: { a: Json; b: Json }
        Returns: number
      }
      discovery_count_balance_v2_float: {
        Args: { a: Json; b: Json }
        Returns: number
      }
      discovery_day_pillar_axis_v2: {
        Args: { a_chart: Json; b_chart: Json }
        Returns: number
      }
      discovery_day_relation_kinds_v2: {
        Args: { a: Json; b: Json }
        Returns: string[]
      }
      discovery_deck_size: { Args: never; Returns: number }
      discovery_eligible: {
        Args: { other: string; viewer: string }
        Returns: boolean
      }
      discovery_need_complement_v2: {
        Args: { a_need: Json; a_summary: Json; b_need: Json; b_summary: Json }
        Returns: number
      }
      discovery_need_direction_v2: {
        Args: { provider_summary: Json; receiver_need: Json }
        Returns: number
      }
      discovery_need_direction_v2_float: {
        Args: { provider_summary: Json; receiver_need: Json }
        Returns: number
      }
      discovery_need_rule: { Args: never; Returns: string }
      discovery_pair_eligible: {
        Args: { other: string; viewer: string }
        Returns: boolean
      }
      discovery_passed_active: {
        Args: { other: string; viewer: string }
        Returns: boolean
      }
      discovery_passed_kept: {
        Args: { other: string; viewer: string }
        Returns: boolean
      }
      discovery_preview_score_v2: {
        Args: {
          a_chart: Json
          a_need: Json
          a_summary: Json
          b_chart: Json
          b_need: Json
          b_summary: Json
        }
        Returns: number
      }
      discovery_preview_score_v2_of: {
        Args: {
          balance: number
          day_axis: number
          need_to_a: number
          need_to_b: number
        }
        Returns: number
      }
      discovery_seeded_unit: {
        Args: { id: string; seed: string }
        Returns: number
      }
      discovery_shown_to_me: { Args: { p_other: string }; Returns: boolean }
      discovery_supplied_elements_v1: {
        Args: { mine: Json; partner: Json }
        Returns: string[]
      }
      discovery_unavailable: {
        Args: { actor: string; other: string }
        Returns: boolean
      }
      dispose_requested_accounts: { Args: never; Returns: number }
      edit_person_input: {
        Args: {
          p_birth_time: string
          p_calendar: string
          p_chart: Json
          p_chart_engine_version: string
          p_city: string
          p_gender: string
          p_late_night_rule: string
          p_original_date: string
          p_person_id: string
          p_solar_date: string
          p_time_basis: string
          p_user_id: string
        }
        Returns: number
      }
      ensure_discovery_participation: {
        Args: {
          p_chart_engine_version: string
          p_input_version: number
          p_need: Json
          p_person_id: string
          p_summary: Json
          p_user_id: string
        }
        Returns: string
      }
      expire_match_requests: { Args: never; Returns: number }
      fail_reading_job: {
        Args: {
          p_failure_code: string
          p_failure_detail?: string
          p_run_id: string
          p_usage?: Json
        }
        Returns: boolean
      }
      fill_discovery_deck: {
        Args: { p_actor: string; p_deck: string; p_seed: string }
        Returns: number
      }
      finish_taste: {
        Args: {
          p_answer_direction?: string
          p_artifact_id: string
          p_attempt: number
          p_cache_read_tokens?: number
          p_cache_write_tokens?: number
          p_continuation_question?: string
          p_distinctive_pattern?: string
          p_failure_code?: string
          p_input_tokens?: number
          p_output_tokens?: number
          p_preview_markdown?: string
          p_reasoning_tokens?: number
          p_response_ms?: number
          p_supporting_claims?: string[]
          p_topic?: string
        }
        Returns: string
      }
      forget_orphan_people: { Args: never; Returns: number }
      forget_user: {
        Args: { p_user_id: string }
        Returns: {
          people_forgotten: number
        }[]
      }
      freeze_reading_input: {
        Args: {
          p_actor: string
          p_kind: string
          p_match_id: string
          p_person_a: string
          p_person_b: string
          p_run_id: string
        }
        Returns: undefined
      }
      hold_report_quota: { Args: { p_actor: string }; Returns: undefined }
      invalidate_pending_requests: {
        Args: { p_user_id: string }
        Returns: number
      }
      is_active_account: { Args: never; Returns: boolean }
      is_chart_pillar: { Args: { pillar: Json }; Returns: boolean }
      is_chart_snapshot: { Args: { chart: Json }; Returns: boolean }
      is_element_summary: { Args: { summary: Json }; Returns: boolean }
      is_need_summary: { Args: { summary: Json }; Returns: boolean }
      is_operator: { Args: never; Returns: boolean }
      leave_reading_feedback: {
        Args: {
          p_comment?: string
          p_felt_length: string
          p_issue_tags?: string[]
          p_perceived_fit: number
          p_run_id: string
          p_usefulness: number
        }
        Returns: undefined
      }
      link_taste_reading_run: {
        Args: {
          p_reading_run_id: string
          p_session_id: string
          p_user_id: string
        }
        Returns: {
          outcome: string
          reading_run_id: string
          reading_run_status: string
        }[]
      }
      lock_my_photos: { Args: never; Returns: string }
      lock_users: { Args: { a: string; b: string }; Returns: undefined }
      mark_chat_read:
        | { Args: { p_match_id: string }; Returns: number }
        | { Args: { p_match_id: string; p_up_to_seq: number }; Returns: number }
      mark_notifications_read: { Args: never; Returns: number }
      mark_reading_ready_read: {
        Args: { p_reading_id: string }
        Returns: number
      }
      mark_reading_webhook_processed: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      match_reading_source: {
        Args: { p_match_id: string }
        Returns: {
          output: string
          prompt_version: string
        }[]
      }
      match_request_ttl: { Args: never; Returns: string }
      match_run_awaiting_send: {
        Args: { p_request_id: string }
        Returns: {
          about: Json
          birth_a: Json
          birth_b: Json
          kind: string
          match_id: string
          person_a: string
          person_b: string
          run_id: string
          viewer_is_first: boolean
        }[]
      }
      may_edit_person_input: {
        Args: { actor: string; target_person: string }
        Returns: boolean
      }
      may_see_photo: { Args: { p_user_id: string }; Returns: boolean }
      move_my_photo: {
        Args: { p_from: number; p_to: number; p_version?: number }
        Returns: undefined
      }
      my_chat_messages: {
        Args: { p_before_seq?: number; p_limit?: number; p_match_id: string }
        Returns: {
          body: string
          created_at: string
          message_id: string
          mine: boolean
          sender_user_id: string
          seq: number
        }[]
      }
      my_chat_rooms: {
        Args: never
        Returns: {
          closed_at: string
          closed_reason: string
          last_message_at: string
          last_message_body: string
          match_id: string
          opened_at: string
          partner_activity: string
          partner_has_photo: boolean
          partner_left: boolean
          partner_nickname: string
          partner_user_id: string
          unread_count: number
        }[]
      }
      my_discovery_board: {
        Args: never
        Returns: {
          activity: string
          avatar_element: string
          balance_band: string
          candidate_user_id: string
          exploration: boolean
          has_photo: boolean
          intro: string
          nickname: string
          photo_count: number
          preview_score: number
          seat: number
          supplied_elements: string[]
        }[]
      }
      my_last_reading_run: {
        Args: {
          p_kind: string
          p_match_id?: string
          p_person_a?: string
          p_person_b?: string
        }
        Returns: {
          body_written: boolean
          created_at: string
          failure_code: string
          failure_detail: string
          job_status: string
          sections_begun: number
          status: string
        }[]
      }
      my_match_requests: {
        Args: never
        Returns: {
          balance_band: string
          counterpart_has_photo: boolean
          counterpart_intro: string
          counterpart_nickname: string
          counterpart_user_id: string
          created_at: string
          decided_at: string
          direction: string
          request_id: string
          status: string
          supplied_to_me: string[]
          supplied_to_them: string[]
        }[]
      }
      my_match_scope: {
        Args: { p_match_id: string }
        Returns: {
          balance_band: string
          created_at: string
          match_id: string
          my_chart: Json
          partner_chart: Json
          partner_has_photo: boolean
          partner_intro: string
          partner_nickname: string
          partner_user_id: string
          supplied_to_me: string[]
          supplied_to_them: string[]
        }[]
      }
      my_matches: {
        Args: never
        Returns: {
          balance_band: string
          created_at: string
          match_id: string
          partner_has_photo: boolean
          partner_intro: string
          partner_nickname: string
          partner_user_id: string
          supplied_to_me: string[]
        }[]
      }
      my_notifications: {
        Args: never
        Returns: {
          counterpart_nickname: string
          created_at: string
          kind: string
          match_id: string
          notification_id: string
          read_at: string
          reading_kind: string
          reading_label_a: string
          reading_label_b: string
          reading_person_a: string
          reading_person_b: string
          request_id: string
        }[]
      }
      my_passed_connections: {
        Args: never
        Returns: {
          avatar_element: string
          balance_band: string
          candidate_user_id: string
          has_photo: boolean
          intro: string
          nickname: string
          passed_at: string
          photo_count: number
          preview_score: number
          supplied_elements: string[]
        }[]
      }
      my_person_slots: {
        Args: never
        Returns: {
          person_limit: number
          remaining: number
          used: number
        }[]
      }
      my_photos: {
        Args: never
        Returns: {
          position: number
          version: number
        }[]
      }
      my_reading: {
        Args: {
          p_kind: string
          p_match_id?: string
          p_person_a?: string
          p_person_b?: string
        }
        Returns: {
          created_at: string
          day_master_a: string
          day_master_b: string
          from_current_chart: boolean
          id: string
          kind: string
          metaphor: string
          model: string
          my_feedback: Json
          output: string
          score: number
          score_baseline: number
          score_relation: string
          score_version: string
          source_run_id: string
          viewed_at: string
          viewer_is_first: boolean
        }[]
      }
      my_reading_artifacts: {
        Args: {
          p_kind: string
          p_match_id?: string
          p_person_a?: string
          p_person_b?: string
        }
        Returns: {
          evidence: string
          generation: Json
          prompt: string
          prompt_version: string
        }[]
      }
      my_reading_credits: {
        Args: never
        Returns: {
          available: number
          credit_limit: number
          requested: number
          reserved: number
          used: number
        }[]
      }
      my_readings: {
        Args: never
        Returns: {
          created_at: string
          day_master_a: string
          day_master_b: string
          from_current_chart: boolean
          kind: string
          label_a: string
          label_b: string
          match_id: string
          metaphor: string
          person_a: string
          person_b: string
          score: number
        }[]
      }
      my_running_readings: {
        Args: never
        Returns: {
          body_written: boolean
          created_at: string
          job_status: string
          kind: string
          label_a: string
          label_b: string
          match_id: string
          person_a: string
          person_b: string
          sections_begun: number
        }[]
      }
      my_service_survey: {
        Args: never
        Returns: {
          free_text: string
          improve: string[]
          improve_text: string
          liked: string[]
          price_factors: string[]
          price_pair: string
          price_solo: string
          saved_at: string
          submitted_at: string
          unknown_features: string[]
          updated_at: string
          wants: string[]
          wants_new: string[]
        }[]
      }
      my_summary_is_current: { Args: { p_actor: string }; Returns: boolean }
      my_warning_notice: {
        Args: never
        Returns: {
          category: string
          warned_on: string
          warning_ref: string
        }[]
      }
      need_summary_backfill_targets: {
        Args: never
        Returns: {
          chart: Json
          chart_engine_version: string
          input_version: number
          user_id: string
        }[]
      }
      new_person_with_input: {
        Args: {
          p_birth_time: string
          p_calendar: string
          p_chart: Json
          p_chart_engine_version: string
          p_city: string
          p_gender: string
          p_late_night_rule: string
          p_original_date: string
          p_solar_date: string
          p_time_basis: string
        }
        Returns: string
      }
      new_warning_ref: { Args: { p_report_id: string }; Returns: string }
      nickname_is_available: { Args: { p_nickname: string }; Returns: boolean }
      nickname_key: { Args: { p_nickname: string }; Returns: string }
      note_my_photo_upload: { Args: { p_actor: string }; Returns: undefined }
      note_operator_denial: {
        Args: { p_action: string; p_report_id?: string }
        Returns: undefined
      }
      note_reading_progress: {
        Args: {
          p_body_written: boolean
          p_run_id: string
          p_sections_begun: number
        }
        Returns: boolean
      }
      notify_ops: {
        Args: { p_detail: string; p_kind: string }
        Returns: boolean
      }
      open_reading_jobs: {
        Args: never
        Returns: {
          failure_code: string
          overdue: boolean
          response_id: string
          run_id: string
        }[]
      }
      open_reading_order: {
        Args: {
          p_bundle_credits: number
          p_idempotency_key: string
          p_provider: string
        }
        Returns: {
          amount: number
          order_id: string
          provider_order_id: string
        }[]
      }
      operator_audit_export_status: {
        Args: never
        Returns: {
          attempts_7d: number
          consecutive_failures: number
          failures_7d: number
          last_attempt_at: string
          last_error_class: string
          last_exported_id: number
          last_outcome: string
          last_success_at: string
          pending_rows: number
        }[]
      }
      operator_reading_refund_basis: {
        Args: { p_order_id: string }
        Returns: {
          amount: number
          approved_at: string
          asked: boolean
          credits: number
          currency: string
          first_used_at: string
          last_used_at: string
          order_id: string
          ordered_at: string
          provider: string
          provider_order_id: string
          provider_payment_id: string
          refunded_amount: number
          refunded_credits: number
          reserved: number
          status: string
          unused: number
          used: number
        }[]
      }
      operator_report: {
        Args: { p_report_id: string }
        Returns: {
          captured_at: string
          context_after: number
          context_before: number
          created_at: string
          detail: string
          is_open: boolean
          reason: string
          report_id: string
          reported_nickname: string
          reported_status: string
          reported_user_id: string
          reporter_nickname: string
          reporter_status: string
          reporter_user_id: string
          review_note: string
          review_outcome: string
          reviewed_at: string
          reviewer_nickname: string
          sanctioned_side: string
          warning_acknowledged_at: string
          warning_category: string
          warning_ref: string
        }[]
      }
      operator_report_snapshot: {
        Args: { p_report_id: string }
        Returns: {
          body: string
          chosen: boolean
          sent_at: string
          seq: number
          side: string
        }[]
      }
      operator_reports: {
        Args: {
          p_has_snapshot?: boolean
          p_page?: number
          p_reason?: string
          p_reviewed?: boolean
          p_warning_ref?: string
        }
        Returns: {
          chosen_excerpt: string
          created_at: string
          is_open: boolean
          pages: number
          reason: string
          report_id: string
          reported_nickname: string
          reported_user_id: string
          reporter_nickname: string
          reporter_user_id: string
          review_outcome: string
          reviewed_at: string
          snapshot_messages: number
          warning_ref: string
        }[]
      }
      operator_service_survey_counts: {
        Args: never
        Returns: {
          answers: number
          choice: string
          question: string
        }[]
      }
      operator_service_survey_overview: {
        Args: never
        Returns: {
          drafts: number
          priced_pair: number
          priced_solo: number
          submitted: number
          updated: number
        }[]
      }
      operator_service_survey_texts: {
        Args: never
        Returns: {
          free_text: string
          improve_text: string
          price_pair: string
          price_solo: string
          submitted_at: string
        }[]
      }
      operator_survey_by_version: {
        Args: never
        Returns: {
          answers: number
          felt_long: number
          felt_right: number
          felt_short: number
          kind: string
          model: string
          perceived_fit: number
          prompt_version: string
          usefulness: number
        }[]
      }
      operator_survey_comments: {
        Args: never
        Returns: {
          comment: string
          felt_length: string
          issue_tags: string[]
          kind: string
          perceived_fit: number
          prompt_version: string
          submitted_at: string
          usefulness: number
        }[]
      }
      operator_survey_overview: {
        Args: never
        Returns: {
          answered_runs: number
          answers: number
          consented: number
          declined: number
          respondents: number
          succeeded_runs: number
          unasked: number
        }[]
      }
      operator_survey_tags: {
        Args: never
        Returns: {
          answers: number
          prompt_version: string
          tag: string
        }[]
      }
      pair_relation_of: {
        Args: { p_person_a: string; p_person_b: string }
        Returns: string
      }
      person_birth: { Args: { p_person_id: string }; Returns: Json }
      person_for_pair: {
        Args: {
          p_birth_time: string
          p_calendar: string
          p_chart: Json
          p_chart_engine_version: string
          p_city: string
          p_gender: string
          p_late_night_rule: string
          p_local_label: string
          p_note: string
          p_original_date: string
          p_person: string
          p_solar_date: string
          p_time_basis: string
        }
        Returns: string
      }
      person_limit: { Args: never; Returns: number }
      person_save_daily_limit: { Args: never; Returns: number }
      person_save_hourly_limit: { Args: never; Returns: number }
      photo_at: {
        Args: { p_position: number; p_user_id: string }
        Returns: {
          base64: string
          content_type: string
        }[]
      }
      pick_reading_credit_share: {
        Args: { p_user: string }
        Returns: Record<string, unknown>
      }
      prepare_reading_job: {
        Args: {
          p_evidence: string
          p_generation: Json
          p_prompt: string
          p_prompt_version: string
          p_requested_model: string
          p_run_id: string
          p_score_baseline?: number
          p_score_relation?: string
          p_score_version?: string
          p_viewed_at: string
        }
        Returns: boolean
      }
      presence_day_window: { Args: never; Returns: string }
      presence_now_window: { Args: never; Returns: string }
      presence_policy: {
        Args: never
        Returns: {
          day_window_seconds: number
          now_window_seconds: number
          write_window_seconds: number
        }[]
      }
      presence_write_window: { Args: never; Returns: string }
      profile_photo_bytes: {
        Args: { p_base64: string; p_content_type: string }
        Returns: string
      }
      profile_photo_upload_limit: { Args: never; Returns: number }
      profile_photo_version: { Args: { p_updated_at: string }; Returns: number }
      purge_closed_chat_messages: { Args: never; Returns: number }
      push_endpoint_allowed: { Args: { p_endpoint: string }; Returns: boolean }
      push_max_attempts: { Args: never; Returns: number }
      push_retry_delay: { Args: { p_attempts: number }; Returns: string }
      push_room_key: {
        Args: { p_room_id: string; p_subscription_id: string }
        Returns: number
      }
      push_room_quiet: { Args: never; Returns: string }
      push_subscription_limit: { Args: never; Returns: number }
      push_subscription_registered: {
        Args: { p_endpoint: string }
        Returns: boolean
      }
      reading_about: {
        Args: {
          p_actor: string
          p_kind: string
          p_match_id: string
          p_person_a: string
          p_person_b: string
        }
        Returns: Json
      }
      reading_budget_warning: { Args: never; Returns: number }
      reading_bundle_price: { Args: { p_credits: number }; Returns: number }
      reading_credit_limit: { Args: never; Returns: number }
      reading_credit_limit_for: { Args: { p_user: string }; Returns: number }
      reading_credit_shares: {
        Args: { p_user: string }
        Returns: {
          bought_credits: number
          free_credits: number
          granted_credits: number
        }[]
      }
      reading_credits_used: {
        Args: { p_actor: string }
        Returns: {
          requested: number
          reserved: number
          used: number
        }[]
      }
      reading_daily_budget: { Args: never; Returns: number }
      reading_failure_alert_floor: { Args: never; Returns: number }
      reading_failure_alert_share: { Args: never; Returns: number }
      reading_job_deadline: { Args: never; Returns: string }
      reading_job_prepare_deadline: { Args: never; Returns: string }
      reading_rate_limit: { Args: never; Returns: number }
      reading_run_timeout: { Args: never; Returns: string }
      reading_sale_is_open: { Args: never; Returns: boolean }
      reading_scope: {
        Args: {
          p_kind: string
          p_match_id?: string
          p_person_a?: string
          p_person_b?: string
        }
        Returns: {
          kind: string
          match_id: string
          owner_user_id: string
          person_a: string
          person_b: string
          viewer_is_first: boolean
        }[]
      }
      reading_scope_for: {
        Args: {
          p_actor: string
          p_kind: string
          p_match_id?: string
          p_person_a?: string
          p_person_b?: string
        }
        Returns: {
          kind: string
          match_id: string
          owner_user_id: string
          person_a: string
          person_b: string
          viewer_is_first: boolean
        }[]
      }
      reading_spend_today: { Args: never; Returns: number }
      reading_user_body: { Args: { p_output: string }; Returns: string }
      record_reading_webhook_event: {
        Args: {
          p_event_id: string
          p_event_type: string
          p_response_id: string
        }
        Returns: boolean
      }
      refresh_discovery_snapshot_for: {
        Args: { p_actor: string; p_seed: string }
        Returns: string
      }
      refund_reading_order: {
        Args: {
          p_amount: number
          p_credits: number
          p_order_id: string
          p_provider_refund_id?: string
          p_reason: string
        }
        Returns: string
      }
      reject_bad_chart: {
        Args: {
          p_birth_time: string
          p_chart: Json
          p_chart_engine_version: string
        }
        Returns: undefined
      }
      release_reading_job: { Args: { p_run_id: string }; Returns: undefined }
      remove_my_photo: {
        Args: { p_position: number; p_version?: number }
        Returns: undefined
      }
      remove_push_subscription: {
        Args: { p_endpoint: string }
        Returns: boolean
      }
      report_chat_message: {
        Args: { p_detail?: string; p_message_id: string; p_reason: string }
        Returns: string
      }
      report_daily_limit: { Args: never; Returns: number }
      report_excerpt: { Args: { p_body: string }; Returns: string }
      report_is_open: {
        Args: { p_outcome: string; p_reviewed_at: string }
        Returns: boolean
      }
      report_request_error: {
        Args: { p_digest: string; p_kind: string; p_route: string }
        Returns: boolean
      }
      report_user: {
        Args: { p_detail?: string; p_reason: string; p_user_id: string }
        Returns: boolean
      }
      request_account_deletion: { Args: never; Returns: boolean }
      request_match: { Args: { p_candidate_user_id: string }; Returns: string }
      reserve_taste: {
        Args: {
          p_browser_hmac: string
          p_evidence_fingerprint: string
          p_ip_hmac: string
          p_model_config_version: string
          p_prompt_version: string
        }
        Returns: {
          artifact_id: string
          attempt: number
          outcome: string
          session_id: string
        }[]
      }
      respond_to_match_request: {
        Args: { p_accept: boolean; p_request_id: string }
        Returns: string
      }
      restore_passed_connection: {
        Args: { p_candidate_user_id: string }
        Returns: Json
      }
      review_report: {
        Args: {
          p_note: string
          p_outcome: string
          p_report_id: string
          p_reviewer: string
          p_sanctioned_user_id?: string
          p_warning_category?: string
        }
        Returns: string
      }
      save_my_profile: {
        Args: { p_intro: string; p_nickname: string }
        Returns: undefined
      }
      save_push_subscription: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string }
        Returns: undefined
      }
      save_reading: {
        Args: {
          p_evidence: string
          p_generation: Json
          p_metaphor: string
          p_model: string
          p_output: string
          p_prompt: string
          p_prompt_version: string
          p_run_id: string
          p_score: number
          p_viewed_at: string
        }
        Returns: string
      }
      save_service_survey: {
        Args: {
          p_free_text: string
          p_improve: string[]
          p_improve_text: string
          p_liked: string[]
          p_price_factors: string[]
          p_price_options: string[]
          p_price_pair: string
          p_price_solo: string
          p_submit?: boolean
          p_unknown: string[]
          p_wants: string[]
          p_wants_new: string[]
        }
        Returns: string
      }
      send_chat_message: {
        Args: { p_body: string; p_match_id: string }
        Returns: string
      }
      service_survey_context: {
        Args: never
        Returns: {
          beta_over: boolean
          consented: boolean
          credits_left: number
          read_pair: boolean
          read_solo: boolean
          schedule_id: number
        }[]
      }
      set_contact_consent: { Args: { p_consent: boolean }; Returns: undefined }
      set_discovery_need_summary: {
        Args: {
          p_chart_engine_version: string
          p_input_version: number
          p_need: Json
          p_user_id: string
        }
        Returns: boolean
      }
      set_discovery_participation: {
        Args: {
          p_chart_engine_version: string
          p_input_version: number
          p_need: Json
          p_on: boolean
          p_summary: Json
          p_user_id: string
        }
        Returns: string
      }
      set_improvement_consent: {
        Args: { p_consent: boolean }
        Returns: undefined
      }
      set_pair_relation: {
        Args: { p_person_a: string; p_person_b: string; p_relation: string }
        Returns: undefined
      }
      set_person_chart: {
        Args: {
          p_chart: Json
          p_chart_engine_version: string
          p_expected_input_version: number
          p_person_id: string
        }
        Returns: boolean
      }
      set_person_listed: {
        Args: { p_listed: boolean; p_person: string }
        Returns: undefined
      }
      settle_push_delivery: {
        Args: { p_delivery_id: string; p_result: string }
        Returns: string
      }
      settle_reading_credit_uses: {
        Args: { p_user: string }
        Returns: undefined
      }
      share_my_reading: {
        Args: {
          p_body: string
          p_kind: string
          p_metaphor: string
          p_person_a: string
          p_person_b: string
        }
        Returns: string
      }
      shared_reading: {
        Args: { p_token: string }
        Returns: {
          body: string
          created_at: string
          kind: string
          metaphor: string
          name_a: string
          name_b: string
          score: number
        }[]
      }
      signup_code_miss_limit: { Args: never; Returns: number }
      signup_code_miss_window: { Args: never; Returns: string }
      signup_today: { Args: never; Returns: string }
      start_reading_run: {
        Args: {
          p_idempotency_key: string
          p_kind: string
          p_match_id?: string
          p_model?: string
          p_person_a?: string
          p_person_b?: string
          p_prompt_version?: string
        }
        Returns: {
          match_id: string
          person_a: string
          person_b: string
          run_id: string
          viewer_is_first: boolean
        }[]
      }
      start_reading_run_for: {
        Args: {
          p_actor: string
          p_idempotency_key: string
          p_kind: string
          p_match_id?: string
          p_model?: string
          p_person_a?: string
          p_person_b?: string
          p_prompt_version?: string
        }
        Returns: {
          match_id: string
          person_a: string
          person_b: string
          run_id: string
          viewer_is_first: boolean
        }[]
      }
      survey_sole_conflict: {
        Args: { p_picked: string[]; p_sole: string[] }
        Returns: boolean
      }
      take_reading_job: {
        Args: { p_run_id: string }
        Returns: {
          about: Json
          birth_a: Json
          birth_b: Json
          kind: string
          match_id: string
          person_a: string
          person_b: string
          run_id: string
        }[]
      }
      taste_attempt_limit: { Args: never; Returns: number }
      taste_browser_new_per_hour: { Args: never; Returns: number }
      taste_call_timeout: { Args: never; Returns: string }
      taste_continuation_of_run: {
        Args: { p_reading_run_id: string; p_user_id: string }
        Returns: {
          answer_direction: string
          continuation_question: string
          distinctive_pattern: string
          model_config_version: string
          preview_markdown: string
          prompt_version: string
          session_id: string
          supporting_claims: string[]
          topic: string
        }[]
      }
      taste_daily_model_calls: { Args: never; Returns: number }
      taste_day_start: { Args: never; Returns: string }
      taste_ip_calls_per_day: { Args: never; Returns: number }
      taste_ip_calls_per_minute: { Args: never; Returns: number }
      taste_ip_requests_per_minute: { Args: never; Returns: number }
      taste_is_hex64: { Args: { p_value: string }; Returns: boolean }
      taste_is_version: { Args: { p_value: string }; Returns: boolean }
      taste_keep_for: { Args: never; Returns: string }
      taste_passage: { Args: { p_key: string }; Returns: string }
      taste_session_view: {
        Args: { p_browser_hmac: string; p_session_id: string }
        Returns: {
          expires_at: string
          preview_markdown: string
          retryable: boolean
          state: string
        }[]
      }
      taste_snapshot: {
        Args: { p_artifact_id: string; p_session_id?: string }
        Returns: number
      }
      taste_tally: {
        Args: { p_max?: boolean; p_metric: string; p_value?: number }
        Returns: undefined
      }
      taste_today: { Args: never; Returns: string }
      tell_changed: {
        Args: {
          p_area: string
          p_match_id?: string
          p_seq?: number
          p_user_id: string
        }
        Returns: undefined
      }
      touch_activity: { Args: never; Returns: boolean }
      unread_chat_count: { Args: never; Returns: number }
      unread_notifications: { Args: never; Returns: number }
      visible_matches: {
        Args: never
        Returns: {
          chart_engine_high: string | null
          chart_engine_low: string | null
          chart_high: Json | null
          chart_low: Json | null
          created_at: string
          id: string
          request_id: string | null
          user_high: string | null
          user_low: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "match"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      visible_notifications: {
        Args: never
        Returns: {
          created_at: string
          id: string
          kind: string
          match_id: string | null
          read_at: string | null
          request_id: string | null
          run_id: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      wake_push_dispatch: { Args: never; Returns: undefined }
      wake_push_dispatch_when_due: { Args: never; Returns: boolean }
      wake_reading_recovery: { Args: never; Returns: undefined }
      watch_cron: { Args: never; Returns: number }
      write_person_input: {
        Args: {
          p_actor: string
          p_birth_time: string
          p_calendar: string
          p_chart: Json
          p_chart_engine_version: string
          p_city: string
          p_gender: string
          p_late_night_rule: string
          p_original_date: string
          p_person_id: string
          p_solar_date: string
          p_time_basis: string
        }
        Returns: number
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

