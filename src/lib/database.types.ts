export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      allergens: {
        Row: {
          code: string;
          description: string | null;
          label: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          description?: string | null;
          label: string;
          sort_order?: number;
        };
        Update: {
          code?: string;
          description?: string | null;
          label?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      announcements: {
        Row: {
          audience: string;
          body: string | null;
          created_at: string;
          created_by: string | null;
          event_id: string | null;
          expires_at: string | null;
          id: string;
          is_demo: boolean;
          is_pinned: boolean;
          is_urgent: boolean;
          publish_at: string;
          status: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          audience?: string;
          body?: string | null;
          created_at?: string;
          created_by?: string | null;
          event_id?: string | null;
          expires_at?: string | null;
          id?: string;
          is_demo?: boolean;
          is_pinned?: boolean;
          is_urgent?: boolean;
          publish_at?: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          audience?: string;
          body?: string | null;
          created_at?: string;
          created_by?: string | null;
          event_id?: string | null;
          expires_at?: string | null;
          id?: string;
          is_demo?: boolean;
          is_pinned?: boolean;
          is_urgent?: boolean;
          publish_at?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcements_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      app_settings: {
        Row: {
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: NonNullable<Json>;
        };
        Update: {
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_events: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_ref: string | null;
          created_at: string;
          details: NonNullable<Json>;
          entity_id: string | null;
          entity_type: string;
          id: number;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_ref?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          entity_id?: string | null;
          entity_type: string;
          id?: never;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_ref?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          entity_id?: string | null;
          entity_type?: string;
          id?: never;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dietary_profiles: {
        Row: {
          carries_epinephrine: boolean;
          diets: string[];
          notes_for_kitchen: string | null;
          other_restrictions: string | null;
          share_with_kitchen: boolean;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          carries_epinephrine?: boolean;
          diets?: string[];
          notes_for_kitchen?: string | null;
          other_restrictions?: string | null;
          share_with_kitchen?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          carries_epinephrine?: boolean;
          diets?: string[];
          notes_for_kitchen?: string | null;
          other_restrictions?: string | null;
          share_with_kitchen?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dietary_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dish_ingredients: {
        Row: {
          dish_id: string;
          ingredient_id: string;
          is_optional: boolean;
          quantity_note: string | null;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          dish_id: string;
          ingredient_id: string;
          is_optional?: boolean;
          quantity_note?: string | null;
          sort_order?: number;
        };
        Update: {
          dish_id?: string;
          ingredient_id?: string;
          is_optional?: boolean;
          quantity_note?: string | null;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "dish_ingredients_dish_id_fkey";
            columns: ["dish_id"];
            isOneToOne: false;
            referencedRelation: "dishes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dish_ingredients_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      dish_suggestions: {
        Row: {
          created_at: string;
          details: string | null;
          event_id: string | null;
          id: string;
          kind: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          staff_response: string | null;
          status: Database["public"]["Enums"]["suggestion_status"];
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          details?: string | null;
          event_id?: string | null;
          id?: string;
          kind?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          staff_response?: string | null;
          status?: Database["public"]["Enums"]["suggestion_status"];
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          details?: string | null;
          event_id?: string | null;
          id?: string;
          kind?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          staff_response?: string | null;
          status?: Database["public"]["Enums"]["suggestion_status"];
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dish_suggestions_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dish_suggestions_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dish_suggestions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dish_votes: {
        Row: {
          created_at: string;
          dish_id: string;
          event_id: string | null;
          id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          dish_id: string;
          event_id?: string | null;
          id?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          dish_id?: string;
          event_id?: string | null;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dish_votes_dish_id_fkey";
            columns: ["dish_id"];
            isOneToOne: false;
            referencedRelation: "dishes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dish_votes_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dish_votes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dishes: {
        Row: {
          category: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          diet_tags: string[];
          id: string;
          is_demo: boolean;
          kosher_type: string | null;
          name: string;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          diet_tags?: string[];
          id?: string;
          is_demo?: boolean;
          kosher_type?: string | null;
          name: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          diet_tags?: string[];
          id?: string;
          is_demo?: boolean;
          kosher_type?: string | null;
          name?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dishes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      event_meal_preferences: {
        Row: {
          event_id: string;
          guest_dietary_notes: string | null;
          preference: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          event_id: string;
          guest_dietary_notes?: string | null;
          preference?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          event_id?: string;
          guest_dietary_notes?: string | null;
          preference?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_meal_preferences_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_meal_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      event_menu_options: {
        Row: {
          created_at: string;
          created_by: string | null;
          dish_id: string;
          event_id: string;
          note: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          dish_id: string;
          event_id: string;
          note?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          dish_id?: string;
          event_id?: string;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_menu_options_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_menu_options_dish_id_fkey";
            columns: ["dish_id"];
            isOneToOne: false;
            referencedRelation: "dishes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_menu_options_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          approval_mode: Database["public"]["Enums"]["approval_mode"];
          capacity: number | null;
          category: Database["public"]["Enums"]["event_category"];
          contact_email: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          ends_at: string | null;
          has_meal: boolean;
          id: string;
          is_demo: boolean;
          location_address: string | null;
          location_name: string | null;
          max_guests_per_rsvp: number;
          menu_voting_open: boolean;
          rsvp_deadline: string | null;
          rsvp_enabled: boolean;
          slug: string;
          starts_at: string;
          status: Database["public"]["Enums"]["event_status"];
          summary: string | null;
          title: string;
          updated_at: string;
          visibility: Database["public"]["Enums"]["event_visibility"];
        };
        ComputedFields: never;
        Insert: {
          approval_mode?: Database["public"]["Enums"]["approval_mode"];
          capacity?: number | null;
          category?: Database["public"]["Enums"]["event_category"];
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          has_meal?: boolean;
          id?: string;
          is_demo?: boolean;
          location_address?: string | null;
          location_name?: string | null;
          max_guests_per_rsvp?: number;
          menu_voting_open?: boolean;
          rsvp_deadline?: string | null;
          rsvp_enabled?: boolean;
          slug: string;
          starts_at: string;
          status?: Database["public"]["Enums"]["event_status"];
          summary?: string | null;
          title: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["event_visibility"];
        };
        Update: {
          approval_mode?: Database["public"]["Enums"]["approval_mode"];
          capacity?: number | null;
          category?: Database["public"]["Enums"]["event_category"];
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          has_meal?: boolean;
          id?: string;
          is_demo?: boolean;
          location_address?: string | null;
          location_name?: string | null;
          max_guests_per_rsvp?: number;
          menu_voting_open?: boolean;
          rsvp_deadline?: string | null;
          rsvp_enabled?: boolean;
          slug?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["event_status"];
          summary?: string | null;
          title?: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["event_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ingredient_allergens: {
        Row: {
          allergen_code: string;
          ingredient_id: string;
        };
        ComputedFields: never;
        Insert: {
          allergen_code: string;
          ingredient_id: string;
        };
        Update: {
          allergen_code?: string;
          ingredient_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredient_allergens_allergen_code_fkey";
            columns: ["allergen_code"];
            isOneToOne: false;
            referencedRelation: "allergens";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "ingredient_allergens_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      ingredients: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          notes: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredients_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      learning_programs: {
        Row: {
          capacity: number | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          ends_on: string | null;
          id: string;
          is_demo: boolean;
          schedule_text: string | null;
          starts_on: string | null;
          status: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          capacity?: number | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_on?: string | null;
          id?: string;
          is_demo?: boolean;
          schedule_text?: string | null;
          starts_on?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          capacity?: number | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_on?: string | null;
          id?: string;
          is_demo?: boolean;
          schedule_text?: string | null;
          starts_on?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learning_programs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      learning_signups: {
        Row: {
          created_at: string;
          program_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          program_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          program_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learning_signups_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "learning_programs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_signups_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_item_cross_contact: {
        Row: {
          allergen_code: string;
          menu_item_id: string;
        };
        ComputedFields: never;
        Insert: {
          allergen_code: string;
          menu_item_id: string;
        };
        Update: {
          allergen_code?: string;
          menu_item_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_item_cross_contact_allergen_code_fkey";
            columns: ["allergen_code"];
            isOneToOne: false;
            referencedRelation: "allergens";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "menu_item_cross_contact_menu_item_id_fkey";
            columns: ["menu_item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_items: {
        Row: {
          course: string;
          cross_contact_notes: string | null;
          dish_id: string;
          dish_snapshot: Json | null;
          id: string;
          menu_version_id: string;
          preparation_notes: string | null;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          course?: string;
          cross_contact_notes?: string | null;
          dish_id: string;
          dish_snapshot?: Json | null;
          id?: string;
          menu_version_id: string;
          preparation_notes?: string | null;
          sort_order?: number;
        };
        Update: {
          course?: string;
          cross_contact_notes?: string | null;
          dish_id?: string;
          dish_snapshot?: Json | null;
          id?: string;
          menu_version_id?: string;
          preparation_notes?: string | null;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "menu_items_dish_id_fkey";
            columns: ["dish_id"];
            isOneToOne: false;
            referencedRelation: "dishes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_items_menu_version_id_fkey";
            columns: ["menu_version_id"];
            isOneToOne: false;
            referencedRelation: "menu_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_updates: {
        Row: {
          created_at: string;
          created_by: string | null;
          event_id: string;
          id: string;
          is_urgent: boolean;
          menu_version_id: string | null;
          message: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          event_id: string;
          id?: string;
          is_urgent?: boolean;
          menu_version_id?: string | null;
          message: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          event_id?: string;
          id?: string;
          is_urgent?: boolean;
          menu_version_id?: string | null;
          message?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_updates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_updates_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_updates_menu_version_id_fkey";
            columns: ["menu_version_id"];
            isOneToOne: false;
            referencedRelation: "menu_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_versions: {
        Row: {
          change_summary: string | null;
          created_at: string;
          created_by: string | null;
          event_id: string;
          id: string;
          kitchen_notes: string | null;
          prep_confirmed_at: string | null;
          prep_confirmed_by: string | null;
          published_at: string | null;
          published_by: string | null;
          status: Database["public"]["Enums"]["menu_status"];
          title: string | null;
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          change_summary?: string | null;
          created_at?: string;
          created_by?: string | null;
          event_id: string;
          id?: string;
          kitchen_notes?: string | null;
          prep_confirmed_at?: string | null;
          prep_confirmed_by?: string | null;
          published_at?: string | null;
          published_by?: string | null;
          status?: Database["public"]["Enums"]["menu_status"];
          title?: string | null;
          updated_at?: string;
          version: number;
        };
        Update: {
          change_summary?: string | null;
          created_at?: string;
          created_by?: string | null;
          event_id?: string;
          id?: string;
          kitchen_notes?: string | null;
          prep_confirmed_at?: string | null;
          prep_confirmed_by?: string | null;
          published_at?: string | null;
          published_by?: string | null;
          status?: Database["public"]["Enums"]["menu_status"];
          title?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "menu_versions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_versions_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_versions_prep_confirmed_by_fkey";
            columns: ["prep_confirmed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_versions_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          event_id: string | null;
          id: string;
          is_urgent: boolean;
          kind: string;
          link: string | null;
          read_at: string | null;
          title: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          created_at?: string;
          event_id?: string | null;
          id?: string;
          is_urgent?: boolean;
          kind: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          event_id?: string | null;
          id?: string;
          is_urgent?: boolean;
          kind?: string;
          link?: string | null;
          read_at?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pending_role_grants: {
        Row: {
          created_at: string;
          created_by: string | null;
          email: string;
          role: Database["public"]["Enums"]["app_role"];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          email: string;
          role: Database["public"]["Enums"]["app_role"];
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          email?: string;
          role?: Database["public"]["Enums"]["app_role"];
        };
        Relationships: [
          {
            foreignKeyName: "pending_role_grants_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          affiliation: string;
          class_year: number | null;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          onboarded_at: string | null;
          phone: string | null;
          preferred_name: string | null;
          share_attendance: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          affiliation?: string;
          class_year?: number | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          onboarded_at?: string | null;
          phone?: string | null;
          preferred_name?: string | null;
          share_attendance?: boolean;
          updated_at?: string;
        };
        Update: {
          affiliation?: string;
          class_year?: number | null;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          onboarded_at?: string | null;
          phone?: string | null;
          preferred_name?: string | null;
          share_attendance?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      rsvps: {
        Row: {
          checked_in_at: string | null;
          checked_in_by: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          event_id: string;
          guest_count: number;
          guest_names: string | null;
          guest_status: Database["public"]["Enums"]["guest_status"];
          id: string;
          note: string | null;
          status: Database["public"]["Enums"]["rsvp_status"];
          status_changed_at: string;
          updated_at: string;
          user_id: string;
          waitlisted_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          event_id: string;
          guest_count?: number;
          guest_names?: string | null;
          guest_status?: Database["public"]["Enums"]["guest_status"];
          id?: string;
          note?: string | null;
          status: Database["public"]["Enums"]["rsvp_status"];
          status_changed_at?: string;
          updated_at?: string;
          user_id: string;
          waitlisted_at?: string | null;
        };
        Update: {
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          event_id?: string;
          guest_count?: number;
          guest_names?: string | null;
          guest_status?: Database["public"]["Enums"]["guest_status"];
          id?: string;
          note?: string | null;
          status?: Database["public"]["Enums"]["rsvp_status"];
          status_changed_at?: string;
          updated_at?: string;
          user_id?: string;
          waitlisted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "rsvps_checked_in_by_fkey";
            columns: ["checked_in_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rsvps_decided_by_fkey";
            columns: ["decided_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rsvps_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rsvps_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_allergens: {
        Row: {
          allergen_code: string;
          created_at: string;
          notes: string | null;
          severity: Database["public"]["Enums"]["allergen_severity"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          allergen_code: string;
          created_at?: string;
          notes?: string | null;
          severity?: Database["public"]["Enums"]["allergen_severity"];
          user_id?: string;
        };
        Update: {
          allergen_code?: string;
          created_at?: string;
          notes?: string | null;
          severity?: Database["public"]["Enums"]["allergen_severity"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_allergens_allergen_code_fkey";
            columns: ["allergen_code"];
            isOneToOne: false;
            referencedRelation: "allergens";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "user_allergens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      volunteer_shifts: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          ends_at: string | null;
          event_id: string | null;
          id: string;
          is_demo: boolean;
          slots: number;
          starts_at: string;
          status: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          event_id?: string | null;
          id?: string;
          is_demo?: boolean;
          slots?: number;
          starts_at: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          event_id?: string | null;
          id?: string;
          is_demo?: boolean;
          slots?: number;
          starts_at?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "volunteer_shifts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "volunteer_shifts_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      volunteer_signups: {
        Row: {
          created_at: string;
          shift_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          shift_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          shift_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "volunteer_signups_shift_id_fkey";
            columns: ["shift_id"];
            isOneToOne: false;
            referencedRelation: "volunteer_shifts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "volunteer_signups_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      dish_allergens: {
        Row: {
          allergen_code: string | null;
          dish_id: string | null;
          only_in_optional: boolean | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "dish_ingredients_dish_id_fkey";
            columns: ["dish_id"];
            isOneToOne: false;
            referencedRelation: "dishes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ingredient_allergens_allergen_code_fkey";
            columns: ["allergen_code"];
            isOneToOne: false;
            referencedRelation: "allergens";
            referencedColumns: ["code"];
          },
        ];
      };
    };
    Functions: {
      admin_grant_role: { Args: { p_email: string; p_role: Database["public"]["Enums"]["app_role"] }; Returns: string };
      admin_remove_demo_data: { Args: Record<PropertyKey, never>; Returns: undefined };
      admin_revoke_role: {
        Args: { p_role: Database["public"]["Enums"]["app_role"]; p_user_id: string };
        Returns: undefined;
      };
      can_manage_events: { Args: Record<PropertyKey, never>; Returns: boolean };
      can_manage_menus: { Args: Record<PropertyKey, never>; Returns: boolean };
      can_view_dietary: { Args: Record<PropertyKey, never>; Returns: boolean };
      create_menu_draft: {
        Args: { p_copy_published?: boolean; p_event_id: string };
        Returns: {
          change_summary: string | null;
          created_at: string;
          created_by: string | null;
          event_id: string;
          id: string;
          kitchen_notes: string | null;
          prep_confirmed_at: string | null;
          prep_confirmed_by: string | null;
          published_at: string | null;
          published_by: string | null;
          status: Database["public"]["Enums"]["menu_status"];
          title: string | null;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "menu_versions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      event_dietary_report: {
        Args: { p_event_id: string };
        Returns: {
          allergens: Json;
          carries_epinephrine: boolean;
          diets: string[];
          email: string;
          full_name: string;
          guest_count: number;
          guest_dietary_notes: string;
          guest_status: Database["public"]["Enums"]["guest_status"];
          meal_preference: string;
          notes_for_kitchen: string;
          other_restrictions: string;
          rsvp_status: Database["public"]["Enums"]["rsvp_status"];
          shared: boolean;
          user_id: string;
        }[];
      };
      event_dietary_summary: { Args: { p_event_id: string }; Returns: Json };
      get_dish_vote_counts: {
        Args: { p_event_id?: string };
        Returns: {
          dish_id: string;
          voted_by_me: boolean;
          votes: number;
        }[];
      };
      get_event_counts: {
        Args: { p_event_ids: string[] };
        Returns: {
          checked_in: number;
          event_id: string;
          going: number;
          guests: number;
          pending: number;
          seats_taken: number;
          waitlist: number;
        }[];
      };
      get_event_menu: { Args: { p_event_id: string; p_include_draft?: boolean }; Returns: Json };
      get_my_context: { Args: Record<PropertyKey, never>; Returns: Json };
      get_my_stats: { Args: Record<PropertyKey, never>; Returns: Json };
      get_people_activity: {
        Args: { p_user_ids: string[] };
        Returns: {
          events: number;
          last_at: string;
          user_id: string;
        }[];
      };
      get_person_history: { Args: { p_user_id: string }; Returns: Json };
      get_staff_stats: { Args: { p_since: string }; Returns: Json };
      get_volunteer_counts: {
        Args: { p_shift_ids: string[] };
        Returns: {
          shift_id: string;
          taken: number;
        }[];
      };
      has_any_role: { Args: { p_roles: Database["public"]["Enums"]["app_role"][] }; Returns: boolean };
      has_role: { Args: { p_role: Database["public"]["Enums"]["app_role"] }; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number };
      my_roles: { Args: Record<PropertyKey, never>; Returns: Database["public"]["Enums"]["app_role"][] };
      publish_menu: {
        Args: {
          p_change_summary: string;
          p_confirm_preparation: boolean;
          p_menu_version_id: string;
          p_urgent?: boolean;
        };
        Returns: {
          change_summary: string | null;
          created_at: string;
          created_by: string | null;
          event_id: string;
          id: string;
          kitchen_notes: string | null;
          prep_confirmed_at: string | null;
          prep_confirmed_by: string | null;
          published_at: string | null;
          published_by: string | null;
          status: Database["public"]["Enums"]["menu_status"];
          title: string | null;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "menu_versions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_rsvp: {
        Args: {
          p_event_id: string;
          p_guest_count?: number;
          p_guest_names?: string;
          p_note?: string;
          p_response: string;
        };
        Returns: {
          checked_in_at: string | null;
          checked_in_by: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          event_id: string;
          guest_count: number;
          guest_names: string | null;
          guest_status: Database["public"]["Enums"]["guest_status"];
          id: string;
          note: string | null;
          status: Database["public"]["Enums"]["rsvp_status"];
          status_changed_at: string;
          updated_at: string;
          user_id: string;
          waitlisted_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "rsvps";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      staff_cancel_rsvp: {
        Args: { p_rsvp_id: string };
        Returns: {
          checked_in_at: string | null;
          checked_in_by: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          event_id: string;
          guest_count: number;
          guest_names: string | null;
          guest_status: Database["public"]["Enums"]["guest_status"];
          id: string;
          note: string | null;
          status: Database["public"]["Enums"]["rsvp_status"];
          status_changed_at: string;
          updated_at: string;
          user_id: string;
          waitlisted_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "rsvps";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      staff_decide_guests: {
        Args: { p_decision: string; p_override_capacity?: boolean; p_rsvp_id: string };
        Returns: {
          checked_in_at: string | null;
          checked_in_by: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          event_id: string;
          guest_count: number;
          guest_names: string | null;
          guest_status: Database["public"]["Enums"]["guest_status"];
          id: string;
          note: string | null;
          status: Database["public"]["Enums"]["rsvp_status"];
          status_changed_at: string;
          updated_at: string;
          user_id: string;
          waitlisted_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "rsvps";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      staff_decide_rsvp: {
        Args: { p_decision: string; p_override_capacity?: boolean; p_rsvp_id: string };
        Returns: {
          checked_in_at: string | null;
          checked_in_by: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          event_id: string;
          guest_count: number;
          guest_names: string | null;
          guest_status: Database["public"]["Enums"]["guest_status"];
          id: string;
          note: string | null;
          status: Database["public"]["Enums"]["rsvp_status"];
          status_changed_at: string;
          updated_at: string;
          user_id: string;
          waitlisted_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "rsvps";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      staff_invite_to_event: {
        Args: { p_emails: string[]; p_event_id: string; p_message?: string };
        Returns: {
          email: string;
          result: string;
        }[];
      };
      staff_remove_signup: { Args: { p_shift_id: string; p_user_id: string }; Returns: undefined };
      staff_set_check_in: {
        Args: { p_checked_in: boolean; p_rsvp_id: string };
        Returns: {
          checked_in_at: string | null;
          checked_in_by: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          event_id: string;
          guest_count: number;
          guest_names: string | null;
          guest_status: Database["public"]["Enums"]["guest_status"];
          id: string;
          note: string | null;
          status: Database["public"]["Enums"]["rsvp_status"];
          status_changed_at: string;
          updated_at: string;
          user_id: string;
          waitlisted_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "rsvps";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      allergen_severity: "intolerance" | "allergy" | "severe";
      app_role: "student" | "community_guest" | "organizer" | "kitchen_staff" | "admin";
      approval_mode: "auto" | "guests_need_approval" | "all_need_approval";
      event_category: "shabbat_dinner" | "holiday" | "learning" | "social" | "volunteer" | "other";
      event_status: "draft" | "published" | "cancelled";
      event_visibility: "public" | "members";
      guest_status: "none" | "pending" | "approved" | "declined";
      menu_status: "draft" | "published" | "archived";
      rsvp_status: "going" | "not_going" | "waitlist" | "pending" | "declined";
      suggestion_status: "new" | "under_review" | "accepted" | "declined";
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      allergen_severity: ["intolerance", "allergy", "severe"],
      app_role: ["student", "community_guest", "organizer", "kitchen_staff", "admin"],
      approval_mode: ["auto", "guests_need_approval", "all_need_approval"],
      event_category: ["shabbat_dinner", "holiday", "learning", "social", "volunteer", "other"],
      event_status: ["draft", "published", "cancelled"],
      event_visibility: ["public", "members"],
      guest_status: ["none", "pending", "approved", "declined"],
      menu_status: ["draft", "published", "archived"],
      rsvp_status: ["going", "not_going", "waitlist", "pending", "declined"],
      suggestion_status: ["new", "under_review", "accepted", "declined"],
    },
  },
} as const;
