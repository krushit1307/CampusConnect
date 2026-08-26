export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      club_documents: {
        Row: {
          id: string;
          club_id: string;
          file_url: string;
          version_number: number;
          uploaded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          file_url: string;
          version_number: number;
          uploaded_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          file_url?: string;
          version_number?: number;
          uploaded_by?: string;
          created_at?: string;
        };
      };
      club_transactions: {
        Row: {
          id: string;
          club_id: string;
          amount: number;
          transaction_type: "INCOME" | "EXPENSE";
          category: string;
          description: string;
          receipt_url: string | null;
          funding_request_id: string | null;
          co_sponsor_id: string | null;
          event_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          amount: number;
          transaction_type: "INCOME" | "EXPENSE";
          category: string;
          description: string;
          receipt_url?: string | null;
          funding_request_id?: string | null;
          co_sponsor_id?: string | null;
          event_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          amount?: number;
          transaction_type?: "INCOME" | "EXPENSE";
          category?: string;
          description?: string;
          receipt_url?: string | null;
          funding_request_id?: string | null;
          co_sponsor_id?: string | null;
          event_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_transactions_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "club_transactions_co_sponsor_id_fkey";
            columns: ["co_sponsor_id"];
            isOneToOne: false;
            referencedRelation: "co_sponsors";
            referencedColumns: ["id"];
          },
        ];
      };
      co_sponsors: {
        Row: {
          id: string;
          event_id: string;
          club_id: string;
          requested_by: string;
          contribution_amount: number;
          status: "pending" | "approved" | "rejected" | "refunded";
          approved_by: string | null;
          approved_at: string | null;
          refunded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          club_id: string;
          requested_by: string;
          contribution_amount: number;
          status?: "pending" | "approved" | "rejected" | "refunded";
          approved_by?: string | null;
          approved_at?: string | null;
          refunded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          club_id?: string;
          requested_by?: string;
          contribution_amount?: number;
          status?: "pending" | "approved" | "rejected" | "refunded";
          approved_by?: string | null;
          approved_at?: string | null;
          refunded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "co_sponsors_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "co_sponsors_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      event_escrow_ledger: {
        Row: {
          id: string;
          event_id: string;
          co_sponsor_id: string;
          club_id: string;
          amount: number;
          entry_type: "deposit" | "refund";
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          co_sponsor_id: string;
          club_id: string;
          amount: number;
          entry_type: "deposit" | "refund";
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          co_sponsor_id?: string;
          club_id?: string;
          amount?: number;
          entry_type?: "deposit" | "refund";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_escrow_ledger_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_escrow_ledger_co_sponsor_id_fkey";
            columns: ["co_sponsor_id"];
            isOneToOne: false;
            referencedRelation: "co_sponsors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_escrow_ledger_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      constitution_documents: {
        Row: {
          id: string;
          club_id: string;
          uploaded_by: string;
          file_url: string;
          raw_text: string | null;
          status: "pending_review" | "approved" | "rejected" | "requires_revision";
          overall_risk_score: number;
          plagiarism_score: number;
          plagiarism_review_required: boolean;
          plagiarism_matches: Json;
          plagiarism_scanned_at: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          uploaded_by: string;
          file_url: string;
          raw_text?: string | null;
          status?: "pending_review" | "approved" | "rejected" | "requires_revision";
          overall_risk_score?: number;
          plagiarism_score?: number;
          plagiarism_review_required?: boolean;
          plagiarism_matches?: Json;
          plagiarism_scanned_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          uploaded_by?: string;
          file_url?: string;
          raw_text?: string | null;
          status?: "pending_review" | "approved" | "rejected" | "requires_revision";
          overall_risk_score?: number;
          plagiarism_score?: number;
          plagiarism_review_required?: boolean;
          plagiarism_matches?: Json;
          plagiarism_scanned_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "constitution_documents_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "constitution_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      constitution_violations: {
        Row: {
          id: string;
          document_id: string;
          clause_reference: string | null;
          quote: string;
          reason: string;
          severity: "info" | "warning" | "severe";
          is_resolved: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          clause_reference?: string | null;
          quote: string;
          reason: string;
          severity?: "info" | "warning" | "severe";
          is_resolved?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          clause_reference?: string | null;
          quote?: string;
          reason?: string;
          severity?: "info" | "warning" | "severe";
          is_resolved?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "constitution_violations_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "constitution_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      constitution_signatures: {
        Row: {
          id: string;
          club_id: string;
          user_id: string;
          constitution_version: number;
          legal_name: string;
          signed_at: string;
          ip_address: string;
          signature_hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          user_id: string;
          constitution_version: number;
          legal_name: string;
          signed_at?: string;
          ip_address: string;
          signature_hash: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          user_id?: string;
          constitution_version?: number;
          legal_name?: string;
          signed_at?: string;
          ip_address?: string;
          signature_hash?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "constitution_signatures_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "constitution_signatures_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
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
          widgets_config: Json | null;
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
          widgets_config?: Json | null;
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
          widgets_config?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      club_roles: {
        Row: {
          id: string;
          club_id: string;
          title: string;
          permissions_level: number;
          is_singular: boolean;
          created_at: string;
          signed_bylaws_at: string | null;
          signature_hash: string | null;
          bylaws_version_signed: number | null;
          signed_ip: string | null;
          reports_to_user_id: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          title: string;
          permissions_level?: number;
          is_singular?: boolean;
          created_at?: string;
          signed_bylaws_at?: string | null;
          signature_hash?: string | null;
          bylaws_version_signed?: number | null;
          signed_ip?: string | null;
          reports_to_user_id?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          title?: string;
          permissions_level?: number;
          is_singular?: boolean;
          created_at?: string;
          signed_bylaws_at?: string | null;
          signature_hash?: string | null;
          bylaws_version_signed?: number | null;
          signed_ip?: string | null;
          reports_to_user_id?: string | null;
        };
        Relationships: [];
      };
      merch_items: {
        Row: {
          id: string;
          club_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merch_items_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      merch_variants: {
        Row: {
          id: string;
          merch_item_id: string;
          name: string;
          stock: number;
          price: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merch_item_id: string;
          name: string;
          stock?: number;
          price?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merch_item_id?: string;
          name?: string;
          stock?: number;
          price?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merch_variants_merch_item_id_fkey";
            columns: ["merch_item_id"];
            isOneToOne: false;
            referencedRelation: "merch_items";
            referencedColumns: ["id"];
          },
        ];
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
          vendor_portfolio: Json;
          handle: string | null;
          email: string | null;
          college: string | null;
          phone_number: string | null;
          preferred_currency: string;
          linkedin_url: string | null;
          role: "student" | "admin" | "faculty" | "owner" | "system_admin";
          skills: string[] | null;
          course_codes: string[];
          dietary_restrictions?: string[] | null;
          dietary_restrictions: string[] | null;
          notification_preferences: Json | null;
          is_banned: boolean;
          strike_count: number;
          show_on_leaderboard: boolean;
          carpool_driver_rating: number | null;
          carpool_driver_rating_count: number;
          is_carpool_driver_blocked: boolean;
          carpool_driver_blocked_reason: string | null;
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
          vendor_portfolio?: Json;
          handle?: string | null;
          email?: string | null;
          college?: string | null;
          phone_number?: string | null;
          preferred_currency?: string;
          linkedin_url?: string | null;
          role?: "student" | "admin" | "faculty" | "owner" | "system_admin";
          skills?: string[] | null;
          course_codes?: string[];
          notification_preferences?: Json | null;
          is_banned?: boolean;
          strike_count?: number;
          show_on_leaderboard?: boolean;
          carpool_driver_rating?: number | null;
          carpool_driver_rating_count?: number;
          is_carpool_driver_blocked?: boolean;
          carpool_driver_blocked_reason?: string | null;
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
          vendor_portfolio?: Json;
          handle?: string | null;
          email?: string | null;
          college?: string | null;
          phone_number?: string | null;
          preferred_currency?: string;
          linkedin_url?: string | null;
          role?: "student" | "admin" | "faculty" | "owner" | "system_admin";
          skills?: string[] | null;
          course_codes?: string[];
          notification_preferences?: Json | null;
          is_banned?: boolean;
          strike_count?: number;
          show_on_leaderboard?: boolean;
          carpool_driver_rating?: number | null;
          carpool_driver_rating_count?: number;
          is_carpool_driver_blocked?: boolean;
          carpool_driver_blocked_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vendor_rfps: {
        Row: {
          id: string;
          club_id: string;
          event_id: string | null;
          title: string;
          category: string;
          description: string;
          budget_max: number;
          deadline: string;
          status: string;
          accepted_bid_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          event_id?: string | null;
          title: string;
          category: string;
          description: string;
          budget_max: number;
          deadline: string;
          status?: string | null;
          accepted_bid_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          event_id?: string | null;
          title?: string;
          category?: string;
          description?: string;
          budget_max?: number;
          deadline?: string;
          status?: string | null;
          accepted_bid_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      rfp_bids: {
        Row: {
          id: string;
          rfp_id: string;
          vendor_user_id: string | null;
          vendor_name: string;
          vendor_email: string;
          quoted_price: number;
          proposal_pdf_url: string | null;
          notes: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          rfp_id: string;
          vendor_user_id?: string | null;
          vendor_name: string;
          vendor_email: string;
          quoted_price: number;
          proposal_pdf_url?: string | null;
          notes?: string | null;
          status?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          rfp_id?: string;
          vendor_user_id?: string | null;
          vendor_name?: string;
          vendor_email?: string;
          quoted_price?: number;
          proposal_pdf_url?: string | null;
          notes?: string | null;
          status?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      vendor_portfolio_reviews: {
        Row: {
          id: string;
          vendor_user_id: string;
          rfp_bid_id: string;
          event_id: string | null;
          reviewer_user_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vendor_user_id: string;
          rfp_bid_id: string;
          event_id?: string | null;
          reviewer_user_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          vendor_user_id?: string;
          rfp_bid_id?: string;
          event_id?: string | null;
          reviewer_user_id?: string;
          rating?: number;
          comment?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      currency_exchange_rates: {
        Row: {
          id: string;
          base_currency: string;
          quote_currency: string;
          rate: number;
          rate_date: string;
          cache_date: string;
          provider: string;
          fetched_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          base_currency?: string;
          quote_currency: string;
          rate: number;
          rate_date: string;
          cache_date?: string;
          provider?: string;
          fetched_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          base_currency?: string;
          quote_currency?: string;
          rate?: number;
          rate_date?: string;
          cache_date?: string;
          provider?: string;
          fetched_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      micro_events: {
        Row: {
          id: string;
          user_id: string;
          course_code: string;
          location: string;
          max_capacity: number;
          created_at: string;
          expires_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          course_code: string;
          location: string;
          max_capacity?: number;
          created_at?: string;
          expires_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          course_code?: string;
          location?: string;
          max_capacity?: number;
          created_at?: string;
          expires_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      micro_event_participants: {
        Row: { micro_event_id: string; user_id: string; joined_at: string };
        Insert: { micro_event_id: string; user_id: string; joined_at?: string };
        Update: { micro_event_id?: string; user_id?: string; joined_at?: string };
        Relationships: [];
      };
      event_seats: {
        Row: {
          id: string;
          event_id: string;
          seat_id: string;
          seat_label: string;
          section: string;
          status: string;
          reserved_by_user_id: string | null;
          rsvp_id: string | null;
          locked_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          seat_id: string;
          seat_label: string;
          section?: string;
          status?: string;
          reserved_by_user_id?: string | null;
          rsvp_id?: string | null;
          locked_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          seat_id?: string;
          seat_label?: string;
          section?: string;
          status?: string;
          reserved_by_user_id?: string | null;
          rsvp_id?: string | null;
          locked_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_song_requests: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          song_title: string;
          artist: string;
          album_art_url: string | null;
          upvotes: number;
          played: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          song_title: string;
          artist: string;
          album_art_url?: string | null;
          upvotes?: number;
          played?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          song_title?: string;
          artist?: string;
          album_art_url?: string | null;
          upvotes?: number;
          played?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      event_song_request_upvotes: {
        Row: { request_id: string; user_id: string; created_at: string };
        Insert: { request_id: string; user_id: string; created_at?: string };
        Update: { request_id?: string; user_id?: string; created_at?: string };
        Relationships: [];
      };
      event_caterer_contracts: {
        Row: {
          id: string;
          event_id: string;
          caterer_name: string;
          caterer_email: string;
          caterer_phone: string | null;
          rfp_finalized_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          caterer_name: string;
          caterer_email: string;
          caterer_phone?: string | null;
          rfp_finalized_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          caterer_name?: string;
          caterer_email?: string;
          caterer_phone?: string | null;
          rfp_finalized_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      caterer_dietary_alerts: {
        Row: {
          id: string;
          event_id: string;
          user_id: string | null;
          attendee_name: string;
          dietary_tag: string;
          severity_level: string;
          caterer_email: string;
          caterer_phone: string | null;
          token: string;
          alert_sent_at: string;
          acknowledgment_status: string;
          acknowledged_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id?: string | null;
          attendee_name: string;
          dietary_tag: string;
          severity_level?: string;
          caterer_email: string;
          caterer_phone?: string | null;
          token?: string;
          alert_sent_at?: string;
          acknowledgment_status?: string;
          acknowledged_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string | null;
          attendee_name?: string;
          dietary_tag?: string;
          severity_level?: string;
          caterer_email?: string;
          caterer_phone?: string | null;
          token?: string;
          alert_sent_at?: string;
          acknowledgment_status?: string;
          acknowledged_at?: string | null;
          created_at?: string;
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
          timezone?: string | null;
          dnd_start_time?: string | null;
          dnd_end_time?: string | null;
          quiet_hours_start?: string | null;
          quiet_hours_end?: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email_alerts?: boolean;
          push_notifications?: boolean;
          digest?: boolean;
          dark_mode_default?: boolean;
          timezone?: string | null;
          dnd_start_time?: string | null;
          dnd_end_time?: string | null;
          quiet_hours_start?: string | null;
          quiet_hours_end?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          email_alerts?: boolean;
          push_notifications?: boolean;
          digest?: boolean;
          dark_mode_default?: boolean;
          timezone?: string | null;
          dnd_start_time?: string | null;
          dnd_end_time?: string | null;
          quiet_hours_start?: string | null;
          quiet_hours_end?: string | null;
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
      event_announcements: {
        Row: {
          id: string;
          event_id: string;
          message: string;
          priority: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          message: string;
          priority?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          message?: string;
          priority?: string;
          created_at?: string;
        };
      };
      cross_club_matches: {
        Row: {
          id: string;
          draft_a_id: string;
          draft_b_id: string;
          club_a_id: string;
          club_b_id: string;
          club_a_name: string;
          club_b_name: string;
          similarity_score: number;
          status: string;
          draft_a_budget: number;
          draft_b_budget: number;
          pooled_budget: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          draft_a_id: string;
          draft_b_id: string;
          club_a_id: string;
          club_b_id: string;
          club_a_name: string;
          club_b_name: string;
          similarity_score?: number;
          status?: string;
          draft_a_budget?: number;
          draft_b_budget?: number;
          pooled_budget?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          draft_a_id?: string;
          draft_b_id?: string;
          club_a_id?: string;
          club_b_id?: string;
          club_a_name?: string;
          club_b_name?: string;
          similarity_score?: number;
          status?: string;
          draft_a_budget?: number;
          draft_b_budget?: number;
          pooled_budget?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      registrar_sync_logs: {
        Row: {
          id: string;
          user_id: string;
          student_id: string;
          user_full_name: string;
          previous_status: string;
          new_status: string;
          action_taken: string;
          clubs_notified_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          student_id: string;
          user_full_name: string;
          previous_status?: string;
          new_status: string;
          action_taken?: string;
          clubs_notified_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          student_id?: string;
          user_full_name?: string;
          previous_status?: string;
          new_status?: string;
          action_taken?: string;
          clubs_notified_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      ticket_claim_attempts: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          ip_hash: string;
          device_fingerprint_hash: string | null;
          idempotency_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          ip_hash: string;
          device_fingerprint_hash?: string | null;
          idempotency_key?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          ip_hash?: string;
          device_fingerprint_hash?: string | null;
          idempotency_key?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_claim_attempts_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_claim_attempts_user_id_fkey";
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
          is_outdoor: boolean;
          backup_indoor_venue: string | null;
          location_lat: number | null;
          location_lon: number | null;
          has_photography: boolean;
          is_high_demand: boolean;

          location: any;
          metadata: Json | null;
          refund_policy: Json | null;
          latitude: number | null;
          longitude: number | null;
          geofencing_enabled: boolean;
          geofence_radius_meters: number;
          max_attendees: number | null;
          waitlist_capacity: number | null;
          waitlist_count: number | null;
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
            | "archived"
            | "pending_spam_review"
            | "pending_risk_review"
            | "rejected";
          spam_similarity: number | null;
          spam_reason: string | null;
          spam_original_status: string | null;
          spam_reviewed_at: string | null;
          spam_reviewed_by: string | null;
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
          is_outdoor?: boolean;
          backup_indoor_venue?: string | null;
          location_lat?: number | null;
          location_lon?: number | null;
          has_photography?: boolean;
          is_high_demand?: boolean;

          location?: any;
          metadata?: Json | null;
          latitude?: number | null;
          longitude?: number | null;
          geofencing_enabled?: boolean;
          geofence_radius_meters?: number;
          max_attendees?: number | null;
          waitlist_capacity?: number | null;
          waitlist_count?: number | null;
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
            | "archived"
            | "pending_spam_review"
            | "pending_risk_review"
            | "rejected";
          spam_similarity?: number | null;
          spam_reason?: string | null;
          spam_original_status?: string | null;
          spam_reviewed_at?: string | null;
          spam_reviewed_by?: string | null;
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
          is_outdoor?: boolean;
          backup_indoor_venue?: string | null;
          location_lat?: number | null;
          location_lon?: number | null;
          has_photography?: boolean;
          is_high_demand?: boolean;

          location?: any;
          metadata?: Json | null;
          latitude?: number | null;
          longitude?: number | null;
          geofencing_enabled?: boolean;
          geofence_radius_meters?: number;
          max_attendees?: number | null;
          waitlist_capacity?: number | null;
          waitlist_count?: number | null;
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
            | "archived"
            | "pending_spam_review"
            | "pending_risk_review"
            | "rejected";
          spam_similarity?: number | null;
          spam_reason?: string | null;
          spam_original_status?: string | null;
          spam_reviewed_at?: string | null;
          spam_reviewed_by?: string | null;
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
      event_traffic_events: {
        Row: {
          id: number;
          event_type: "event_view" | "event_click";
          event_id: string;
          category_id: string | null;
          user_id: string | null;
          occurred_at: string;
        };
        Insert: {
          id?: never;
          event_type: "event_view" | "event_click";
          event_id: string;
          category_id?: string | null;
          user_id?: string | null;
          occurred_at?: string;
        };
        Update: {
          id?: never;
          event_type?: "event_view" | "event_click";
          event_id?: string;
          category_id?: string | null;
          user_id?: string | null;
          occurred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_traffic_events_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_traffic_events_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "event_categories";
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
          no_media_consent: boolean;
          dietary_restrictions?: string[] | null;
          dietary_restrictions: string[] | null;
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
          no_media_consent?: boolean;
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
          no_media_consent?: boolean;
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
      event_feedback_safety_alerts: {
        Row: {
          id: string;
          event_id: string;
          feedback_id: string | null;
          raw_feedback: string;
          detection_source: "llm_marker" | "deterministic_safety_language" | "both";
          llm_output: string | null;
          status: "open" | "acknowledged" | "resolved";
          sms_sent_at: string | null;
          email_sent_at: string | null;
          last_delivery_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          feedback_id?: string | null;
          raw_feedback: string;
          detection_source: "llm_marker" | "deterministic_safety_language" | "both";
          llm_output?: string | null;
          status?: "open" | "acknowledged" | "resolved";
          sms_sent_at?: string | null;
          email_sent_at?: string | null;
          last_delivery_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          feedback_id?: string | null;
          raw_feedback?: string;
          detection_source?: "llm_marker" | "deterministic_safety_language" | "both";
          llm_output?: string | null;
          status?: "open" | "acknowledged" | "resolved";
          sms_sent_at?: string | null;
          email_sent_at?: string | null;
          last_delivery_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_feedback_safety_alerts_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_feedback_safety_alerts_feedback_id_fkey";
            columns: ["feedback_id"];
            isOneToOne: true;
            referencedRelation: "event_feedback";
            referencedColumns: ["id"];
          },
        ];
      };
      event_broadcast_sessions: {
        Row: {
          id: string;
          event_id: string;
          presenter_user_id: string | null;
          primary_stream_url: string | null;
          fallback_slate_url: string;
          active_source: "primary" | "fallback";
          state: "primary" | "fallback" | "recovering" | "ended";
          connection_state: "connected" | "disconnected" | "failed" | "checking";
          failure_reason: string | null;
          last_heartbeat_at: string | null;
          fallback_activated_at: string | null;
          recovered_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          presenter_user_id?: string | null;
          primary_stream_url?: string | null;
          fallback_slate_url?: string;
          active_source?: "primary" | "fallback";
          state?: "primary" | "fallback" | "recovering" | "ended";
          connection_state?: "connected" | "disconnected" | "failed" | "checking";
          failure_reason?: string | null;
          last_heartbeat_at?: string | null;
          fallback_activated_at?: string | null;
          recovered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          presenter_user_id?: string | null;
          primary_stream_url?: string | null;
          fallback_slate_url?: string;
          active_source?: "primary" | "fallback";
          state?: "primary" | "fallback" | "recovering" | "ended";
          connection_state?: "connected" | "disconnected" | "failed" | "checking";
          failure_reason?: string | null;
          last_heartbeat_at?: string | null;
          fallback_activated_at?: string | null;
          recovered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_broadcast_health_events: {
        Row: {
          id: string;
          session_id: string;
          event_id: string;
          connection_state: "connected" | "disconnected" | "failed" | "checking";
          requested_source: "primary" | "fallback";
          av_check_passed: boolean;
          provider_switch_status: "pending" | "succeeded" | "failed" | "not_configured";
          provider_error: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          event_id: string;
          connection_state: "connected" | "disconnected" | "failed" | "checking";
          requested_source: "primary" | "fallback";
          av_check_passed?: boolean;
          provider_switch_status?: "pending" | "succeeded" | "failed" | "not_configured";
          provider_error?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          event_id?: string;
          connection_state?: "connected" | "disconnected" | "failed" | "checking";
          requested_source?: "primary" | "fallback";
          av_check_passed?: boolean;
          provider_switch_status?: "pending" | "succeeded" | "failed" | "not_configured";
          provider_error?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      event_presenter_pings: {
        Row: {
          id: string;
          event_id: string;
          presenter_user_id: string | null;
          pinged_by: string | null;
          ping_id: string;
          status: "pinged" | "confirmed_ready" | "awol";
          timeout_seconds: number;
          response_time_ms: number | null;
          sent_at: string;
          responded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          presenter_user_id?: string | null;
          pinged_by?: string | null;
          ping_id: string;
          status?: "pinged" | "confirmed_ready" | "awol";
          timeout_seconds?: number;
          response_time_ms?: number | null;
          sent_at?: string;
          responded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          presenter_user_id?: string | null;
          pinged_by?: string | null;
          ping_id?: string;
          status?: "pinged" | "confirmed_ready" | "awol";
          timeout_seconds?: number;
          response_time_ms?: number | null;
          sent_at?: string;
          responded_at?: string | null;
          created_at?: string;
          updated_at?: string;
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
      event_feedback_summaries: {
        Row: {
          id: string;
          event_id: string;
          executive_summary_markdown: string;
          top_positives: Json;
          top_improvements: Json;
          review_count: number;
          generated_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          executive_summary_markdown: string;
          top_positives?: Json;
          top_improvements?: Json;
          review_count?: number;
          generated_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          executive_summary_markdown?: string;
          top_positives?: Json;
          top_improvements?: Json;
          review_count?: number;
          generated_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_feedback_summaries_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: true;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
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
          constitution_ratification_required: boolean;
          termination_reason:
            | "term_completed"
            | "resigned"
            | "impeached"
            | "removed"
            | "role_changed"
            | string
            | null;
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
          constitution_ratification_required?: boolean;
          termination_reason?:
            | "term_completed"
            | "resigned"
            | "impeached"
            | "removed"
            | "role_changed"
            | string
            | null;
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
          constitution_ratification_required?: boolean;
          termination_reason?:
            | "term_completed"
            | "resigned"
            | "impeached"
            | "removed"
            | "role_changed"
            | string
            | null;
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
          message?: string | null;
          payload?: Record<string, any> | null;
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
          message?: string | null;
          payload?: Record<string, any> | null;
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
          message?: string | null;
          payload?: Record<string, any> | null;
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
      user_availability: {
        Row: {
          user_id: string;
          day_of_week: number;
          slot_index: number;
          is_available: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          day_of_week: number;
          slot_index: number;
          is_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          day_of_week?: number;
          slot_index?: number;
          is_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_availability_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
      carpool_driver_ratings: {
        Row: {
          id: string;
          vehicle_id: string;
          driver_user_id: string;
          rider_user_id: string;
          rating: number;
          feedback: string | null;
          safety_tags: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          driver_user_id: string;
          rider_user_id: string;
          rating: number;
          feedback?: string | null;
          safety_tags?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          driver_user_id?: string;
          rider_user_id?: string;
          rating?: number;
          feedback?: string | null;
          safety_tags?: string[];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "carpool_driver_ratings_driver_user_id_fkey";
            columns: ["driver_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carpool_driver_ratings_rider_user_id_fkey";
            columns: ["rider_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      venue_maps: {
        Row: {
          id: string;
          event_id: string;
          background_image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          background_image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          background_image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "venue_maps_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: true;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      map_nodes: {
        Row: {
          id: string;
          map_id: string;
          entity_name: string | null;
          type:
            | "table"
            | "stage"
            | "boundary"
            | "booth"
            | "sponsor"
            | "entrance"
            | "elevator"
            | "ramp"
            | "restroom";
          x_coord: number;
          y_coord: number;
          width: number;
          height: number;
          rotation: number;
          accessibility_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          map_id: string;
          entity_name?: string | null;
          type:
            | "table"
            | "stage"
            | "boundary"
            | "booth"
            | "sponsor"
            | "entrance"
            | "elevator"
            | "ramp"
            | "restroom";
          x_coord: number;
          y_coord: number;
          width: number;
          height: number;
          rotation?: number;
          accessibility_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          map_id?: string;
          entity_name?: string | null;
          type?:
            | "table"
            | "stage"
            | "boundary"
            | "booth"
            | "sponsor"
            | "entrance"
            | "elevator"
            | "ramp"
            | "restroom";
          x_coord?: number;
          y_coord?: number;
          width?: number;
          height?: number;
          rotation?: number;
          accessibility_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "map_nodes_map_id_fkey";
            columns: ["map_id"];
            isOneToOne: false;
            referencedRelation: "venue_maps";
            referencedColumns: ["id"];
          },
        ];
      };
      event_sessions: {
        Row: {
          id: string;
          event_id: string;
          title: string;
          description: string | null;
          track: string;
          location: string | null;
          starts_at: string;
          ends_at: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          title: string;
          description?: string | null;
          track?: string;
          location?: string | null;
          starts_at: string;
          ends_at: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          title?: string;
          description?: string | null;
          track?: string;
          location?: string | null;
          starts_at?: string;
          ends_at?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_sessions_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_sessions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      event_itinerary_items: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_itinerary_items_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_itinerary_items_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "event_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      event_weather_alerts: {
        Row: {
          id: string;
          event_id: string;
          organizer_id: string;
          forecast_time: string;
          condition: string;
          precipitation_probability: number;
          temperature_c: number | null;
          indoor_backup_url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          organizer_id: string;
          forecast_time: string;
          condition: string;
          precipitation_probability?: number;
          temperature_c?: number | null;
          indoor_backup_url: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          organizer_id?: string;
          forecast_time?: string;
          condition?: string;
          precipitation_probability?: number;
          temperature_c?: number | null;
          indoor_backup_url?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_weather_alerts_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_weather_alerts_organizer_id_fkey";
            columns: ["organizer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      crowdfunding_campaigns: {
        Row: {
          id: string;
          club_id: string;
          title: string;
          description: string | null;
          target_amount_cents: number;
          current_amount_cents: number;
          end_date: string | null;
          status: "active" | "completed" | "cancelled";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          title: string;
          description?: string | null;
          target_amount_cents: number;
          current_amount_cents?: number;
          end_date?: string | null;
          status?: "active" | "completed" | "cancelled";
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          title?: string;
          description?: string | null;
          target_amount_cents?: number;
          current_amount_cents?: number;
          end_date?: string | null;
          status?: "active" | "completed" | "cancelled";
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      campaign_donations: {
        Row: {
          id: string;
          campaign_id: string;
          donor_id: string | null;
          display_name: string | null;
          is_anonymous: boolean;
          amount_cents: number;
          currency: string;
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          status: "pending" | "succeeded" | "refunded" | "disputed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          donor_id?: string | null;
          display_name?: string | null;
          is_anonymous?: boolean;
          amount_cents: number;
          currency?: string;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          status?: "pending" | "succeeded" | "refunded" | "disputed";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          donor_id?: string | null;
          display_name?: string | null;
          is_anonymous?: boolean;
          amount_cents?: number;
          currency?: string;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          status?: "pending" | "succeeded" | "refunded" | "disputed";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      campaign_donation_matches: {
        Row: {
          id: string;
          campaign_id: string;
          source_donation_id: string;
          alumni_user_id: string;
          requested_amount_cents: number;
          match_donation_id: string | null;
          status: "invited" | "matched" | "declined" | "expired";
          notification_attempts: number;
          notification_sent_at: string | null;
          created_at: string;
          matched_at: string | null;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          source_donation_id: string;
          alumni_user_id: string;
          requested_amount_cents: number;
          match_donation_id?: string | null;
          status?: "invited" | "matched" | "declined" | "expired";
          notification_attempts?: number;
          notification_sent_at?: string | null;
          created_at?: string;
          matched_at?: string | null;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          source_donation_id?: string;
          alumni_user_id?: string;
          requested_amount_cents?: number;
          match_donation_id?: string | null;
          status?: "invited" | "matched" | "declined" | "expired";
          notification_attempts?: number;
          notification_sent_at?: string | null;
          created_at?: string;
          matched_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_donation_matches_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "crowdfunding_campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_donation_matches_source_donation_id_fkey";
            columns: ["source_donation_id"];
            isOneToOne: false;
            referencedRelation: "campaign_donations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_donation_matches_alumni_user_id_fkey";
            columns: ["alumni_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_donation_matches_match_donation_id_fkey";
            columns: ["match_donation_id"];
            isOneToOne: false;
            referencedRelation: "campaign_donations";
            referencedColumns: ["id"];
          },
        ];
      };
      auction_items: {
        Row: {
          id: string;
          event_id: string | null;
          title: string;
          description: string | null;
          starting_bid: number;
          current_highest_bid: number;
          highest_bidder_id: string | null;
          end_time: string;
          is_closed: boolean;
          created_at: string;
          bid_increment_cents: number;
        };
        Insert: {
          id?: string;
          event_id?: string | null;
          title: string;
          description?: string | null;
          starting_bid?: number;
          current_highest_bid?: number;
          highest_bidder_id?: string | null;
          end_time: string;
          is_closed?: boolean;
          created_at?: string;
          bid_increment_cents?: number;
        };
        Update: {
          id?: string;
          event_id?: string | null;
          title?: string;
          description?: string | null;
          starting_bid?: number;
          current_highest_bid?: number;
          highest_bidder_id?: string | null;
          end_time?: string;
          is_closed?: boolean;
          created_at?: string;
          bid_increment_cents?: number;
        };
        Relationships: [];
      };
      auction_bids: {
        Row: {
          id: string;
          item_id: string | null;
          user_id: string | null;
          bid_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id?: string | null;
          user_id?: string | null;
          bid_amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          item_id?: string | null;
          user_id?: string | null;
          bid_amount?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      auction_winners: {
        Row: {
          id: string;
          item_id: string | null;
          winner_user_id: string | null;
          winning_bid: number;
          stripe_checkout_url: string | null;
          stripe_checkout_session_id: string | null;
          payment_status: string;
          closed_at: string;
        };
        Insert: {
          id?: string;
          item_id?: string | null;
          winner_user_id?: string | null;
          winning_bid: number;
          stripe_checkout_url?: string | null;
          stripe_checkout_session_id?: string | null;
          payment_status?: string;
          closed_at?: string;
        };
        Update: {
          id?: string;
          item_id?: string | null;
          winner_user_id?: string | null;
          winning_bid?: number;
          stripe_checkout_url?: string | null;
          stripe_checkout_session_id?: string | null;
          payment_status?: string;
          closed_at?: string;
        };
        Relationships: [];
      };
      auction_item_updates: {
        Row: {
          id: string;
          item_id: string;
          event_id: string | null;
          current_highest_bid: number;
          end_time: string;
          is_closed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          event_id?: string | null;
          current_highest_bid: number;
          end_time: string;
          is_closed: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          item_id?: string;
          event_id?: string | null;
          current_highest_bid?: number;
          end_time?: string;
          is_closed?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      ticket_tiers: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          price: number;
          capacity: number | null;
          capacity_percentage: number | null;
          is_dynamic_capacity: boolean;
          description: string | null;
          is_early_bird: boolean;
          early_bird_end_date: string | null;
          price_schedule: Json;
          discount_rules: Json;
          start_date: string | null;
          end_date: string | null;
          stripe_price_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          price: number;
          capacity?: number | null;
          capacity_percentage?: number | null;
          is_dynamic_capacity?: boolean;
          description?: string | null;
          is_early_bird?: boolean;
          early_bird_end_date?: string | null;
          price_schedule?: Json;
          discount_rules?: Json;
          start_date?: string | null;
          end_date?: string | null;
          stripe_price_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          name?: string;
          price?: number;
          capacity?: number | null;
          capacity_percentage?: number | null;
          is_dynamic_capacity?: boolean;
          description?: string | null;
          is_early_bird?: boolean;
          early_bird_end_date?: string | null;
          price_schedule?: Json;
          discount_rules?: Json;
          start_date?: string | null;
          end_date?: string | null;
          stripe_price_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      event_flash_sales: {
        Row: {
          id: string;
          event_id: string;
          ticket_tier_id: string | null;
          created_by: string;
          discount_percent: number;
          original_price_cents: number;
          sale_price_cents: number;
          original_stripe_price_id: string | null;
          sale_stripe_price_id: string | null;
          starts_at: string;
          expires_at: string;
          status: "pending" | "active" | "expired" | "cancelled";
          created_at: string;
          updated_at: string;
          notification_sent_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          ticket_tier_id?: string | null;
          created_by: string;
          discount_percent: number;
          original_price_cents: number;
          sale_price_cents: number;
          original_stripe_price_id?: string | null;
          sale_stripe_price_id?: string | null;
          starts_at?: string;
          expires_at: string;
          status?: "pending" | "active" | "expired" | "cancelled";
          created_at?: string;
          updated_at?: string;
          notification_sent_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          ticket_tier_id?: string | null;
          created_by?: string;
          discount_percent?: number;
          original_price_cents?: number;
          sale_price_cents?: number;
          original_stripe_price_id?: string | null;
          sale_stripe_price_id?: string | null;
          starts_at?: string;
          expires_at?: string;
          status?: "pending" | "active" | "expired" | "cancelled";
          created_at?: string;
          updated_at?: string;
          notification_sent_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      auction_item_public_state: {
        Row: {
          id: string;
          event_id: string | null;
          title: string;
          description: string | null;
          starting_bid: number;
          current_highest_bid: number;
          bid_increment_cents: number;
          end_time: string;
          is_closed: boolean;
          created_at: string;
        };
        Relationships: [];
      };
      campaign_match_activity: {
        Row: {
          match_id: string;
          campaign_id: string;
          requested_amount_cents: number;
          created_at: string;
          matched_at: string;
          source_display_name: string;
          alumni_display_name: string;
        };
        Relationships: [];
      };
      campaign_match_invites: {
        Row: {
          match_id: string;
          campaign_id: string;
          requested_amount_cents: number;
          status: "invited";
          created_at: string;
          source_display_name: string;
        };
        Relationships: [];
      };
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
      buddy_matcher_profiles: {
        Row: {
          user_id: string;
          bio: string;
          embedding: string | null;
          top_categories: string[];
          embedding_stale: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          bio: string;
          embedding?: string | null;
          top_categories?: string[];
          embedding_stale?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          bio?: string;
          embedding?: string | null;
          top_categories?: string[];
          embedding_stale?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "buddy_matcher_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      active_event_flash_sales: {
        Row: {
          id: string;
          event_id: string;
          ticket_tier_id: string | null;
          discount_percent: number;
          original_price_cents: number;
          sale_price_cents: number;
          starts_at: string;
          expires_at: string;
          status: "active";
        };
        Relationships: [];
      };
      buddy_waves: {
        Row: {
          id: string;
          sender_id: string;
          receiver_id: string;
          status: string;
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          sender_id: string;
          receiver_id: string;
          status?: string;
          created_at?: string;
          responded_at?: string | null;
        };
        Update: {
          id?: string;
          sender_id?: string;
          receiver_id?: string;
          status?: string;
          created_at?: string;
          responded_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "buddy_waves_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buddy_waves_receiver_id_fkey";
            columns: ["receiver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      peer_listener_verifications: {
        Row: {
          id: string;
          user_id: string;
          major: string;
          academic_year: number;
          status: "pending" | "verified" | "suspended";
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          major: string;
          academic_year: number;
          status?: "pending" | "verified" | "suspended";
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          major?: string;
          academic_year?: number;
          status?: "pending" | "verified" | "suspended";
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_wifi_access_points: {
        Row: {
          id: string;
          event_id: string;
          mac_address: string;
          label: string;
          area_name: string;
          x_ft: number;
          y_ft: number;
          radius_ft: number;
          max_device_capacity: number;
          enabled: boolean;
          last_device_count: number | null;
          last_sampled_at: string | null;
          last_alerted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          mac_address: string;
          label: string;
          area_name: string;
          x_ft: number;
          y_ft: number;
          radius_ft?: number;
          max_device_capacity: number;
          enabled?: boolean;
          last_device_count?: number | null;
          last_sampled_at?: string | null;
          last_alerted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          mac_address?: string;
          label?: string;
          area_name?: string;
          x_ft?: number;
          y_ft?: number;
          radius_ft?: number;
          max_device_capacity?: number;
          enabled?: boolean;
          last_device_count?: number | null;
          last_sampled_at?: string | null;
          last_alerted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_wifi_density_snapshots: {
        Row: {
          id: string;
          access_point_id: string;
          device_count: number;
          sampled_at: string;
          provider: "meraki" | "aruba" | "normalized";
          created_at: string;
        };
        Insert: {
          id?: string;
          access_point_id: string;
          device_count: number;
          sampled_at: string;
          provider: "meraki" | "aruba" | "normalized";
          created_at?: string;
        };
        Update: {
          id?: string;
          access_point_id?: string;
          device_count?: number;
          sampled_at?: string;
          provider?: "meraki" | "aruba" | "normalized";
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      set_club_role_manager: {
        Args: { p_role_id: string; p_reports_to_user_id?: string };
        Returns: Database["public"]["Tables"]["club_roles"]["Row"];
      };
      get_public_club_hierarchy: {
        Args: { p_club_id: string };
        Returns: {
          role_id: string;
          user_id: string;
          reports_to_user_id: string | null;
          full_name: string;
          handle: string;
          avatar_url: string | null;
          role_title: string;
          department: string | null;
          depth: number;
        }[];
      };
      get_club_revenue_forecast: {
        Args: { p_club_id: string; p_event_id: string };
        Returns: Json;
      };
      is_event_organizer: {
        Args: { p_event_id: string; p_user_id?: string };
        Returns: boolean;
      };
      upsert_event_wifi_access_point: {
        Args: {
          p_event_id: string;
          p_access_point_id?: string;
          p_mac_address?: string;
          p_label?: string;
          p_area_name?: string;
          p_x_ft?: number;
          p_y_ft?: number;
          p_radius_ft?: number;
          p_max_device_capacity?: number;
          p_enabled?: boolean;
        };
        Returns: Database["public"]["Tables"]["event_wifi_access_points"]["Row"];
      };
      delete_event_wifi_access_point: {
        Args: { p_access_point_id: string };
        Returns: boolean;
      };
      get_event_capacity_thermal_map: {
        Args: { p_event_id: string };
        Returns: {
          access_point_id: string;
          mac_address: string;
          label: string;
          area_name: string;
          x_ft: number;
          y_ft: number;
          radius_ft: number;
          max_device_capacity: number;
          device_count: number | null;
          sampled_at: string | null;
          over_capacity: boolean;
        }[];
      };
      record_wifi_density_snapshot: {
        Args: {
          p_access_point_id: string;
          p_device_count: number;
          p_sampled_at: string;
          p_provider: "meraki" | "aruba" | "normalized";
        };
        Returns: Database["public"]["Tables"]["event_wifi_density_snapshots"]["Row"];
      };
      mark_wifi_capacity_alerted: {
        Args: { p_access_point_id: string };
        Returns: boolean;
      };
      create_event_flash_sale: {
        Args: {
          p_event_id: string;
          p_discount_percent: number;
          p_duration_minutes: number;
        };
        Returns: Database["public"]["Tables"]["event_flash_sales"]["Row"];
      };
      activate_event_flash_sale: {
        Args: { p_sale_id: string; p_sale_stripe_price_id: string };
        Returns: Database["public"]["Tables"]["event_flash_sales"]["Row"];
      };
      revert_event_flash_sale: {
        Args: { p_sale_id: string };
        Returns: Database["public"]["Tables"]["event_flash_sales"]["Row"] | null;
      };
      queue_flash_sale_notifications: {
        Args: { p_sale_id: string };
        Returns: number;
      };
      get_active_event_flash_sale: {
        Args: { p_event_id: string };
        Returns: {
          id: string;
          event_id: string;
          ticket_tier_id: string | null;
          discount_percent: number;
          original_price_cents: number;
          sale_price_cents: number;
          sale_stripe_price_id: string | null;
          expires_at: string;
        }[];
      };
      place_silent_auction_bid: {
        Args: {
          p_item_id: string;
          p_user_id: string;
          p_bid_amount: number;
        };
        Returns: {
          success: boolean;
          message: string;
          new_highest_bid: number;
          new_end_time: string;
          extended_by_anti_sniping: boolean;
        }[];
      };
      close_silent_auction: {
        Args: { p_item_id: string };
        Returns: {
          success: boolean;
          winner_id: string | null;
          winning_bid: number;
          message: string;
        }[];
      };
      start_event_broadcast_session: {
        Args: {
          p_event_id: string;
          p_presenter_user_id: string;
          p_primary_stream_url?: string | null;
          p_fallback_slate_url?: string;
        };
        Returns: Database["public"]["Tables"]["event_broadcast_sessions"]["Row"];
      };
      report_presenter_av_check: {
        Args: {
          p_session_id: string;
          p_connection_state: "connected" | "disconnected" | "failed" | "checking";
          p_av_check_passed: boolean;
        };
        Returns: Database["public"]["Tables"]["event_broadcast_sessions"]["Row"];
      };
      apply_broadcast_media_signal: {
        Args: {
          p_event_id: string;
          p_connection_state: "connected" | "disconnected" | "failed" | "checking";
          p_av_check_passed?: boolean;
          p_failure_reason?: string | null;
          p_metadata?: Json;
        };
        Returns: Database["public"]["Tables"]["event_broadcast_sessions"]["Row"];
      };
      submit_vendor_rfp_bid: {
        Args: {
          p_rfp_id: string;
          p_vendor_name: string;
          p_vendor_email: string;
          p_quoted_price: number;
          p_proposal_pdf_url?: string | null;
          p_notes?: string | null;
        };
        Returns: Database["public"]["Tables"]["rfp_bids"]["Row"];
      };
      save_vendor_portfolio: {
        Args: { p_portfolio: Json };
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      get_vendor_portfolio_for_bid: {
        Args: { p_bid_id: string };
        Returns: {
          bid_id: string;
          vendor_user_id: string | null;
          vendor_name: string;
          vendor_email: string;
          vendor_portfolio: Json;
          average_rating: number;
          rating_count: number;
        }[];
      };
      submit_vendor_portfolio_review: {
        Args: { p_bid_id: string; p_rating: number; p_comment?: string | null };
        Returns: Database["public"]["Tables"]["vendor_portfolio_reviews"]["Row"];
      };
      is_peer_listener: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      grant_peer_listener_role: {
        Args: {
          p_user_id: string;
          p_major: string;
          p_academic_year: number;
        };
        Returns: Database["public"]["Tables"]["peer_listener_verifications"]["Row"];
      };
      revoke_peer_listener_role: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      get_open_feedback_safety_alerts: {
        Args: Record<string, never>;
        Returns: Database["public"]["Tables"]["event_feedback_safety_alerts"]["Row"][];
      };
      is_feedback_safety_reviewer: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      create_co_sponsor_request: {
        Args: {
          p_event_id: string;
          p_club_id: string;
          p_contribution_amount: number;
        };
        Returns: Json;
      };
      respond_to_co_sponsor_request: {
        Args: {
          p_request_id: string;
          p_approved: boolean;
        };
        Returns: Json;
      };
      enforce_ticket_claim_rate_limit: {
        Args: {
          p_event_id: string;
          p_user_id: string;
          p_ip_address: string;
          p_device_fingerprint?: string | null;
          p_idempotency_key?: string | null;
          p_hash_secret?: string | null;
          p_window_seconds?: number;
          p_max_claims?: number;
        };
        Returns: Json;
      };
      create_campaign_donation_matches: {
        Args: {
          p_donation_id: string;
          p_pool_size?: number;
        };
        Returns: {
          match_id: string;
          alumni_user_id: string;
          requested_amount_cents: number;
        }[];
      };
      get_campaign_match_invitation: {
        Args: { p_match_id: string };
        Returns: {
          campaign_id: string;
          requested_amount_cents: number;
          source_display_name: string;
        }[];
      };
      get_campaign_match_notifications: {
        Args: { p_donation_id: string };
        Returns: {
          match_id: string;
          campaign_title: string;
          club_name: string;
          club_slug: string;
          recipient_email: string;
          recipient_name: string;
          source_amount_cents: number;
          requested_amount_cents: number;
          source_display_name: string;
        }[];
      };
      link_campaign_donation_match: {
        Args: { p_match_id: string; p_donation_id: string };
        Returns: undefined;
      };
      record_campaign_match_notification: {
        Args: { p_match_id: string; p_delivered: boolean };
        Returns: undefined;
      };
      check_in_via_geofence: {
        Args: {
          p_rsvp_id: string;
          p_latitude: number;
          p_longitude: number;
          p_accuracy_meters?: number | null;
        };
        Returns: Json;
      };
      create_micro_event: {
        Args: { p_course_code: string; p_location: string; p_max_capacity?: number };
        Returns: Json;
      };
      join_micro_event: { Args: { p_micro_event_id: string }; Returns: undefined };
      leave_micro_event: { Args: { p_micro_event_id: string }; Returns: undefined };
      archive_micro_event: { Args: { p_micro_event_id: string }; Returns: undefined };
      get_matching_micro_events: { Args: Record<string, never>; Returns: Json };
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
      record_event_traffic: {
        Args: {
          p_event_id: string;
          p_event_type?: string;
        };
        Returns: undefined;
      };
      get_event_traffic_heatmap: {
        Args: {
          p_start_date?: string | null;
          p_end_date?: string | null;
        };
        Returns: {
          category_id: string | null;
          category_name: string;
          hour_of_day: number;
          traffic_count: number;
          unique_viewers: number;
        }[];
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
      global_search: {
        Args: {
          p_query: string;
        };
        Returns: Json;
      };
      submit_venue_wifi_report: {
        Args: {
          p_venue_id: string;
          p_download_speed_mbps: number;
          p_device_count?: number | null;
          p_upload_speed_mbps?: number | null;
          p_latency_ms?: number | null;
          p_notes?: string | null;
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
      user_role: "student" | "admin" | "faculty" | "owner" | "system_admin" | "peer_listener";
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
