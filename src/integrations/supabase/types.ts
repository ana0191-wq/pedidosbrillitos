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
      client_orders: {
        Row: {
          amount_charged: number | null
          client_id: string
          created_at: string
          id: string
          notes: string | null
          payment_method: string | null
          payment_reference: string | null
          shipping_cost: number | null
          shipping_dimensions: string | null
          shipping_type: string | null
          shipping_volume_ft3: number | null
          shipping_weight_lb: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_charged?: number | null
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          shipping_cost?: number | null
          shipping_dimensions?: string | null
          shipping_type?: string | null
          shipping_volume_ft3?: number | null
          shipping_weight_lb?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_charged?: number | null
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          shipping_cost?: number | null
          shipping_dimensions?: string | null
          shipping_type?: string | null
          shipping_volume_ft3?: number | null
          shipping_weight_lb?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gmail_tokens: {
        Row: {
          access_token: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email?: string | null
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount_charged: number | null
          category: string
          client_name: string | null
          client_order_id: string | null
          created_at: string
          estimated_arrival: string | null
          id: string
          notes: string | null
          order_date: string | null
          order_number: string | null
          price_paid: number
          price_per_unit: number | null
          product_name: string
          product_photo: string | null
          shipping_cost: number | null
          status: string
          store: string
          suggested_price: number | null
          units_ordered: number | null
          units_received: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_charged?: number | null
          category: string
          client_name?: string | null
          client_order_id?: string | null
          created_at?: string
          estimated_arrival?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          order_number?: string | null
          price_paid?: number
          price_per_unit?: number | null
          product_name: string
          product_photo?: string | null
          shipping_cost?: number | null
          status?: string
          store: string
          suggested_price?: number | null
          units_ordered?: number | null
          units_received?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_charged?: number | null
          category?: string
          client_name?: string | null
          client_order_id?: string | null
          created_at?: string
          estimated_arrival?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          order_number?: string | null
          price_paid?: number
          price_per_unit?: number | null
          product_name?: string
          product_photo?: string | null
          shipping_cost?: number | null
          status?: string
          store?: string
          suggested_price?: number | null
          units_ordered?: number | null
          units_received?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_order_id_fkey"
            columns: ["client_order_id"]
            isOneToOne: false
            referencedRelation: "client_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_settings: {
        Row: {
          air_price_per_lb: number | null
          air_rate_per_lb: number | null
          created_at: string
          default_margin_percent: number | null
          default_shipping_percent: number | null
          id: string
          sea_insurance: number | null
          sea_minimum: number | null
          sea_profit: number | null
          sea_rate_per_ft3: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          air_price_per_lb?: number | null
          air_rate_per_lb?: number | null
          created_at?: string
          default_margin_percent?: number | null
          default_shipping_percent?: number | null
          id?: string
          sea_insurance?: number | null
          sea_minimum?: number | null
          sea_profit?: number | null
          sea_rate_per_ft3?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          air_price_per_lb?: number | null
          air_rate_per_lb?: number | null
          created_at?: string
          default_margin_percent?: number | null
          default_shipping_percent?: number | null
          id?: string
          sea_insurance?: number | null
          sea_minimum?: number | null
          sea_profit?: number | null
          sea_rate_per_ft3?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_own_order: { Args: { order_id: string }; Returns: boolean }
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
    Enums: {},
  },
} as const
