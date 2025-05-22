export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          avatar_url?: string | null
          created_at?: string
        }
      }
      chats: {
        Row: {
          id: string
          name: string
          created_at: string
          created_by: string
          is_group: boolean
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          created_by: string
          is_group?: boolean
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          created_by?: string
          is_group?: boolean
        }
      }
      chat_members: {
        Row: {
          id: string
          chat_id: string
          user_id: string
          role: 'admin' | 'member'
          joined_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          user_id: string
          role?: 'admin' | 'member'
          joined_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          user_id?: string
          role?: 'admin' | 'member'
          joined_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          sender_id: string
          content: string
          created_at: string
          is_read: boolean
          attachment_url: string | null
          attachment_type: string | null
          attachment_name: string | null
        }
        Insert: {
          id?: string
          chat_id: string
          sender_id: string
          content: string
          created_at?: string
          is_read?: boolean
          attachment_url?: string | null
          attachment_type?: string | null
          attachment_name?: string | null
        }
        Update: {
          id?: string
          chat_id?: string
          sender_id?: string
          content?: string
          created_at?: string
          is_read?: boolean
          attachment_url?: string | null
          attachment_type?: string | null
          attachment_name?: string | null
        }
      }
      labels: {
        Row: {
          id: string
          name: string
          color: string
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          name: string
          color: string
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          name?: string
          color?: string
          created_at?: string
          created_by?: string
        }
      }
      chat_labels: {
        Row: {
          id: string
          chat_id: string
          label_id: string
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          label_id: string
          created_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          label_id?: string
          created_at?: string
        }
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
  }
} 