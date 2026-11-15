export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_path?: string | null;
        };
        Update: {
          display_name?: string | null;
          avatar_path?: string | null;
        };
        Relationships: [];
      };
      spaces: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          created_by: string;
        };
        Update: {
          name?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          space_id: string;
          user_id: string;
          role: "owner" | "member";
          status: "active" | "revoked";
          joined_at: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      space_invitations: {
        Row: {
          id: string;
          space_id: string;
          invited_email: string;
          expires_at: string;
          accepted_at: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
