/**
 * SceneOS — Type Definitions for PostgreSQL Database Schema
 * Generated for Phase 1 Technical Foundation
 * Compatible with @supabase/supabase-js v2 schema generator
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProjectRole =
  | 'owner'
  | 'producer'
  | 'director'
  | 'first_ad'
  | 'department_head'
  | 'crew_member'
  | 'viewer';

export type ProjectStatus =
  | 'development'
  | 'pre-production'
  | 'production'
  | 'post-production'
  | 'wrapped'
  | 'archived';

/** Row shape returned by the get_project_members() RPC (minimum identity data). */
export interface ProjectMemberRpcRow {
  member_id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  department: string | null;
  directory_entry_id: string | null;
  joined_at: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  is_owner: boolean;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          phone: string | null;
          bio: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          avatar_url?: string | null;
          phone?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string | null;
          phone?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          title: string;
          logline: string | null;
          director: string | null;
          producer: string | null;
          status: ProjectStatus;
          budget_total: number;
          daily_burn_cap: number;
          target_start_date: string | null;
          target_wrap_date: string | null;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          logline?: string | null;
          director?: string | null;
          producer?: string | null;
          status?: ProjectStatus;
          budget_total?: number;
          daily_burn_cap?: number;
          target_start_date?: string | null;
          target_wrap_date?: string | null;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          logline?: string | null;
          director?: string | null;
          producer?: string | null;
          status?: ProjectStatus;
          budget_total?: number;
          daily_burn_cap?: number;
          target_start_date?: string | null;
          target_wrap_date?: string | null;
          owner_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      project_members: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          role: ProjectRole;
          department_id: string | null;
          department: string | null;
          directory_entry_id: string | null;
          custom_permissions: Json;
          joined_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          role?: ProjectRole;
          department_id?: string | null;
          department?: string | null;
          directory_entry_id?: string | null;
          custom_permissions?: Json;
          joined_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          role?: ProjectRole;
          department_id?: string | null;
          department?: string | null;
          directory_entry_id?: string | null;
          custom_permissions?: Json;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          project_id: string | null;
          user_id: string | null;
          entity_type: string;
          entity_id: string;
          action: string;
          old_values: Json | null;
          new_values: Json | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          user_id?: string | null;
          entity_type: string;
          entity_id: string;
          action: string;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          user_id?: string | null;
          entity_type?: string;
          entity_id?: string;
          action?: string;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      project_activity: {
        Row: {
          id: string;
          project_id: string;
          user_id: string | null;
          activity_type: string;
          title: string;
          description: string | null;
          entity_type: string | null;
          entity_id: string | null;
          entity_label: string | null;
          dedup_key: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id?: string | null;
          activity_type: string;
          title: string;
          description?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          entity_label?: string | null;
          dedup_key?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string | null;
          activity_type?: string;
          title?: string;
          description?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          entity_label?: string | null;
          dedup_key?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_activity_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_activity_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      project_invitations: {
        Row: {
          id: string;
          project_id: string;
          email: string;
          role: ProjectRole;
          department_id: string | null;
          department: string | null;
          directory_entry_id: string | null;
          token_hash: string;
          invited_by: string;
          status: 'pending' | 'accepted' | 'revoked' | 'expired';
          expires_at: string;
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          email: string;
          role?: ProjectRole;
          department_id?: string | null;
          department?: string | null;
          directory_entry_id?: string | null;
          token_hash: string;
          invited_by: string;
          status?: 'pending' | 'accepted' | 'revoked' | 'expired';
          expires_at: string;
          created_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          email?: string;
          role?: ProjectRole;
          department_id?: string | null;
          department?: string | null;
          directory_entry_id?: string | null;
          token_hash?: string;
          invited_by?: string;
          status?: 'pending' | 'accepted' | 'revoked' | 'expired';
          expires_at?: string;
          created_at?: string;
          accepted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "project_invitations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      project_operational_states: {
        Row: {
          project_id: string;
          production_state: Json;
          phases_state: Json;
          visualize_state: Json;
          updated_at: string;
        };
        Insert: {
          project_id: string;
          production_state?: Json;
          phases_state?: Json;
          visualize_state?: Json;
          updated_at?: string;
        };
        Update: {
          project_id?: string;
          production_state?: Json;
          phases_state?: Json;
          visualize_state?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_operational_states_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: true;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_project_member: {
        Args: { p_project_id: string; p_user_id: string };
        Returns: boolean;
      };
      has_project_role: {
        Args: { p_project_id: string; p_user_id: string; p_roles: ProjectRole[] };
        Returns: boolean;
      };
      current_app_user_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      accept_project_invitation: {
        Args: { p_token: string };
        Returns: Json;
      };
      preview_project_invitation: {
        Args: { p_token: string };
        Returns: Json;
      };
      create_project_invitation: {
        Args: {
          p_project_id: string;
          p_email: string;
          p_role: ProjectRole;
          p_department?: string | null;
          p_directory_entry_id?: string | null;
          p_expires_hours?: number;
        };
        Returns: Json;
      };
      revoke_project_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      get_project_members: {
        Args: { p_project_id: string };
        Returns: ProjectMemberRpcRow[];
      };
      can_assign_role: {
        Args: { p_project_id: string; p_actor_id: string; p_target_role: ProjectRole };
        Returns: boolean;
      };
    };
    Enums: {
      project_role: ProjectRole;
      project_status: ProjectStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
