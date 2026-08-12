export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      clubs: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          category: string | null;
          category_id: string | null;
          logo_url: string | null;
          banner_url: string | null;
          is_private: boolean;
          visibility: "public" | "private" | "unlisted";
          github_repo_url: string | null;
          website_url: string | null;
          instagram_url: string | null;
          linkedin_url: string | null;
          twitter_url: string | null;
          discord_url: string | null;
          social_links: Json | null;
          is_verified: boolean;
          is_archived: boolean;
          tags: string[] | null;
          version: number;
          member_count: number;
          created_by: string | null;
          status: string | null;
          promo_video_url: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          category?: string | null;
          category_id?: string | null;
          logo_url?: string | null;
          banner_url?: string | null;
          is_private?: boolean;
          visibility?: "public" | "private" | "unlisted";
          github_repo_url?: string | null;
          website_url?: string | null;
          instagram_url?: string | null;
          linkedin_url?: string | null;
          twitter_url?: string | null;
          discord_url?: string | null;
          social_links?: Json | null;
          is_verified?: boolean;
          is_archived?: boolean;
          tags?: string[] | null;
          version?: number;
          member_count?: number;
          created_by?: string | null;
          status?: string | null;
          promo_video_url?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          category?: string | null;
          category_id?: string | null;
          logo_url?: string | null;
          banner_url?: string | null;
          is_private?: boolean;
          visibility?: "public" | "private" | "unlisted";
          github_repo_url?: string | null;
          website_url?: string | null;
          instagram_url?: string | null;
          linkedin_url?: string | null;
          twitter_url?: string | null;
          discord_url?: string | null;
          social_links?: Json | null;
          is_verified?: boolean;
          is_archived?: boolean;
          tags?: string[] | null;
          version?: number;
          member_count?: number;
          created_by?: string | null;
          status?: string | null;
          promo_video_url?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      club_tags: {
        Row: {
          id: string;
          club_id: string;
          tag: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          tag: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          tag?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_tags_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      club_stats: {
        Row: {
          club_id: string;
          total_members: number;
          total_events: number;
          total_posts: number;
          updated_at: string;
        };
        Insert: {
          club_id: string;
          total_members?: number;
          total_events?: number;
          total_posts?: number;
          updated_at?: string;
        };
        Update: {
          club_id?: string;
          total_members?: number;
          total_events?: number;
          total_posts?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_stats_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: true;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      bulk_email_jobs: {
        Row: {
          id: string;
          club_id: string;
          template_id: string;
          status: "pending" | "processing" | "completed" | "failed";
          processed_count: number;
          total_count: number;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          template_id: string;
          status?: "pending" | "processing" | "completed" | "failed";
          processed_count?: number;
          total_count?: number;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          template_id?: string;
          status?: "pending" | "processing" | "completed" | "failed";
          processed_count?: number;
          total_count?: number;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
          avatar_theme: string | null;
          bio: string | null;
          handle: string | null;
          email: string | null;
          college: string | null;
          phone_number: string | null;
          linkedin_url: string | null;
          role: "student" | "admin" | "faculty" | "owner" | "system_admin";
          skills: string[] | null;
          notification_preferences: Json | null;
          is_banned: boolean;
          strike_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          avatar_theme?: string | null;
          bio?: string | null;
          handle?: string | null;
          email?: string | null;
          college?: string | null;
          phone_number?: string | null;
          linkedin_url?: string | null;
          role?: "student" | "admin" | "faculty" | "owner" | "system_admin";
          skills?: string[] | null;
          notification_preferences?: Json | null;
          is_banned?: boolean;
          strike_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          avatar_theme?: string | null;
          bio?: string | null;
          handle?: string | null;
          email?: string | null;
          college?: string | null;
          phone_number?: string | null;
          linkedin_url?: string | null;
          role?: "student" | "admin" | "faculty" | "owner" | "system_admin";
          skills?: string[] | null;
          notification_preferences?: Json | null;
          is_banned?: boolean;
          strike_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          user_id: string;
          email_alerts: boolean;
          push_notifications: boolean;
          digest: boolean;
          dark_mode_default: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email_alerts?: boolean;
          push_notifications?: boolean;
          digest?: boolean;
          dark_mode_default?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          email_alerts?: boolean;
          push_notifications?: boolean;
          digest?: boolean;
          dark_mode_default?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          email_alerts: boolean;
          push_notifications: boolean;
          digest: boolean;
          dark_mode_default: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email_alerts?: boolean;
          push_notifications?: boolean;
          digest?: boolean;
          dark_mode_default?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          email_alerts?: boolean;
          push_notifications?: boolean;
          digest?: boolean;
          dark_mode_default?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      certificates: {
        Row: {
          id: string;
          user_id: string;
          event_id: string | null;
          club_id: string | null;
          attendee_name: string | null;
          event_title: string | null;
          event_date: string | null;
          certificate_url: string;
          certificate_type: "attendance" | "leadership";
          role_title: string | null;
          tenure_start: string | null;
          tenure_end: string | null;
          termination_reason: string | null;
          issued_at: string | null;
          email_sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id?: string | null;
          club_id?: string | null;
          attendee_name?: string | null;
          event_title?: string | null;
          event_date?: string | null;
          certificate_url: string;
          certificate_type?: "attendance" | "leadership";
          role_title?: string | null;
          tenure_start?: string | null;
          tenure_end?: string | null;
          termination_reason?: string | null;
          issued_at?: string | null;
          email_sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string | null;
          club_id?: string | null;
          attendee_name?: string | null;
          event_title?: string | null;
          event_date?: string | null;
          certificate_url?: string;
          certificate_type?: "attendance" | "leadership";
          role_title?: string | null;
          tenure_start?: string | null;
          tenure_end?: string | null;
          termination_reason?: string | null;
          issued_at?: string | null;
          email_sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "certificates_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "certificates_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          id: string;
          short_id: string | null;
          club_id: string;
          category_id: string | null;
          created_by: string | null;
          title: string;
          description: string | null;
          banner_url: string | null;
          cover_image_url: string | null;
          event_date: string | null;
          start_date: string | null;
          end_date: string | null;

          location: any;
          metadata: Json | null;
          latitude: number | null;
          longitude: number | null;
          geofencing_enabled: boolean;
          geofence_radius_meters: number;
          max_attendees: number | null;
          available_spots: number | null;
          rsvp_count: number;
          // views column removed — view counts now live in the event_metrics table (issue #2274)
          popularity_score: number | null;
          is_featured: boolean;
          requires_approval: boolean;
          status:
            | "upcoming"
            | "ongoing"
            | "completed"
            | "cancelled"
            | "published"
            | "active"
            | "draft"
            | "expired"
            | "archived";
          tags: string[] | null;
          faqs: Json | null;
          blurhash: string | null;
          created_at: string;
          updated_at: string;
          generates_certificate: boolean;
          accommodation_deadline: string | null;
        };
        Insert: {
          id?: string;
          short_id?: string | null;
          club_id: string;
          category_id?: string | null;
          created_by?: string | null;
          title: string;
          description?: string | null;
          banner_url?: string | null;
          cover_image_url?: string | null;
          event_date?: string | null;
          start_date?: string | null;
          end_date?: string | null;

          location?: any;
          metadata?: Json | null;
          latitude?: number | null;
          longitude?: number | null;
          geofencing_enabled?: boolean;
          geofence_radius_meters?: number;
          max_attendees?: number | null;
          available_spots?: number | null;
          rsvp_count?: number;
          // views column removed — view counts now live in the event_metrics table (issue #2274)
          popularity_score?: number | null;
          is_featured?: boolean;
          requires_approval?: boolean;
          status?:
            | "upcoming"
            | "ongoing"
            | "completed"
            | "cancelled"
            | "published"
            | "active"
            | "draft"
            | "expired"
            | "archived";
          tags?: string[] | null;
          faqs?: Json | null;
          blurhash?: string | null;
          created_at?: string;
          updated_at?: string;
          generates_certificate?: boolean;
          accommodation_deadline?: string | null;
        };
        Update: {
          id?: string;
          short_id?: string | null;
          club_id?: string;
          category_id?: string | null;
          created_by?: string | null;
          title?: string;
          description?: string | null;
          banner_url?: string | null;
          cover_image_url?: string | null;
          event_date?: string | null;
          start_date?: string | null;
          end_date?: string | null;

          location?: any;
          metadata?: Json | null;
          latitude?: number | null;
          longitude?: number | null;
          geofencing_enabled?: boolean;
          geofence_radius_meters?: number;
          max_attendees?: number | null;
          available_spots?: number | null;
          rsvp_count?: number;
          // views column removed — view counts now live in the event_metrics table (issue #2274)
          popularity_score?: number | null;
          is_featured?: boolean;
          requires_approval?: boolean;
          status?:
            | "upcoming"
            | "ongoing"
            | "completed"
            | "cancelled"
            | "published"
            | "active"
            | "draft"
            | "expired"
            | "archived";
          tags?: string[] | null;
          faqs?: Json | null;
          blurhash?: string | null;
          created_at?: string;
          updated_at?: string;
          generates_certificate?: boolean;
          accommodation_deadline?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "events_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * UNLOGGED table for high-throughput event view counting (issue #2274).
       * One row per event; views are incremented via the increment_event_views() RPC.
       */
      event_metrics: {
        Row: {
          event_id: string;
          views: number;
          updated_at: string;
        };
        Insert: {
          event_id: string;
          views?: number;
          updated_at?: string;
        };
        Update: {
          event_id?: string;
          views?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_metrics_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: true;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      event_categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          icon: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          icon?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          icon?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      event_rsvps: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          status:
            "going" | "maybe" | "cancelled" | "waitlist" | "approved" | "rejected" | "waitlisted";
          checked_in: boolean;
          rsvp_at: string | null;
          created_at: string;
          updated_at: string;
          accommodations_requested: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          status?:
            "going" | "maybe" | "cancelled" | "waitlist" | "approved" | "rejected" | "waitlisted";
          checked_in?: boolean;
          rsvp_at?: string | null;
          created_at?: string;
          updated_at?: string;
          accommodations_requested?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          status?:
            "going" | "maybe" | "cancelled" | "waitlist" | "approved" | "rejected" | "waitlisted";
          checked_in?: boolean;
          rsvp_at?: string | null;
          created_at?: string;
          updated_at?: string;
          accommodations_requested?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_rsvps_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      accommodation_audit_logs: {
        Row: {
          id: string;
          viewer_id: string | null;
          rsvp_id: string;
          event_id: string | null;
          club_id: string | null;
          action: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          viewer_id?: string | null;
          rsvp_id: string;
          event_id?: string | null;
          club_id?: string | null;
          action?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          viewer_id?: string | null;
          rsvp_id?: string;
          event_id?: string | null;
          club_id?: string | null;
          action?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accommodation_audit_logs_viewer_id_fkey";
            columns: ["viewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      event_attendance_logs: {
        Row: {
          id: string;
          rsvp_id: string;
          scanned_by: string;
          recorded_by: string | null;
          verification_method: "manual" | "qr_scan" | "geofence" | "organizer_override";
          distance_meters: number | null;
          location_accuracy_meters: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          rsvp_id: string;
          scanned_by?: string;
          recorded_by?: string | null;
          verification_method?: "manual" | "qr_scan" | "geofence" | "organizer_override";
          distance_meters?: number | null;
          location_accuracy_meters?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          rsvp_id?: string;
          scanned_by?: string;
          recorded_by?: string | null;
          verification_method?: "manual" | "qr_scan" | "geofence" | "organizer_override";
          distance_meters?: number | null;
          location_accuracy_meters?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      event_chat_messages: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_chat_messages_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_chat_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      event_waitlist: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          position: number;
          status: "waiting" | "promoted" | "cancelled";
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          position?: number;
          status?: "waiting" | "promoted" | "cancelled";
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          position?: number;
          status?: "waiting" | "promoted" | "cancelled";
          created_at?: string;
        };
        Relationships: [];
      };
      event_feedback: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          rating?: number;
          comment?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      event_feedbacks: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          rating?: number;
          comment?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          club_id: string;
          author_id: string;
          title: string | null;
          content: string;
          image_url: string | null;
          blurhash: string | null;
          is_pinned: boolean;
          is_deleted: boolean;
          deleted_at: string | null;
          like_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          author_id: string;
          title?: string | null;
          content: string;
          image_url?: string | null;
          blurhash?: string | null;
          is_pinned?: boolean;
          is_deleted?: boolean;
          deleted_at?: string | null;
          like_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          author_id?: string;
          title?: string | null;
          content?: string;
          image_url?: string | null;
          blurhash?: string | null;
          is_pinned?: boolean;
          is_deleted?: boolean;
          deleted_at?: string | null;
          like_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      post_likes: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      post_reactions: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          emoji: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id: string;
          user_id: string;
          emoji?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      bookmarks: {
        Row: {
          id: string;
          user_id: string;
          post_id: string | null;
          club_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          post_id?: string | null;
          club_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          post_id?: string | null;
          club_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          post_id: string | null;
          article_id: string | null;
          author_id: string;
          parent_id: string | null;
          parent_comment_id?: string | null;
          content: string;
          is_deleted: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id?: string | null;
          article_id?: string | null;
          author_id: string;
          parent_id?: string | null;
          parent_comment_id?: string | null;
          content: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string | null;
          article_id?: string | null;
          author_id?: string;
          parent_id?: string | null;
          parent_comment_id?: string | null;
          content?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      club_members: {
        Row: {
          id: string;
          club_id: string;
          user_id: string;
          role: "member" | "admin" | "owner";
          status: "pending" | "approved" | "rejected";
          joined_at: string | null;
          removed_at: string | null;
          termination_reason: "term_completed" | "resigned" | "impeached" | "removed" | "role_changed" | string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          user_id: string;
          role?: "member" | "admin" | "owner";
          status?: "pending" | "approved" | "rejected";
          joined_at?: string | null;
          removed_at?: string | null;
          termination_reason?: "term_completed" | "resigned" | "impeached" | "removed" | "role_changed" | string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          user_id?: string;
          role?: "member" | "admin" | "owner";
          status?: "pending" | "approved" | "rejected";
          joined_at?: string | null;
          removed_at?: string | null;
          termination_reason?: "term_completed" | "resigned" | "impeached" | "removed" | "role_changed" | string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "club_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      club_requests: {
        Row: {
          id: string;
          club_id: string;
          user_id: string;
          message: string | null;
          status: "pending" | "approved" | "rejected";
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          user_id: string;
          message?: string | null;
          status?: "pending" | "approved" | "rejected";
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          user_id?: string;
          message?: string | null;
          status?: "pending" | "approved" | "rejected";
          created_at?: string;
        };
        Relationships: [];
      };
      club_meeting_notes: {
        Row: {
          id: string;
          club_id: string;
          title: string;
          content_text: string | null;
          yjs_state: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          title?: string;
          content_text?: string | null;
          yjs_state?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          title?: string;
          content_text?: string | null;
          yjs_state?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      club_meeting_note_versions: {
        Row: {
          id: string;
          note_id: string;
          version_number: number;
          title: string | null;
          content_text: string | null;
          yjs_state: string | null;
          summary: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          version_number?: number;
          title?: string | null;
          content_text?: string | null;
          yjs_state?: string | null;
          summary?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          note_id?: string;
          version_number?: number;
          title?: string | null;
          content_text?: string | null;
          yjs_state?: string | null;
          summary?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      club_folders: {
        Row: {
          id: string;
          club_id: string;
          name: string;
          parent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          name: string;
          parent_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          name?: string;
          parent_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      club_documents: {
        Row: {
          id: string;
          club_id: string;
          folder_id: string | null;
          name: string;
          file_path: string;
          file_size: number;
          mime_type: string;
          uploaded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          folder_id?: string | null;
          name: string;
          file_path: string;
          file_size: number;
          mime_type: string;
          uploaded_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          folder_id?: string | null;
          name?: string;
          file_path?: string;
          file_size?: number;
          mime_type?: string;
          uploaded_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      articles: {
        Row: {
          id: string;
          club_id: string;
          title: string;
          slug: string;
          content: string;
          summary: string | null;
          cover_image_url: string | null;
          read_time_minutes: number | null;
          author_id: string;
          status: "draft" | "published" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          title: string;
          slug?: string;
          content: string;
          summary?: string | null;
          cover_image_url?: string | null;
          read_time_minutes?: number | null;
          author_id: string;
          status?: "draft" | "published" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          title?: string;
          slug?: string;
          content?: string;
          summary?: string | null;
          cover_image_url?: string | null;
          read_time_minutes?: number | null;
          author_id?: string;
          status?: "draft" | "published" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      saved_events: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_events_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          actor_id: string | null;
          type: string;
          title: string;
          message: string;
          link: string | null;
          link_url: string | null;

          metadata: Record<string, any> | null;
          is_read: boolean;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          actor_id?: string | null;
          type: string;
          title: string;
          message: string;
          link?: string | null;
          link_url?: string | null;

          metadata?: Record<string, any> | null;
          is_read?: boolean;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          actor_id?: string | null;
          type?: string;
          title?: string;
          message?: string;
          link?: string | null;
          link_url?: string | null;

          metadata?: Record<string, any> | null;
          is_read?: boolean;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_blocks: {
        Row: {
          id: string;
          blocker_id: string;
          blocked_id: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          blocker_id: string;
          blocked_id: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          blocker_id?: string;
          blocked_id?: string;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      direct_messages: {
        Row: {
          id: string;
          sender_id: string;
          receiver_id: string;
          content: string | null;
          encrypted_payload: Json | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          receiver_id: string;
          content?: string | null;
          encrypted_payload?: Json | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          receiver_id?: string;
          content?: string | null;
          encrypted_payload?: Json | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: string;
          target_id: string;
          reason: string;
          details: string | null;
          status: "pending" | "resolved" | "dismissed";
          resolved_at: string | null;
          resolved_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target_type: string;
          target_id: string;
          reason: string;
          details?: string | null;
          status?: "pending" | "resolved" | "dismissed";
          resolved_at?: string | null;
          resolved_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          target_type?: string;
          target_id?: string;
          reason?: string;
          details?: string | null;
          status?: "pending" | "resolved" | "dismissed";
          resolved_at?: string | null;
          resolved_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      bug_reports: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          description: string;
          category: string;
          priority: "low" | "medium" | "high" | "critical";
          status: "open" | "in_progress" | "resolved" | "closed";
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          description: string;
          category?: string;
          priority?: "low" | "medium" | "high" | "critical";
          status?: "open" | "in_progress" | "resolved" | "closed";
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          title?: string;
          description?: string;
          category?: string;
          priority?: "low" | "medium" | "high" | "critical";
          status?: "open" | "in_progress" | "resolved" | "closed";
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          club_id: string;
          title: string;
          description: string | null;
          status: "todo" | "in_progress" | "done";
          priority: "low" | "medium" | "high";
          assignee_id: string | null;
          created_by: string;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          title: string;
          description?: string | null;
          status?: "todo" | "in_progress" | "done";
          priority?: "low" | "medium" | "high";
          assignee_id?: string | null;
          created_by: string;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          title?: string;
          description?: string | null;
          status?: "todo" | "in_progress" | "done";
          priority?: "low" | "medium" | "high";
          assignee_id?: string | null;
          created_by?: string;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      system_counters: {
        Row: {
          counter_name: string;
          counter_value: number;
          updated_at: string;
        };
        Insert: {
          counter_name: string;
          counter_value?: number;
          updated_at?: string;
        };
        Update: {
          counter_name?: string;
          counter_value?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      webhooks: {
        Row: {
          id: string;
          club_id: string;
          url: string;
          events_subscribed: string[];
          secret: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          url: string;
          events_subscribed?: string[];
          secret: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          url?: string;
          events_subscribed?: string[];
          secret?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      webhook_deliveries: {
        Row: {
          id: string;
          webhook_id: string;
          event_name: string;
          payload: Json;
          status: string;
          status_code: number;
          attempt: number;
          next_retry_at: string;
          last_error: string | null;
          response_body: string | null;
          created_at: string;
          delivered_at: string | null;
        };
        Insert: {
          id?: string;
          webhook_id: string;
          event_name: string;
          payload: Json;
          status: string;
          status_code: number;
          attempt?: number;
          next_retry_at?: string;
          last_error?: string | null;
          response_body?: string | null;
          created_at?: string;
          delivered_at?: string | null;
        };
        Update: {
          id?: string;
          webhook_id: string;
          event_name?: string;
          payload?: Json;
          status?: string;
          status_code?: number;
          attempt?: number;
          next_retry_at?: string;
          last_error?: string | null;
          response_body?: string | null;
          created_at?: string;
          delivered_at?: string | null;
        };
        Relationships: [];
      };
      lost_found_items: {
        Row: {
          id: string;
          user_id: string;
          club_id: string | null;
          title: string;
          description: string | null;
          category: string;
          type: string;
          contact_info: string | null;
          location: string | null;
          image_url: string | null;
          status: string;
          reporter_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          club_id?: string | null;
          title: string;
          description?: string | null;
          category: string;
          type?: string;
          contact_info?: string | null;
          location?: string | null;
          image_url?: string | null;
          status?: string;
          reporter_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          club_id?: string | null;
          title?: string;
          description?: string | null;
          category?: string;
          type?: string;
          contact_info?: string | null;
          location?: string | null;
          image_url?: string | null;
          status?: string;
          reporter_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lost_found_items_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      club_jobs: {
        Row: {
          id: string;
          club_id: string;
          title: string;
          description: string;
          role_type: string;
          location: string;
          is_active: boolean;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          title: string;
          description: string;
          role_type: string;
          location: string;
          is_active?: boolean;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id: string;
          title?: string;
          description?: string;
          role_type?: string;
          location?: string;
          is_active?: boolean;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string;
          action: string;
          entity_type: string;
          entity_id: string;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          action: string;
          entity_type: string;
          entity_id: string;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string;
          action?: string;
          entity_type?: string;
          entity_id?: string;
          details?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          subscription: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subscription: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subscription?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      unified_bookmarks: {
        Row: {
          id: string;
          user_id: string;
          item_type: string;
          item_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          item_type: string;
          item_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          item_type?: string;
          item_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      webauthn_credentials: {
        Row: {
          id: string;
          user_id: string;
          credential_id: string;
          public_key: string;
          counter: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          credential_id: string;
          public_key: string;
          counter?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          credential_id?: string;
          public_key?: string;
          counter?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      carpools: {
        Row: {
          id: string;
          event_id: string;
          driver_id: string;
          capacity: number;
          departure_time: string;
          meeting_point: string;
          notes: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          driver_id: string;
          capacity: number;
          departure_time: string;
          meeting_point: string;
          notes?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          driver_id?: string;
          capacity?: number;
          departure_time?: string;
          meeting_point?: string;
          notes?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "carpools_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carpools_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      carpool_passengers: {
        Row: {
          id: string;
          carpool_id: string;
          passenger_id: string;
          seat_claimed_at: string;
        };
        Insert: {
          id?: string;
          carpool_id: string;
          passenger_id: string;
          seat_claimed_at?: string;
        };
        Update: {
          id?: string;
          carpool_id?: string;
          passenger_id?: string;
          seat_claimed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "carpool_passengers_carpool_id_fkey";
            columns: ["carpool_id"];
            isOneToOne: false;
            referencedRelation: "carpools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carpool_passengers_passenger_id_fkey";
            columns: ["passenger_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      carpool_chats: {
        Row: {
          id: string;
          carpool_id: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          carpool_id: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          carpool_id?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "carpool_chats_carpool_id_fkey";
            columns: ["carpool_id"];
            isOneToOne: false;
            referencedRelation: "carpools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carpool_chats_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      carpool_chat_messages: {
        Row: {
          id: string;
          carpool_chat_id: string;
          sender_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          carpool_chat_id: string;
          sender_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          carpool_chat_id?: string;
          sender_id?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "carpool_chat_messages_carpool_chat_id_fkey";
            columns: ["carpool_chat_id"];
            isOneToOne: false;
            referencedRelation: "carpool_chats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carpool_chat_messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      club_analytics_view: {
        Row: {
          id: string;
          club_id: string;
          member_count: number;
          total_events: number;
          total_posts: number;
          total_rsvps: number;
          created_at: string;
        };
        Relationships: [];
      };
      trending_posts: {
        Row: {
          id: string;
          club_id: string;
          author_id: string;
          title: string | null;
          content: string;
          image_url: string | null;
          blurhash: string | null;
          is_pinned: boolean;
          is_deleted: boolean;
          like_count: number;
          created_at: string;
          updated_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      check_in_via_geofence: {
        Args: {
          p_rsvp_id: string;
          p_latitude: number;
          p_longitude: number;
          p_accuracy_meters?: number | null;
        };
        Returns: Json;
      };
      get_event_analytics: {
        Args: {
          p_event_id: string;
        };
        Returns: Json;
      };
      get_trending_events: {
        Args: {
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Json;
      };
      get_events_nearby: {
        Args: {
          user_lat: number;
          user_lng: number;
          radius_meters?: number;
        };
        Returns: Json;
      };
      increment_event_views: {
        Args: {
          p_event_id: string;
        };
        Returns: void;
      };
      get_event_popularity_score: {
        Args: {
          p_event_id: string;
          p_event_date?: string | null;
          p_rsvp_count?: number;
          p_views?: number;
        };
        Returns: number;
      };
      search_events_advanced: {
        Args: {
          query_string: string;
        };
        Returns: Json;
      };
      get_system_counts: {
        Args: Record<string, unknown>;
        Returns: Json;
      };
      get_collaborative_recommendations: {
        Args: {
          p_user_id: string;
          p_limit?: number;
        };
        Returns: Json;
      };
      get_dau_analytics: {
        Args: {
          start_date?: string;
          end_date?: string;
        };
        Returns: Json;
      };
      get_comment_thread: {
        Args: {
          p_post_id?: string;
          p_article_id?: string;
        };
        Returns: Json;
      };
      get_posts_relay: {
        Args: Record<string, unknown>;
        Returns: Json;
      };
      get_posts_cursor: {
        Args: Record<string, unknown>;
        Returns: Json;
      };
      recommend_events: {
        Args: {
          p_event_id?: string;
          user_id?: string;
          p_limit?: number;
        };
        Returns: Json;
      };
      search_clubs: {
        Args: {
          search_term: string;
        };
        Returns: Json;
      };
      moderate_club_registration: {
        Args: {
          p_club_id: string;
          p_action: string;
        };
        Returns: Json;
      };
      is_carpool_member: {
        Args: {
          p_carpool_id: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      offer_carpool: {
        Args: {
          p_event_id: string;
          p_capacity: number;
          p_departure_time: string;
          p_meeting_point: string;
          p_notes?: string;
        };
        Returns: Json;
      };
      claim_carpool_seat: {
        Args: {
          p_carpool_id: string;
        };
        Returns: Json;
      };
      leave_carpool: {
        Args: {
          p_carpool_id: string;
        };
        Returns: Json;
      };
      cancel_carpool: {
        Args: {
          p_carpool_id: string;
        };
        Returns: Json;
      };
      reserve_seat: {
        Args: {
          p_event_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      user_role: "student" | "admin" | "faculty" | "owner" | "system_admin";
      club_visibility: "public" | "private" | "unlisted";
      event_status:
        | "upcoming"
        | "ongoing"
        | "completed"
        | "cancelled"
        | "published"
        | "active"
        | "draft"
        | "expired"
        | "archived";
      rsvp_status:
        "going" | "maybe" | "cancelled" | "waitlist" | "approved" | "rejected" | "waitlisted";
      task_status: "todo" | "in_progress" | "done";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ── Type Helper Shortcuts ──

export type Tables<
  PublicTableNameOrOptions extends
    keyof (Database["public"]["Tables"] & Database["public"]["Views"]) | { schema: keyof Database },
  TableName extends (PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends keyof Database["public"]["Tables"] | { schema: keyof Database },
  TableName extends (PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof Database["public"]["Tables"] | { schema: keyof Database },
  TableName extends (PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends keyof Database["public"]["Enums"] | { schema: keyof Database },
  EnumName extends (PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never;
