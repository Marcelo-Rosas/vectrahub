export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.15';
  };
  public: {
    Tables: {
      ai_budget_config: {
        Row: {
          description: string | null;
          id: string;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: number;
        };
        Insert: {
          description?: string | null;
          id?: string;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: number;
        };
        Update: {
          description?: string | null;
          id?: string;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_budget_config_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      ai_insights: {
        Row: {
          analysis: Json;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          expires_at: string | null;
          id: string;
          insight_type: string;
          summary_text: string;
          user_feedback: string | null;
          user_rating: number | null;
        };
        Insert: {
          analysis: Json;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          expires_at?: string | null;
          id?: string;
          insight_type: string;
          summary_text: string;
          user_feedback?: string | null;
          user_rating?: number | null;
        };
        Update: {
          analysis?: Json;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          expires_at?: string | null;
          id?: string;
          insight_type?: string;
          summary_text?: string;
          user_feedback?: string | null;
          user_rating?: number | null;
        };
        Relationships: [];
      };
      ai_usage_tracking: {
        Row: {
          analysis_type: string;
          cache_creation_tokens: number;
          cache_read_tokens: number;
          created_at: string;
          duration_ms: number | null;
          entity_id: string | null;
          entity_type: string | null;
          error_message: string | null;
          estimated_cost_usd: number;
          id: string;
          input_tokens: number;
          model_used: string;
          output_tokens: number;
          status: string;
        };
        Insert: {
          analysis_type: string;
          cache_creation_tokens?: number;
          cache_read_tokens?: number;
          created_at?: string;
          duration_ms?: number | null;
          entity_id?: string | null;
          entity_type?: string | null;
          error_message?: string | null;
          estimated_cost_usd?: number;
          id?: string;
          input_tokens?: number;
          model_used: string;
          output_tokens?: number;
          status?: string;
        };
        Update: {
          analysis_type?: string;
          cache_creation_tokens?: number;
          cache_read_tokens?: number;
          created_at?: string;
          duration_ms?: number | null;
          entity_id?: string | null;
          entity_type?: string | null;
          error_message?: string | null;
          estimated_cost_usd?: number;
          id?: string;
          input_tokens?: number;
          model_used?: string;
          output_tokens?: number;
          status?: string;
        };
        Relationships: [];
      };
      antt_floor_rates: {
        Row: {
          axes_count: number;
          cargo_type: string;
          cc: number;
          ccd: number;
          created_at: string;
          created_by: string | null;
          id: string;
          operation_table: string;
          updated_at: string;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          axes_count: number;
          cargo_type: string;
          cc: number;
          ccd: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          operation_table: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          axes_count?: number;
          cargo_type?: string;
          cc?: number;
          ccd?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          operation_table?: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [];
      };
      antt_violation_alerts: {
        Row: {
          current_value: number;
          detected_at: string;
          gap: number | null;
          id: string;
          piso: number;
          quote_id: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          stage: string;
        };
        Insert: {
          current_value: number;
          detected_at?: string;
          gap?: number | null;
          id?: string;
          piso: number;
          quote_id: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          stage: string;
        };
        Update: {
          current_value?: number;
          detected_at?: string;
          gap?: number | null;
          id?: string;
          piso?: number;
          quote_id?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          stage?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'antt_violation_alerts_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'antt_violation_alerts_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'antt_violation_alerts_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_payment_reconciliation';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'antt_violation_alerts_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      approval_requests: {
        Row: {
          ai_analysis: Json | null;
          approval_type: string;
          assigned_to: string | null;
          assigned_to_role: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_notes: string | null;
          description: string | null;
          entity_id: string;
          entity_type: string;
          expires_at: string | null;
          id: string;
          requested_by: string | null;
          resolved_at: string | null;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          ai_analysis?: Json | null;
          approval_type: string;
          assigned_to?: string | null;
          assigned_to_role?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_notes?: string | null;
          description?: string | null;
          entity_id: string;
          entity_type: string;
          expires_at?: string | null;
          id?: string;
          requested_by?: string | null;
          resolved_at?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          ai_analysis?: Json | null;
          approval_type?: string;
          assigned_to?: string | null;
          assigned_to_role?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_notes?: string | null;
          description?: string | null;
          entity_id?: string;
          entity_type?: string;
          expires_at?: string | null;
          id?: string;
          requested_by?: string | null;
          resolved_at?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      approval_rules: {
        Row: {
          active: boolean;
          approval_type: string;
          approver_role: string;
          auto_approve_after_hours: number | null;
          created_at: string;
          entity_type: string;
          id: string;
          name: string;
          trigger_condition: Json;
        };
        Insert: {
          active?: boolean;
          approval_type: string;
          approver_role?: string;
          auto_approve_after_hours?: number | null;
          created_at?: string;
          entity_type: string;
          id?: string;
          name: string;
          trigger_condition: Json;
        };
        Update: {
          active?: boolean;
          approval_type?: string;
          approver_role?: string;
          auto_approve_after_hours?: number | null;
          created_at?: string;
          entity_type?: string;
          id?: string;
          name?: string;
          trigger_condition?: Json;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          created_at: string;
          id: string;
          new_values: Json | null;
          old_values: Json | null;
          record_id: string;
          table_name: string;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: string;
          new_values?: Json | null;
          old_values?: Json | null;
          record_id: string;
          table_name: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: string;
          new_values?: Json | null;
          old_values?: Json | null;
          record_id?: string;
          table_name?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      averbacoes: {
        Row: {
          ambiente: Database['public']['Enums']['focus_ambiente'];
          chave: string | null;
          cnpj_seguradora: string | null;
          created_at: string;
          created_by: string | null;
          cte_emission_id: string | null;
          dados_seguro: Json | null;
          dh_averbacao: string | null;
          doc_numero: string | null;
          doc_serie: string | null;
          doc_type: Database['public']['Enums']['averba_doc_type'];
          erro_codigo: string | null;
          erro_descricao: string | null;
          erros: Json | null;
          id: string;
          id_viagem: string | null;
          infos: Json | null;
          mdfe_emission_id: string | null;
          nome_seguradora: string | null;
          num_apolice: string | null;
          numero_averbacao: string | null;
          operacao: string;
          order_id: string | null;
          protocolo: string | null;
          protocolo_rcv: string | null;
          ramo_averbado: string | null;
          rcv_erro_codigo: string | null;
          rcv_erro_descricao: string | null;
          request_sent: Json | null;
          response_received: Json | null;
          retry_count: number;
          status: Database['public']['Enums']['averba_status'];
          tp_ddr: string | null;
          tp_mov: string | null;
          updated_at: string;
          valor_averbado: number | null;
        };
        Insert: {
          ambiente: Database['public']['Enums']['focus_ambiente'];
          chave?: string | null;
          cnpj_seguradora?: string | null;
          created_at?: string;
          created_by?: string | null;
          cte_emission_id?: string | null;
          dados_seguro?: Json | null;
          dh_averbacao?: string | null;
          doc_numero?: string | null;
          doc_serie?: string | null;
          doc_type: Database['public']['Enums']['averba_doc_type'];
          erro_codigo?: string | null;
          erro_descricao?: string | null;
          erros?: Json | null;
          id?: string;
          id_viagem?: string | null;
          infos?: Json | null;
          mdfe_emission_id?: string | null;
          nome_seguradora?: string | null;
          num_apolice?: string | null;
          numero_averbacao?: string | null;
          operacao: string;
          order_id?: string | null;
          protocolo?: string | null;
          protocolo_rcv?: string | null;
          ramo_averbado?: string | null;
          rcv_erro_codigo?: string | null;
          rcv_erro_descricao?: string | null;
          request_sent?: Json | null;
          response_received?: Json | null;
          retry_count?: number;
          status?: Database['public']['Enums']['averba_status'];
          tp_ddr?: string | null;
          tp_mov?: string | null;
          updated_at?: string;
          valor_averbado?: number | null;
        };
        Update: {
          ambiente?: Database['public']['Enums']['focus_ambiente'];
          chave?: string | null;
          cnpj_seguradora?: string | null;
          created_at?: string;
          created_by?: string | null;
          cte_emission_id?: string | null;
          dados_seguro?: Json | null;
          dh_averbacao?: string | null;
          doc_numero?: string | null;
          doc_serie?: string | null;
          doc_type?: Database['public']['Enums']['averba_doc_type'];
          erro_codigo?: string | null;
          erro_descricao?: string | null;
          erros?: Json | null;
          id?: string;
          id_viagem?: string | null;
          infos?: Json | null;
          mdfe_emission_id?: string | null;
          nome_seguradora?: string | null;
          num_apolice?: string | null;
          numero_averbacao?: string | null;
          operacao?: string;
          order_id?: string | null;
          protocolo?: string | null;
          protocolo_rcv?: string | null;
          ramo_averbado?: string | null;
          rcv_erro_codigo?: string | null;
          rcv_erro_descricao?: string | null;
          request_sent?: Json | null;
          response_received?: Json | null;
          retry_count?: number;
          status?: Database['public']['Enums']['averba_status'];
          tp_ddr?: string | null;
          tp_mov?: string | null;
          updated_at?: string;
          valor_averbado?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'averbacoes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'averbacoes_cte_emission_id_fkey';
            columns: ['cte_emission_id'];
            isOneToOne: false;
            referencedRelation: 'cte_emissions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'averbacoes_mdfe_emission_id_fkey';
            columns: ['mdfe_emission_id'];
            isOneToOne: false;
            referencedRelation: 'mdfe_emissions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'averbacoes_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'averbacoes_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders_rs_per_km';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'averbacoes_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_order_payment_reconciliation';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'averbacoes_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'averbacoes_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_financial_details';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'averbacoes_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'vw_order_risk_status';
            referencedColumns: ['order_id'];
          },
        ];
      };
      ciot_operations: {
        Row: {
          ambiente: string;
          antt_piso_minimo: number | null;
          below_floor: boolean;
          ciot_number: string | null;
          created_at: string;
          created_by: string | null;
          error_message: string | null;
          id: string;
          payload: Json;
          quote_id: string | null;
          raw_response: Json | null;
          service_order_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          ambiente?: string;
          antt_piso_minimo?: number | null;
          below_floor?: boolean;
          ciot_number?: string | null;
          created_at?: string;
          created_by?: string | null;
          error_message?: string | null;
          id?: string;
          payload?: Json;
          quote_id?: string | null;
          raw_response?: Json | null;
          service_order_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          ambiente?: string;
          antt_piso_minimo?: number | null;
          below_floor?: boolean;
          ciot_number?: string | null;
          created_at?: string;
          created_by?: string | null;
          error_message?: string | null;
          id?: string;
          payload?: Json;
          quote_id?: string | null;
          raw_response?: Json | null;
          service_order_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ciot_operations_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'ciot_operations_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ciot_operations_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'ciot_operations_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_payment_reconciliation';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'ciot_operations_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'trip_orders';
            referencedColumns: ['id'];
          },
        ];
      };
      clients: {
        Row: {
          address: string | null;
          address_complement: string | null;
          address_neighborhood: string | null;
          address_number: string | null;
          city: string | null;
          cnae_main_code: string | null;
          cnae_main_description: string | null;
          cnaes_secondary: Json | null;
          cnpj: string | null;
          cnpj_lookup_at: string | null;
          cnpj_mask: string | null;
          company_size: string | null;
          contact_enrichment_at: string | null;
          contact_name: string | null;
          cpf: number | null;
          created_at: string;
          created_by: string | null;
          efr: string | null;
          email: string | null;
          enrichment_sources: Json | null;
          ibge_code: number | null;
          id: string;
          ie_indicator: number | null;
          legal_nature: string | null;
          legal_nature_code: string | null;
          legal_representative_cpf: string | null;
          legal_representative_name: string | null;
          legal_representative_role: string | null;
          name: string;
          notes: string | null;
          opening_date: string | null;
          partners: Json | null;
          phone: string | null;
          registration_status: string | null;
          registration_status_date: string | null;
          registration_status_reason: string | null;
          share_capital: number | null;
          state: string | null;
          state_registration: string | null;
          trade_name: string | null;
          updated_at: string;
          user_id: string;
          zip_code: string | null;
          zip_code_mask: string | null;
        };
        Insert: {
          address?: string | null;
          address_complement?: string | null;
          address_neighborhood?: string | null;
          address_number?: string | null;
          city?: string | null;
          cnae_main_code?: string | null;
          cnae_main_description?: string | null;
          cnaes_secondary?: Json | null;
          cnpj?: string | null;
          cnpj_lookup_at?: string | null;
          cnpj_mask?: string | null;
          company_size?: string | null;
          contact_enrichment_at?: string | null;
          contact_name?: string | null;
          cpf?: number | null;
          created_at?: string;
          created_by?: string | null;
          efr?: string | null;
          email?: string | null;
          enrichment_sources?: Json | null;
          ibge_code?: number | null;
          id?: string;
          ie_indicator?: number | null;
          legal_nature?: string | null;
          legal_nature_code?: string | null;
          legal_representative_cpf?: string | null;
          legal_representative_name?: string | null;
          legal_representative_role?: string | null;
          name: string;
          notes?: string | null;
          opening_date?: string | null;
          partners?: Json | null;
          phone?: string | null;
          registration_status?: string | null;
          registration_status_date?: string | null;
          registration_status_reason?: string | null;
          share_capital?: number | null;
          state?: string | null;
          state_registration?: string | null;
          trade_name?: string | null;
          updated_at?: string;
          user_id?: string;
          zip_code?: string | null;
          zip_code_mask?: string | null;
        };
        Update: {
          address?: string | null;
          address_complement?: string | null;
          address_neighborhood?: string | null;
          address_number?: string | null;
          city?: string | null;
          cnae_main_code?: string | null;
          cnae_main_description?: string | null;
          cnaes_secondary?: Json | null;
          cnpj?: string | null;
          cnpj_lookup_at?: string | null;
          cnpj_mask?: string | null;
          company_size?: string | null;
          contact_enrichment_at?: string | null;
          contact_name?: string | null;
          cpf?: number | null;
          created_at?: string;
          created_by?: string | null;
          efr?: string | null;
          email?: string | null;
          enrichment_sources?: Json | null;
          ibge_code?: number | null;
          id?: string;
          ie_indicator?: number | null;
          legal_nature?: string | null;
          legal_nature_code?: string | null;
          legal_representative_cpf?: string | null;
          legal_representative_name?: string | null;
          legal_representative_role?: string | null;
          name?: string;
          notes?: string | null;
          opening_date?: string | null;
          partners?: Json | null;
          phone?: string | null;
          registration_status?: string | null;
          registration_status_date?: string | null;
          registration_status_reason?: string | null;
          share_capital?: number | null;
          state?: string | null;
          state_registration?: string | null;
          trade_name?: string | null;
          updated_at?: string;
          user_id?: string;
          zip_code?: string | null;
          zip_code_mask?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'clients_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'clients_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      cnh_categories: {
        Row: {
          active: boolean;
          code: string;
          description: string;
          id: number;
        };
        Insert: {
          active?: boolean;
          code: string;
          description: string;
          id?: number;
        };
        Update: {
          active?: boolean;
          code?: string;
          description?: string;
          id?: number;
        };
        Relationships: [];
      };
      collection_orders: {
        Row: {
          additional_info: string | null;
          antt_data: Json | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          cargo_data: Json;
          created_at: string;
          delivery_date: string | null;
          driver_data: Json;
          id: string;
          issued_at: string;
          issued_by: string | null;
          oc_month: number;
          oc_number: string;
          oc_seq: number;
          oc_year: number;
          order_id: string;
          pdf_storage_path: string | null;
          pickup_date: string | null;
          recipient_data: Json;
          sender_data: Json;
          status: Database['public']['Enums']['collection_order_status'];
          updated_at: string;
          vehicle_data: Json;
        };
        Insert: {
          additional_info?: string | null;
          antt_data?: Json | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cargo_data: Json;
          created_at?: string;
          delivery_date?: string | null;
          driver_data: Json;
          id?: string;
          issued_at?: string;
          issued_by?: string | null;
          oc_month: number;
          oc_number: string;
          oc_seq: number;
          oc_year: number;
          order_id: string;
          pdf_storage_path?: string | null;
          pickup_date?: string | null;
          recipient_data: Json;
          sender_data: Json;
          status?: Database['public']['Enums']['collection_order_status'];
          updated_at?: string;
          vehicle_data: Json;
        };
        Update: {
          additional_info?: string | null;
          antt_data?: Json | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cargo_data?: Json;
          created_at?: string;
          delivery_date?: string | null;
          driver_data?: Json;
          id?: string;
          issued_at?: string;
          issued_by?: string | null;
          oc_month?: number;
          oc_number?: string;
          oc_seq?: number;
          oc_year?: number;
          order_id?: string;
          pdf_storage_path?: string | null;
          pickup_date?: string | null;
          recipient_data?: Json;
          sender_data?: Json;
          status?: Database['public']['Enums']['collection_order_status'];
          updated_at?: string;
          vehicle_data?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'collection_orders_cancelled_by_fkey';
            columns: ['cancelled_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'collection_orders_issued_by_fkey';
            columns: ['issued_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'collection_orders_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'collection_orders_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders_rs_per_km';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'collection_orders_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_order_payment_reconciliation';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'collection_orders_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'collection_orders_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_financial_details';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'collection_orders_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'vw_order_risk_status';
            referencedColumns: ['order_id'];
          },
        ];
      };
      company_settings: {
        Row: {
          address_city: string;
          address_complement: string | null;
          address_neighborhood: string;
          address_number: string;
          address_state: string;
          address_street: string;
          address_zip: string;
          bank_account: string | null;
          bank_agency: string | null;
          bank_name: string | null;
          bank_pix_key: string | null;
          cnpj: string;
          created_at: string;
          default_jurisdiction: string;
          email: string;
          id: string;
          legal_name: string;
          legal_representative_cpf: string | null;
          legal_representative_name: string | null;
          legal_representative_role: string | null;
          municipal_registration: string | null;
          phone: string;
          signature_city: string;
          state_registration: string;
          trade_name: string;
          updated_at: string;
        };
        Insert: {
          address_city?: string;
          address_complement?: string | null;
          address_neighborhood?: string;
          address_number?: string;
          address_state?: string;
          address_street?: string;
          address_zip?: string;
          bank_account?: string | null;
          bank_agency?: string | null;
          bank_name?: string | null;
          bank_pix_key?: string | null;
          cnpj?: string;
          created_at?: string;
          default_jurisdiction?: string;
          email?: string;
          id?: string;
          legal_name?: string;
          legal_representative_cpf?: string | null;
          legal_representative_name?: string | null;
          legal_representative_role?: string | null;
          municipal_registration?: string | null;
          phone?: string;
          signature_city?: string;
          state_registration?: string;
          trade_name?: string;
          updated_at?: string;
        };
        Update: {
          address_city?: string;
          address_complement?: string | null;
          address_neighborhood?: string;
          address_number?: string;
          address_state?: string;
          address_street?: string;
          address_zip?: string;
          bank_account?: string | null;
          bank_agency?: string | null;
          bank_name?: string | null;
          bank_pix_key?: string | null;
          cnpj?: string;
          created_at?: string;
          default_jurisdiction?: string;
          email?: string;
          id?: string;
          legal_name?: string;
          legal_representative_cpf?: string | null;
          legal_representative_name?: string | null;
          legal_representative_role?: string | null;
          municipal_registration?: string | null;
          phone?: string;
          signature_city?: string;
          state_registration?: string;
          trade_name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      compliance_checks: {
        Row: {
          ai_analysis: Json | null;
          check_type: Database['public']['Enums']['compliance_check_type'];
          created_at: string;
          entity_type: string | null;
          id: string;
          order_id: string | null;
          result: Json | null;
          rules_evaluated: Json;
          status: Database['public']['Enums']['compliance_check_status'];
          violation_type: string | null;
          violations: Json;
        };
        Insert: {
          ai_analysis?: Json | null;
          check_type: Database['public']['Enums']['compliance_check_type'];
          created_at?: string;
          entity_type?: string | null;
          id?: string;
          order_id?: string | null;
          result?: Json | null;
          rules_evaluated?: Json;
          status?: Database['public']['Enums']['compliance_check_status'];
          violation_type?: string | null;
          violations?: Json;
        };
        Update: {
          ai_analysis?: Json | null;
          check_type?: Database['public']['Enums']['compliance_check_type'];
          created_at?: string;
          entity_type?: string | null;
          id?: string;
          order_id?: string | null;
          result?: Json | null;
          rules_evaluated?: Json;
          status?: Database['public']['Enums']['compliance_check_status'];
          violation_type?: string | null;
          violations?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'compliance_checks_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'compliance_checks_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders_rs_per_km';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'compliance_checks_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_order_payment_reconciliation';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'compliance_checks_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'compliance_checks_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_financial_details';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'compliance_checks_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'vw_order_risk_status';
            referencedColumns: ['order_id'];
          },
        ];
      };
      conditional_fees: {
        Row: {
          active: boolean;
          applies_to: string;
          code: string;
          conditions: Json | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          fee_type: string;
          fee_value: number;
          id: string;
          max_value: number | null;
          min_value: number | null;
          name: string;
          updated_at: string;
          user_id: string | null;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          active?: boolean;
          applies_to?: string;
          code: string;
          conditions?: Json | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          fee_type: string;
          fee_value: number;
          id?: string;
          max_value?: number | null;
          min_value?: number | null;
          name: string;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          active?: boolean;
          applies_to?: string;
          code?: string;
          conditions?: Json | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          fee_type?: string;
          fee_value?: number;
          id?: string;
          max_value?: number | null;
          min_value?: number | null;
          name?: string;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [];
      };
      cte_emissions: {
        Row: {
          ambiente: Database['public']['Enums']['focus_ambiente'];
          cfop: number;
          chave_cte: string | null;
          created_at: string;
          created_by: string | null;
          dacte_storage_path: string | null;
          data_autorizacao: string | null;
          data_cancelamento: string | null;
          focus_id: string | null;
          id: string;
          justificativa_cancelamento: string | null;
          numero: number;
          order_id: string | null;
          payload_sent: Json;
          protocolo: string | null;
          quote_id: string | null;
          ref: string;
          rejection_code: string | null;
          rejection_msg: string | null;
          response_received: Json | null;
          retry_count: number;
          serie: number;
          status: Database['public']['Enums']['cte_emission_status'];
          status_sefaz: string | null;
          tomador_tipo: number;
          updated_at: string;
          xml_storage_path: string | null;
        };
        Insert: {
          ambiente: Database['public']['Enums']['focus_ambiente'];
          cfop: number;
          chave_cte?: string | null;
          created_at?: string;
          created_by?: string | null;
          dacte_storage_path?: string | null;
          data_autorizacao?: string | null;
          data_cancelamento?: string | null;
          focus_id?: string | null;
          id?: string;
          justificativa_cancelamento?: string | null;
          numero: number;
          order_id?: string | null;
          payload_sent: Json;
          protocolo?: string | null;
          quote_id?: string | null;
          ref: string;
          rejection_code?: string | null;
          rejection_msg?: string | null;
          response_received?: Json | null;
          retry_count?: number;
          serie: number;
          status?: Database['public']['Enums']['cte_emission_status'];
          status_sefaz?: string | null;
          tomador_tipo: number;
          updated_at?: string;
          xml_storage_path?: string | null;
        };
        Update: {
          ambiente?: Database['public']['Enums']['focus_ambiente'];
          cfop?: number;
          chave_cte?: string | null;
          created_at?: string;
          created_by?: string | null;
          dacte_storage_path?: string | null;
          data_autorizacao?: string | null;
          data_cancelamento?: string | null;
          focus_id?: string | null;
          id?: string;
          justificativa_cancelamento?: string | null;
          numero?: number;
          order_id?: string | null;
          payload_sent?: Json;
          protocolo?: string | null;
          quote_id?: string | null;
          ref?: string;
          rejection_code?: string | null;
          rejection_msg?: string | null;
          response_received?: Json | null;
          retry_count?: number;
          serie?: number;
          status?: Database['public']['Enums']['cte_emission_status'];
          status_sefaz?: string | null;
          tomador_tipo?: number;
          updated_at?: string;
          xml_storage_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cte_emissions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'cte_emissions_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cte_emissions_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders_rs_per_km';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'cte_emissions_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_order_payment_reconciliation';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'cte_emissions_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'cte_emissions_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_financial_details';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'cte_emissions_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'vw_order_risk_status';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'cte_emissions_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cte_emissions_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'cte_emissions_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_payment_reconciliation';
            referencedColumns: ['quote_id'];
          },
        ];
      };
      cte_sequence: {
        Row: {
          ambiente: Database['public']['Enums']['focus_ambiente'];
          last_numero: number;
          serie: number;
        };
        Insert: {
          ambiente: Database['public']['Enums']['focus_ambiente'];
          last_numero?: number;
          serie?: number;
        };
        Update: {
          ambiente?: Database['public']['Enums']['focus_ambiente'];
          last_numero?: number;
          serie?: number;
        };
        Relationships: [];
      };
      delivery_conditions: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          label: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          label: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          label?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      discharge_checklist_items: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          label: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          label: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          label?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          created_at: string;
          fat_id: string | null;
          file_name: string;
          file_size: number | null;
          file_url: string;
          id: string;
          nfe_key: string | null;
          order_id: string | null;
          quote_id: string | null;
          source: string;
          trip_id: string | null;
          type: Database['public']['Enums']['document_type'];
          updated_at: string;
          uploaded_by: string;
          validation_status: string | null;
        };
        Insert: {
          created_at?: string;
          fat_id?: string | null;
          file_name: string;
          file_size?: number | null;
          file_url: string;
          id?: string;
          nfe_key?: string | null;
          order_id?: string | null;
          quote_id?: string | null;
          source?: string;
          trip_id?: string | null;
          type: Database['public']['Enums']['document_type'];
          updated_at?: string;
          uploaded_by: string;
          validation_status?: string | null;
        };
        Update: {
          created_at?: string;
          fat_id?: string | null;
          file_name?: string;
          file_size?: number | null;
          file_url?: string;
          id?: string;
          nfe_key?: string | null;
          order_id?: string | null;
          quote_id?: string | null;
          source?: string;
          trip_id?: string | null;
          type?: Database['public']['Enums']['document_type'];
          updated_at?: string;
          uploaded_by?: string;
          validation_status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'documents_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'documents_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders_rs_per_km';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'documents_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_order_payment_reconciliation';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'documents_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'documents_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_financial_details';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'documents_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'vw_order_risk_status';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'documents_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'documents_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'documents_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_payment_reconciliation';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'documents_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trip_financial_summary';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'documents_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'documents_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_payment_reconciliation';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'documents_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'vw_trip_risk_summary';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'documents_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      driver_qualifications: {
        Row: {
          ai_analysis: Json | null;
          checklist: Json;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          driver_cpf: string | null;
          driver_id: string | null;
          driver_name: string | null;
          expires_at: string | null;
          id: string;
          order_id: string;
          qualification_type: string | null;
          risk_flags: Json;
          risk_score: number | null;
          status: Database['public']['Enums']['driver_qualification_status'];
          updated_at: string;
          whatsapp_reminded_at: string | null;
          whatsapp_sent_at: string | null;
        };
        Insert: {
          ai_analysis?: Json | null;
          checklist?: Json;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          driver_cpf?: string | null;
          driver_id?: string | null;
          driver_name?: string | null;
          expires_at?: string | null;
          id?: string;
          order_id: string;
          qualification_type?: string | null;
          risk_flags?: Json;
          risk_score?: number | null;
          status?: Database['public']['Enums']['driver_qualification_status'];
          updated_at?: string;
          whatsapp_reminded_at?: string | null;
          whatsapp_sent_at?: string | null;
        };
        Update: {
          ai_analysis?: Json | null;
          checklist?: Json;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          driver_cpf?: string | null;
          driver_id?: string | null;
          driver_name?: string | null;
          expires_at?: string | null;
          id?: string;
          order_id?: string;
          qualification_type?: string | null;
          risk_flags?: Json;
          risk_score?: number | null;
          status?: Database['public']['Enums']['driver_qualification_status'];
          updated_at?: string;
          whatsapp_reminded_at?: string | null;
          whatsapp_sent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'driver_qualifications_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'driver_qualifications_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'driver_qualifications_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders_rs_per_km';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'driver_qualifications_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_order_payment_reconciliation';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'driver_qualifications_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'driver_qualifications_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_financial_details';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'driver_qualifications_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'vw_order_risk_status';
            referencedColumns: ['order_id'];
          },
        ];
      };
      drivers: {
        Row: {
          active: boolean;
          antt: string | null;
          antt_expiry: string | null;
          cnh: string | null;
          cnh_category: string | null;
          cnh_expiry: string | null;
          contract_type: Database['public']['Enums']['driver_contract_type'];
          cooldown_days: number | null;
          cpf: string | null;
          created_at: string;
          id: string;
          last_refusal_at: string | null;
          name: string;
          phone: string | null;
          phone_normalized: string | null;
          refusal_count: number | null;
          rntrc_registry_type: Database['public']['Enums']['rntrc_registry_type'] | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          antt?: string | null;
          antt_expiry?: string | null;
          cnh?: string | null;
          cnh_category?: string | null;
          cnh_expiry?: string | null;
          contract_type?: Database['public']['Enums']['driver_contract_type'];
          cooldown_days?: number | null;
          cpf?: string | null;
          created_at?: string;
          id?: string;
          last_refusal_at?: string | null;
          name: string;
          phone?: string | null;
          phone_normalized?: string | null;
          refusal_count?: number | null;
          rntrc_registry_type?: Database['public']['Enums']['rntrc_registry_type'] | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          antt?: string | null;
          antt_expiry?: string | null;
          cnh?: string | null;
          cnh_category?: string | null;
          cnh_expiry?: string | null;
          contract_type?: Database['public']['Enums']['driver_contract_type'];
          cooldown_days?: number | null;
          cpf?: string | null;
          created_at?: string;
          id?: string;
          last_refusal_at?: string | null;
          name?: string;
          phone?: string | null;
          phone_normalized?: string | null;
          refusal_count?: number | null;
          rntrc_registry_type?: Database['public']['Enums']['rntrc_registry_type'] | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      equipment_rental_rates: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          id: string;
          name: string;
          unit: string;
          updated_at: string;
          valid_from: string | null;
          valid_until: string | null;
          value: number;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          id?: string;
          name: string;
          unit?: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
          value?: number;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          unit?: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
          value?: number;
        };
        Relationships: [];
      };
      financial_documents: {
        Row: {
          code: string | null;
          created_at: string;
          erp_reference: string | null;
          erp_status: string | null;
          id: string;
          notes: string | null;
          owner_id: string | null;
          source_id: string;
          source_type: Database['public']['Enums']['financial_source_type'];
          status: string;
          total_amount: number | null;
          type: Database['public']['Enums']['financial_doc_type'];
          updated_at: string;
        };
        Insert: {
          code?: string | null;
          created_at?: string;
          erp_reference?: string | null;
          erp_status?: string | null;
          id?: string;
          notes?: string | null;
          owner_id?: string | null;
          source_id: string;
          source_type: Database['public']['Enums']['financial_source_type'];
          status?: string;
          total_amount?: number | null;
          type: Database['public']['Enums']['financial_doc_type'];
          updated_at?: string;
        };
        Update: {
          code?: string | null;
          created_at?: string;
          erp_reference?: string | null;
          erp_status?: string | null;
          id?: string;
          notes?: string | null;
          owner_id?: string | null;
          source_id?: string;
          source_type?: Database['public']['Enums']['financial_source_type'];
          status?: string;
          total_amount?: number | null;
          type?: Database['public']['Enums']['financial_doc_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'financial_documents_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
        ];
      };
      financial_installments: {
        Row: {
          amount: number | null;
          created_at: string;
          due_date: string;
          financial_document_id: string;
          id: string;
          payment_method: string | null;
          settled_at: string | null;
          status: Database['public']['Enums']['financial_installment_status'];
          updated_at: string;
        };
        Insert: {
          amount?: number | null;
          created_at?: string;
          due_date: string;
          financial_document_id: string;
          id?: string;
          payment_method?: string | null;
          settled_at?: string | null;
          status?: Database['public']['Enums']['financial_installment_status'];
          updated_at?: string;
        };
        Update: {
          amount?: number | null;
          created_at?: string;
          due_date?: string;
          financial_document_id?: string;
          id?: string;
          payment_method?: string | null;
          settled_at?: string | null;
          status?: Database['public']['Enums']['financial_installment_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'financial_installments_financial_document_id_fkey';
            columns: ['financial_document_id'];
            isOneToOne: false;
            referencedRelation: 'financial_documents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'financial_installments_financial_document_id_fkey';
            columns: ['financial_document_id'];
            isOneToOne: false;
            referencedRelation: 'financial_documents_kanban';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'financial_installments_financial_document_id_fkey';
            columns: ['financial_document_id'];
            isOneToOne: false;
            referencedRelation: 'financial_payable_kanban';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'financial_installments_financial_document_id_fkey';
            columns: ['financial_document_id'];
            isOneToOne: false;
            referencedRelation: 'financial_receivable_kanban';
            referencedColumns: ['id'];
          },
        ];
      };
      gris_services: {
        Row: {
          code: string;
          created_at: string;
          default_percent: number | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          default_percent?: number | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          default_percent?: number | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      icms_rates: {
        Row: {
          created_at: string;
          created_by: string | null;
          destination_state: string;
          id: string;
          origin_state: string;
          rate_percent: number;
          updated_at: string;
          user_id: string | null;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          destination_state: string;
          id?: string;
          origin_state: string;
          rate_percent: number;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          destination_state?: string;
          id?: string;
          origin_state?: string;
          rate_percent?: number;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'icms_rates_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      load_composition_discount_breakdown: {
        Row: {
          composition_id: string;
          created_at: string | null;
          created_by: string | null;
          discount_offered_brl: number;
          discount_percent: number;
          discount_strategy: string | null;
          final_margin_brl: number;
          final_margin_percent: number;
          final_quote_price_brl: number;
          id: string;
          is_feasible: boolean | null;
          margin_rule_source: string | null;
          max_discount_allowed_brl: number;
          minimum_margin_percent_applied: number;
          original_freight_cost_brl: number;
          original_margin_brl: number;
          original_margin_percent: number;
          original_quote_price_brl: number;
          quote_id: string;
          shipper_id: string;
          updated_at: string | null;
          validation_warnings: string[] | null;
        };
        Insert: {
          composition_id: string;
          created_at?: string | null;
          created_by?: string | null;
          discount_offered_brl?: number;
          discount_percent?: number;
          discount_strategy?: string | null;
          final_margin_brl: number;
          final_margin_percent: number;
          final_quote_price_brl: number;
          id?: string;
          is_feasible?: boolean | null;
          margin_rule_source?: string | null;
          max_discount_allowed_brl: number;
          minimum_margin_percent_applied: number;
          original_freight_cost_brl: number;
          original_margin_brl: number;
          original_margin_percent: number;
          original_quote_price_brl: number;
          quote_id: string;
          shipper_id: string;
          updated_at?: string | null;
          validation_warnings?: string[] | null;
        };
        Update: {
          composition_id?: string;
          created_at?: string | null;
          created_by?: string | null;
          discount_offered_brl?: number;
          discount_percent?: number;
          discount_strategy?: string | null;
          final_margin_brl?: number;
          final_margin_percent?: number;
          final_quote_price_brl?: number;
          id?: string;
          is_feasible?: boolean | null;
          margin_rule_source?: string | null;
          max_discount_allowed_brl?: number;
          minimum_margin_percent_applied?: number;
          original_freight_cost_brl?: number;
          original_margin_brl?: number;
          original_margin_percent?: number;
          original_quote_price_brl?: number;
          quote_id?: string;
          shipper_id?: string;
          updated_at?: string | null;
          validation_warnings?: string[] | null;
        };
        Relationships: [
          {
            foreignKeyName: 'load_composition_discount_breakdown_composition_id_fkey';
            columns: ['composition_id'];
            isOneToOne: false;
            referencedRelation: 'load_composition_suggestions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'load_composition_discount_breakdown_composition_id_fkey';
            columns: ['composition_id'];
            isOneToOne: false;
            referencedRelation: 'load_composition_summary';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'load_composition_discount_breakdown_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'load_composition_discount_breakdown_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'load_composition_discount_breakdown_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'load_composition_discount_breakdown_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_payment_reconciliation';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'load_composition_discount_breakdown_shipper_id_fkey';
            columns: ['shipper_id'];
            isOneToOne: false;
            referencedRelation: 'shippers';
            referencedColumns: ['id'];
          },
        ];
      };
      load_composition_metrics: {
        Row: {
          co2_reduction_kg: number | null;
          composed_km_total: number | null;
          composed_total_cost: number | null;
          composition_id: string;
          created_at: string | null;
          id: string;
          km_efficiency_percent: number | null;
          original_km_total: number | null;
          original_total_cost: number | null;
          savings_brl: number | null;
          savings_percent: number | null;
        };
        Insert: {
          co2_reduction_kg?: number | null;
          composed_km_total?: number | null;
          composed_total_cost?: number | null;
          composition_id: string;
          created_at?: string | null;
          id?: string;
          km_efficiency_percent?: number | null;
          original_km_total?: number | null;
          original_total_cost?: number | null;
          savings_brl?: number | null;
          savings_percent?: number | null;
        };
        Update: {
          co2_reduction_kg?: number | null;
          composed_km_total?: number | null;
          composed_total_cost?: number | null;
          composition_id?: string;
          created_at?: string | null;
          id?: string;
          km_efficiency_percent?: number | null;
          original_km_total?: number | null;
          original_total_cost?: number | null;
          savings_brl?: number | null;
          savings_percent?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'load_composition_metrics_composition_id_fkey';
            columns: ['composition_id'];
            isOneToOne: false;
            referencedRelation: 'load_composition_suggestions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'load_composition_metrics_composition_id_fkey';
            columns: ['composition_id'];
            isOneToOne: false;
            referencedRelation: 'load_composition_summary';
            referencedColumns: ['id'];
          },
        ];
      };
      load_composition_routings: {
        Row: {
          composition_id: string;
          created_at: string | null;
          estimated_arrival: string | null;
          id: string;
          is_feasible: boolean | null;
          leg_distance_km: number | null;
          leg_duration_min: number | null;
          leg_polyline: string | null;
          pickup_window_end: string | null;
          pickup_window_start: string | null;
          quote_id: string;
          route_sequence: number;
          toll_centavos: number | null;
        };
        Insert: {
          composition_id: string;
          created_at?: string | null;
          estimated_arrival?: string | null;
          id?: string;
          is_feasible?: boolean | null;
          leg_distance_km?: number | null;
          leg_duration_min?: number | null;
          leg_polyline?: string | null;
          pickup_window_end?: string | null;
          pickup_window_start?: string | null;
          quote_id: string;
          route_sequence: number;
          toll_centavos?: number | null;
        };
        Update: {
          composition_id?: string;
          created_at?: string | null;
          estimated_arrival?: string | null;
          id?: string;
          is_feasible?: boolean | null;
          leg_distance_km?: number | null;
          leg_duration_min?: number | null;
          leg_polyline?: string | null;
          pickup_window_end?: string | null;
          pickup_window_start?: string | null;
          quote_id?: string;
          route_sequence?: number;
          toll_centavos?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'load_composition_routings_composition_id_fkey';
            columns: ['composition_id'];
            isOneToOne: false;
            referencedRelation: 'load_composition_suggestions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'load_composition_routings_composition_id_fkey';
            columns: ['composition_id'];
            isOneToOne: false;
            referencedRelation: 'load_composition_summary';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'load_composition_routings_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'load_composition_routings_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'load_composition_routings_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_payment_reconciliation';
            referencedColumns: ['quote_id'];
          },
        ];
      };
      load_composition_suggestions: {
        Row: {
          anchor_quote_id: string | null;
          approved_at: string | null;
          approved_by: string | null;
          base_km_total: number | null;
          composed_km_total: number | null;
          consolidation_score: number;
          created_at: string | null;
          created_by: string;
          created_order_id: string | null;
          delta_km_abs: number | null;
          delta_km_percent: number | null;
          distance_increase_percent: number | null;
          encoded_polyline: string | null;
          estimated_savings_brl: number | null;
          id: string;
          is_feasible: boolean | null;
          quote_ids: string[];
          route_evaluation_model: string | null;
          shipper_id: string;
          status: string | null;
          suggested_axes_count: number | null;
          suggested_vehicle_type_id: string | null;
          suggested_vehicle_type_name: string | null;
          technical_explanation: string | null;
          total_combined_volume_m3: number | null;
          total_combined_weight_kg: number | null;
          total_toll_centavos: number | null;
          total_toll_tag_centavos: number | null;
          trigger_source: string;
          updated_at: string | null;
          url_mapa_view: string | null;
          validation_warnings: string[] | null;
          webrouter_id_rota: number | null;
        };
        Insert: {
          anchor_quote_id?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          base_km_total?: number | null;
          composed_km_total?: number | null;
          consolidation_score?: number;
          created_at?: string | null;
          created_by: string;
          created_order_id?: string | null;
          delta_km_abs?: number | null;
          delta_km_percent?: number | null;
          distance_increase_percent?: number | null;
          encoded_polyline?: string | null;
          estimated_savings_brl?: number | null;
          id?: string;
          is_feasible?: boolean | null;
          quote_ids: string[];
          route_evaluation_model?: string | null;
          shipper_id: string;
          status?: string | null;
          suggested_axes_count?: number | null;
          suggested_vehicle_type_id?: string | null;
          suggested_vehicle_type_name?: string | null;
          technical_explanation?: string | null;
          total_combined_volume_m3?: number | null;
          total_combined_weight_kg?: number | null;
          total_toll_centavos?: number | null;
          total_toll_tag_centavos?: number | null;
          trigger_source?: string;
          updated_at?: string | null;
          url_mapa_view?: string | null;
          validation_warnings?: string[] | null;
          webrouter_id_rota?: number | null;
        };
        Update: {
          anchor_quote_id?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          base_km_total?: number | null;
          composed_km_total?: number | null;
          consolidation_score?: number;
          created_at?: string | null;
          created_by?: string;
          created_order_id?: string | null;
          delta_km_abs?: number | null;
          delta_km_percent?: number | null;
          distance_increase_percent?: number | null;
          encoded_polyline?: string | null;
          estimated_savings_brl?: number | null;
          id?: string;
          is_feasible?: boolean | null;
          quote_ids?: string[];
          route_evaluation_model?: string | null;
          shipper_id?: string;
          status?: string | null;
          suggested_axes_count?: number | null;
          suggested_vehicle_type_id?: string | null;
          suggested_vehicle_type_name?: string | null;
          technical_explanation?: string | null;
          total_combined_volume_m3?: number | null;
          total_combined_weight_kg?: number | null;
          total_toll_centavos?: number | null;
          total_toll_tag_centavos?: number | null;
          trigger_source?: string;
          updated_at?: string | null;
          url_mapa_view?: string | null;
          validation_warnings?: string[] | null;
          webrouter_id_rota?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'load_composition_suggestions_anchor_quote_id_fkey';
            columns: ['anchor_quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'load_composition_suggestions_anchor_quote_id_fkey';
            columns: ['anchor_quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'load_composition_suggestions_anchor_quote_id_fkey';
            columns: ['anchor_quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_payment_reconciliation';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'load_composition_suggestions_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'load_composition_suggestions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'load_composition_suggestions_created_order_id_fkey';
            columns: ['created_order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'load_composition_suggestions_created_order_id_fkey';
            columns: ['created_order_id'];
            isOneToOne: false;
            referencedRelation: 'orders_rs_per_km';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'load_composition_suggestions_created_order_id_fkey';
            columns: ['created_order_id'];
            isOneToOne: false;
            referencedRelation: 'v_order_payment_reconciliation';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'load_composition_suggestions_created_order_id_fkey';
            columns: ['created_order_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'load_composition_suggestions_created_order_id_fkey';
            columns: ['created_order_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_financial_details';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'load_composition_suggestions_created_order_id_fkey';
            columns: ['created_order_id'];
            isOneToOne: false;
            referencedRelation: 'vw_order_risk_status';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'load_composition_suggestions_shipper_id_fkey';
            columns: ['shipper_id'];
            isOneToOne: false;
            referencedRelation: 'shippers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'load_composition_suggestions_suggested_vehicle_type_id_fkey';
            columns: ['suggested_vehicle_type_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_types';
            referencedColumns: ['id'];
          },
        ];
      };
      logistics_traffic_rules: {
        Row: {
          city: string;
          created_at: string | null;
          full_name: string | null;
          id: string;
          organ_name: string;
          permit_info: string | null;
          restriction_type: string | null;
          rules_summary: string | null;
          source: string | null;
          state: string;
          updated_at: string | null;
        };
        Insert: {
          city: string;
          created_at?: string | null;
          full_name?: string | null;
          id?: string;
          organ_name: string;
          permit_info?: string | null;
          restriction_type?: string | null;
          rules_summary?: string | null;
          source?: string | null;
          state: string;
          updated_at?: string | null;
        };
        Update: {
          city?: string;
          created_at?: string | null;
          full_name?: string | null;
          id?: string;
          organ_name?: string;
          permit_info?: string | null;
          restriction_type?: string | null;
          rules_summary?: string | null;
          source?: string | null;
          state?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      market_indices: {
        Row: {
          agente_versao: string | null;
          alerta_reajuste: string | null;
          created_at: string | null;
          diesel_s10: number | null;
          diesel_s500: number | null;
          diesel_variacao_anual: number | null;
          diesel_variacao_mensal: number | null;
          fonte: string | null;
          gerado_em: string;
          id: string;
          inctf_acumulado: number | null;
          inctf_mensal: number | null;
          inctl_acumulado: number | null;
          inctl_mensal: number | null;
          inctl_por_faixa: Json | null;
          justificativa_reajuste: string | null;
          periodo_referencia: string;
          raw_payload: Json | null;
          reajuste_sugerido: number | null;
          relatorio_url: string | null;
          updated_at: string | null;
        };
        Insert: {
          agente_versao?: string | null;
          alerta_reajuste?: string | null;
          created_at?: string | null;
          diesel_s10?: number | null;
          diesel_s500?: number | null;
          diesel_variacao_anual?: number | null;
          diesel_variacao_mensal?: number | null;
          fonte?: string | null;
          gerado_em: string;
          id?: string;
          inctf_acumulado?: number | null;
          inctf_mensal?: number | null;
          inctl_acumulado?: number | null;
          inctl_mensal?: number | null;
          inctl_por_faixa?: Json | null;
          justificativa_reajuste?: string | null;
          periodo_referencia: string;
          raw_payload?: Json | null;
          reajuste_sugerido?: number | null;
          relatorio_url?: string | null;
          updated_at?: string | null;
        };
        Update: {
          agente_versao?: string | null;
          alerta_reajuste?: string | null;
          created_at?: string | null;
          diesel_s10?: number | null;
          diesel_s500?: number | null;
          diesel_variacao_anual?: number | null;
          diesel_variacao_mensal?: number | null;
          fonte?: string | null;
          gerado_em?: string;
          id?: string;
          inctf_acumulado?: number | null;
          inctf_mensal?: number | null;
          inctl_acumulado?: number | null;
          inctl_mensal?: number | null;
          inctl_por_faixa?: Json | null;
          justificativa_reajuste?: string | null;
          periodo_referencia?: string;
          raw_payload?: Json | null;
          reajuste_sugerido?: number | null;
          relatorio_url?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      mdfe_cte_link: {
        Row: {
          cte_emission_id: string;
          mdfe_id: string;
        };
        Insert: {
          cte_emission_id: string;
          mdfe_id: string;
        };
        Update: {
          cte_emission_id?: string;
          mdfe_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mdfe_cte_link_cte_emission_id_fkey';
            columns: ['cte_emission_id'];
            isOneToOne: false;
            referencedRelation: 'cte_emissions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mdfe_cte_link_mdfe_id_fkey';
            columns: ['mdfe_id'];
            isOneToOne: false;
            referencedRelation: 'mdfe_emissions';
            referencedColumns: ['id'];
          },
        ];
      };
      mdfe_emissions: {
        Row: {
          ambiente: Database['public']['Enums']['focus_ambiente'];
          cancelled_at: string | null;
          chave_mdfe: string | null;
          created_at: string;
          created_by: string | null;
          damdfe_storage_path: string | null;
          data_autorizacao: string | null;
          driver_id: string | null;
          encerrado_at: string | null;
          focus_id: string | null;
          id: string;
          justificativa_cancelamento: string | null;
          municipio_descarga_ibge: number | null;
          numero: number;
          payload_sent: Json;
          protocolo: string | null;
          ref: string;
          rejection_code: string | null;
          rejection_msg: string | null;
          response_received: Json | null;
          retry_count: number;
          serie: number;
          status: Database['public']['Enums']['mdfe_emission_status'];
          status_sefaz: string | null;
          uf_fim: string;
          uf_inicio: string;
          updated_at: string;
          vehicle_id: string | null;
          xml_storage_path: string | null;
        };
        Insert: {
          ambiente: Database['public']['Enums']['focus_ambiente'];
          cancelled_at?: string | null;
          chave_mdfe?: string | null;
          created_at?: string;
          created_by?: string | null;
          damdfe_storage_path?: string | null;
          data_autorizacao?: string | null;
          driver_id?: string | null;
          encerrado_at?: string | null;
          focus_id?: string | null;
          id?: string;
          justificativa_cancelamento?: string | null;
          municipio_descarga_ibge?: number | null;
          numero: number;
          payload_sent: Json;
          protocolo?: string | null;
          ref: string;
          rejection_code?: string | null;
          rejection_msg?: string | null;
          response_received?: Json | null;
          retry_count?: number;
          serie: number;
          status?: Database['public']['Enums']['mdfe_emission_status'];
          status_sefaz?: string | null;
          uf_fim: string;
          uf_inicio: string;
          updated_at?: string;
          vehicle_id?: string | null;
          xml_storage_path?: string | null;
        };
        Update: {
          ambiente?: Database['public']['Enums']['focus_ambiente'];
          cancelled_at?: string | null;
          chave_mdfe?: string | null;
          created_at?: string;
          created_by?: string | null;
          damdfe_storage_path?: string | null;
          data_autorizacao?: string | null;
          driver_id?: string | null;
          encerrado_at?: string | null;
          focus_id?: string | null;
          id?: string;
          justificativa_cancelamento?: string | null;
          municipio_descarga_ibge?: number | null;
          numero?: number;
          payload_sent?: Json;
          protocolo?: string | null;
          ref?: string;
          rejection_code?: string | null;
          rejection_msg?: string | null;
          response_received?: Json | null;
          retry_count?: number;
          serie?: number;
          status?: Database['public']['Enums']['mdfe_emission_status'];
          status_sefaz?: string | null;
          uf_fim?: string;
          uf_inicio?: string;
          updated_at?: string;
          vehicle_id?: string | null;
          xml_storage_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'mdfe_emissions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'mdfe_emissions_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: false;
            referencedRelation: 'drivers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mdfe_emissions_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      mdfe_sequence: {
        Row: {
          ambiente: Database['public']['Enums']['focus_ambiente'];
          last_numero: number;
          serie: number;
        };
        Insert: {
          ambiente: Database['public']['Enums']['focus_ambiente'];
          last_numero?: number;
          serie?: number;
        };
        Update: {
          ambiente?: Database['public']['Enums']['focus_ambiente'];
          last_numero?: number;
          serie?: number;
        };
        Relationships: [];
      };
      mirofish_recommendations: {
        Row: {
          action: string;
          created_at: string | null;
          id: string;
          priority: string | null;
          report_id: string;
          status: string | null;
          target_routes: string[] | null;
        };
        Insert: {
          action: string;
          created_at?: string | null;
          id?: string;
          priority?: string | null;
          report_id: string;
          status?: string | null;
          target_routes?: string[] | null;
        };
        Update: {
          action?: string;
          created_at?: string | null;
          id?: string;
          priority?: string | null;
          report_id?: string;
          status?: string | null;
          target_routes?: string[] | null;
        };
        Relationships: [
          {
            foreignKeyName: 'mirofish_recommendations_report_id_fkey';
            columns: ['report_id'];
            isOneToOne: false;
            referencedRelation: 'mirofish_reports';
            referencedColumns: ['id'];
          },
        ];
      };
      mirofish_reports: {
        Row: {
          created_at: string | null;
          generated_at: string | null;
          id: string;
          mirofish_report_id: string;
          raw_insights: Json | null;
          simulation_id: string;
          synced_at: string | null;
          title: string | null;
        };
        Insert: {
          created_at?: string | null;
          generated_at?: string | null;
          id?: string;
          mirofish_report_id: string;
          raw_insights?: Json | null;
          simulation_id: string;
          synced_at?: string | null;
          title?: string | null;
        };
        Update: {
          created_at?: string | null;
          generated_at?: string | null;
          id?: string;
          mirofish_report_id?: string;
          raw_insights?: Json | null;
          simulation_id?: string;
          synced_at?: string | null;
          title?: string | null;
        };
        Relationships: [];
      };
      mirofish_route_insights: {
        Row: {
          avg_ticket: number | null;
          avg_weight_kg: number | null;
          created_at: string | null;
          id: string;
          ntc_impact: number | null;
          report_id: string;
          revenue: number | null;
          route: string;
          volume_ctes: number | null;
        };
        Insert: {
          avg_ticket?: number | null;
          avg_weight_kg?: number | null;
          created_at?: string | null;
          id?: string;
          ntc_impact?: number | null;
          report_id: string;
          revenue?: number | null;
          route: string;
          volume_ctes?: number | null;
        };
        Update: {
          avg_ticket?: number | null;
          avg_weight_kg?: number | null;
          created_at?: string | null;
          id?: string;
          ntc_impact?: number | null;
          report_id?: string;
          revenue?: number | null;
          route?: string;
          volume_ctes?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'mirofish_route_insights_report_id_fkey';
            columns: ['report_id'];
            isOneToOne: false;
            referencedRelation: 'mirofish_reports';
            referencedColumns: ['id'];
          },
        ];
      };
      mirofish_shipper_insights: {
        Row: {
          avg_ticket: number | null;
          churn_risk: string | null;
          created_at: string | null;
          ctes: number | null;
          id: string;
          report_id: string;
          revenue: number | null;
          routes_count: number | null;
          shipper_id: string | null;
          shipper_name: string;
        };
        Insert: {
          avg_ticket?: number | null;
          churn_risk?: string | null;
          created_at?: string | null;
          ctes?: number | null;
          id?: string;
          report_id: string;
          revenue?: number | null;
          routes_count?: number | null;
          shipper_id?: string | null;
          shipper_name: string;
        };
        Update: {
          avg_ticket?: number | null;
          churn_risk?: string | null;
          created_at?: string | null;
          ctes?: number | null;
          id?: string;
          report_id?: string;
          revenue?: number | null;
          routes_count?: number | null;
          shipper_id?: string | null;
          shipper_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mirofish_shipper_insights_report_id_fkey';
            columns: ['report_id'];
            isOneToOne: false;
            referencedRelation: 'mirofish_reports';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mirofish_shipper_insights_shipper_id_fkey';
            columns: ['shipper_id'];
            isOneToOne: false;
            referencedRelation: 'shippers';
            referencedColumns: ['id'];
          },
        ];
      };
      news_items: {
        Row: {
          created_at: string | null;
          id: string;
          raw_snippet: string | null;
          relevance_score: number | null;
          source_name: string | null;
          source_type: string;
          source_url: string | null;
          summary: string;
          title: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          raw_snippet?: string | null;
          relevance_score?: number | null;
          source_name?: string | null;
          source_type: string;
          source_url?: string | null;
          summary: string;
          title: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          raw_snippet?: string | null;
          relevance_score?: number | null;
          source_name?: string | null;
          source_type?: string;
          source_url?: string | null;
          summary?: string;
          title?: string;
        };
        Relationships: [];
      };
      notification_logs: {
        Row: {
          channel: string;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          error_message: string | null;
          external_id: string | null;
          id: string;
          metadata: Json;
          recipient_email: string | null;
          recipient_phone: string | null;
          sent_at: string | null;
          status: string;
          template_key: string;
        };
        Insert: {
          channel: string;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          error_message?: string | null;
          external_id?: string | null;
          id?: string;
          metadata?: Json;
          recipient_email?: string | null;
          recipient_phone?: string | null;
          sent_at?: string | null;
          status?: string;
          template_key: string;
        };
        Update: {
          channel?: string;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          error_message?: string | null;
          external_id?: string | null;
          id?: string;
          metadata?: Json;
          recipient_email?: string | null;
          recipient_phone?: string | null;
          sent_at?: string | null;
          status?: string;
          template_key?: string;
        };
        Relationships: [];
      };
      notification_queue: {
        Row: {
          channel: string;
          created_at: string;
          error_message: string | null;
          external_id: string | null;
          id: string;
          payload: Json;
          sent_at: string | null;
          status: string;
          template: string;
        };
        Insert: {
          channel?: string;
          created_at?: string;
          error_message?: string | null;
          external_id?: string | null;
          id?: string;
          payload?: Json;
          sent_at?: string | null;
          status?: string;
          template: string;
        };
        Update: {
          channel?: string;
          created_at?: string;
          error_message?: string | null;
          external_id?: string | null;
          id?: string;
          payload?: Json;
          sent_at?: string | null;
          status?: string;
          template?: string;
        };
        Relationships: [];
      };
      notification_templates: {
        Row: {
          active: boolean;
          body_template: string;
          channel: string;
          created_at: string;
          html_template: string | null;
          id: string;
          is_meta_approved: boolean;
          key: string;
          meta_language_code: string | null;
          meta_template_name: string | null;
          meta_variables: Json | null;
          subject_template: string | null;
        };
        Insert: {
          active?: boolean;
          body_template: string;
          channel?: string;
          created_at?: string;
          html_template?: string | null;
          id?: string;
          is_meta_approved?: boolean;
          key: string;
          meta_language_code?: string | null;
          meta_template_name?: string | null;
          meta_variables?: Json | null;
          subject_template?: string | null;
        };
        Update: {
          active?: boolean;
          body_template?: string;
          channel?: string;
          created_at?: string;
          html_template?: string | null;
          id?: string;
          is_meta_approved?: boolean;
          key?: string;
          meta_language_code?: string | null;
          meta_template_name?: string | null;
          meta_variables?: Json | null;
          subject_template?: string | null;
        };
        Relationships: [];
      };
      ntc_cost_indices: {
        Row: {
          created_at: string;
          distance_km: number | null;
          id: string;
          index_type: string;
          index_value: number;
          period: string;
          pickup_km: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          distance_km?: number | null;
          id?: string;
          index_type: string;
          index_value: number;
          period: string;
          pickup_km?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          distance_km?: number | null;
          id?: string;
          index_type?: string;
          index_value?: number;
          period?: string;
          pickup_km?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      ntc_fuel_reference: {
        Row: {
          annual_variation_pct: number | null;
          created_at: string;
          diesel_price_liter: number;
          diesel_price_mg: number | null;
          diesel_price_pr: number | null;
          diesel_price_rj: number | null;
          diesel_price_sp: number | null;
          id: string;
          monthly_variation_pct: number | null;
          notes: string | null;
          reference_month: string;
          updated_at: string;
        };
        Insert: {
          annual_variation_pct?: number | null;
          created_at?: string;
          diesel_price_liter: number;
          diesel_price_mg?: number | null;
          diesel_price_pr?: number | null;
          diesel_price_rj?: number | null;
          diesel_price_sp?: number | null;
          id?: string;
          monthly_variation_pct?: number | null;
          notes?: string | null;
          reference_month: string;
          updated_at?: string;
        };
        Update: {
          annual_variation_pct?: number | null;
          created_at?: string;
          diesel_price_liter?: number;
          diesel_price_mg?: number | null;
          diesel_price_pr?: number | null;
          diesel_price_rj?: number | null;
          diesel_price_sp?: number | null;
          id?: string;
          monthly_variation_pct?: number | null;
          notes?: string | null;
          reference_month?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      occurrences: {
        Row: {
          created_at: string;
          created_by: string;
          description: string;
          id: string;
          order_id: string;
          resolved_at: string | null;
          resolved_by: string | null;
          severity: Database['public']['Enums']['occurrence_severity'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          description: string;
          id?: string;
          order_id: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: Database['public']['Enums']['occurrence_severity'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          description?: string;
          id?: string;
          order_id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: Database['public']['Enums']['occurrence_severity'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'occurrences_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'occurrences_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'occurrences_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders_rs_per_km';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'occurrences_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_order_payment_reconciliation';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'occurrences_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'occurrences_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_financial_details';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'occurrences_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'vw_order_risk_status';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'occurrences_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      operational_reports: {
        Row: {
          analysis: Json | null;
          created_at: string;
          data: Json;
          id: string;
          report_date: string;
          report_type: string;
          sent_at: string | null;
          sent_via: string | null;
          summary_text: string | null;
        };
        Insert: {
          analysis?: Json | null;
          created_at?: string;
          data?: Json;
          id?: string;
          report_date: string;
          report_type?: string;
          sent_at?: string | null;
          sent_via?: string | null;
          summary_text?: string | null;
        };
        Update: {
          analysis?: Json | null;
          created_at?: string;
          data?: Json;
          id?: string;
          report_date?: string;
          report_type?: string;
          sent_at?: string | null;
          sent_via?: string | null;
          summary_text?: string | null;
        };
        Relationships: [];
      };
      order_gris_services: {
        Row: {
          amount_previsto: number | null;
          amount_real: number | null;
          created_at: string;
          gris_service_id: string;
          id: string;
          order_id: string;
          updated_at: string;
        };
        Insert: {
          amount_previsto?: number | null;
          amount_real?: number | null;
          created_at?: string;
          gris_service_id: string;
          id?: string;
          order_id: string;
          updated_at?: string;
        };
        Update: {
          amount_previsto?: number | null;
          amount_real?: number | null;
          created_at?: string;
          gris_service_id?: string;
          id?: string;
          order_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_gris_services_gris_service_id_fkey';
            columns: ['gris_service_id'];
            isOneToOne: false;
            referencedRelation: 'gris_services';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_gris_services_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_gris_services_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders_rs_per_km';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'order_gris_services_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_order_payment_reconciliation';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'order_gris_services_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'order_gris_services_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_financial_details';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'order_gris_services_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'vw_order_risk_status';
            referencedColumns: ['order_id'];
          },
        ];
      };
      orders: {
        Row: {
          additional_shippers: Json;
          assigned_to: string | null;
          cargo_type: string | null;
          cargo_value: number | null;
          carreteiro_antt: number | null;
          carreteiro_real: number | null;
          carrier_advance_date: string | null;
          carrier_balance_date: string | null;
          carrier_payment_method: string | null;
          carrier_payment_term_id: string | null;
          ciot_number: string | null;
          ciot_status: string | null;
          client_id: string | null;
          client_name: string;
          created_at: string;
          created_by: string;
          descarga_real: number | null;
          destination: string;
          destination_cep: string | null;
          driver_id: string | null;
          driver_name: string | null;
          driver_phone: string | null;
          driver_cnh: string | null;
          driver_antt: string | null;
          eta: string | null;
          freight_modality: string | null;
          freight_type: string | null;
          has_analise_gr: boolean | null;
          has_antt: boolean | null;
          has_antt_motorista: boolean | null;
          has_cnh: boolean | null;
          has_comp_residencia: boolean | null;
          has_comprovante_descarga: boolean | null;
          has_crlv: boolean | null;
          has_cte: boolean;
          has_doc_rota: boolean | null;
          has_gr: boolean | null;
          has_mdf: boolean | null;
          has_mdfe: boolean | null;
          has_nfe: boolean;
          has_pod: boolean;
          has_vpo: boolean | null;
          id: string;
          km_distance: number | null;
          notes: string | null;
          origin: string;
          origin_cep: string | null;
          os_number: string;
          owner_name: string | null;
          owner_phone: string | null;
          payment_method: string | null;
          payment_term_id: string | null;
          pedagio_charge_type: Database['public']['Enums']['pedagio_charge_type'] | null;
          pedagio_debitado_no_cte: boolean | null;
          pedagio_real: number | null;
          pickup_date: string | null;
          price_table_id: string | null;
          pricing_breakdown: Json | null;
          quote_id: string | null;
          risk_evaluation_id: string | null;
          shipper_id: string | null;
          shipper_name: string | null;
          stage: Database['public']['Enums']['order_stage'];
          toll_value: number | null;
          trip_id: string | null;
          updated_at: string;
          value: number;
          vehicle_brand: string | null;
          vehicle_model: string | null;
          vehicle_plate: string | null;
          vehicle_type_id: string | null;
          vehicle_type_name: string | null;
          volume: number | null;
          waiting_time_cost: number | null;
          waiting_time_hours: number | null;
          weight: number | null;
        };
        Insert: {
          additional_shippers?: Json;
          assigned_to?: string | null;
          cargo_type?: string | null;
          cargo_value?: number | null;
          carreteiro_antt?: number | null;
          carreteiro_real?: number | null;
          carrier_advance_date?: string | null;
          carrier_balance_date?: string | null;
          carrier_payment_method?: string | null;
          carrier_payment_term_id?: string | null;
          ciot_number?: string | null;
          ciot_status?: string | null;
          client_id?: string | null;
          client_name: string;
          created_at?: string;
          created_by: string;
          descarga_real?: number | null;
          destination: string;
          destination_cep?: string | null;
          driver_id?: string | null;
          driver_name?: string | null;
          driver_phone?: string | null;
          driver_cnh?: string | null;
          driver_antt?: string | null;
          eta?: string | null;
          freight_modality?: string | null;
          freight_type?: string | null;
          has_analise_gr?: boolean | null;
          has_antt?: boolean | null;
          has_antt_motorista?: boolean | null;
          has_cnh?: boolean | null;
          has_comp_residencia?: boolean | null;
          has_comprovante_descarga?: boolean | null;
          has_crlv?: boolean | null;
          has_cte?: boolean;
          has_doc_rota?: boolean | null;
          has_gr?: boolean | null;
          has_mdf?: boolean | null;
          has_mdfe?: boolean | null;
          has_nfe?: boolean;
          has_pod?: boolean;
          has_vpo?: boolean | null;
          id?: string;
          km_distance?: number | null;
          notes?: string | null;
          origin: string;
          origin_cep?: string | null;
          os_number: string;
          owner_name?: string | null;
          owner_phone?: string | null;
          payment_method?: string | null;
          payment_term_id?: string | null;
          pedagio_charge_type?: Database['public']['Enums']['pedagio_charge_type'] | null;
          pedagio_debitado_no_cte?: boolean | null;
          pedagio_real?: number | null;
          pickup_date?: string | null;
          price_table_id?: string | null;
          pricing_breakdown?: Json | null;
          quote_id?: string | null;
          risk_evaluation_id?: string | null;
          shipper_id?: string | null;
          shipper_name?: string | null;
          stage?: Database['public']['Enums']['order_stage'];
          toll_value?: number | null;
          trip_id?: string | null;
          updated_at?: string;
          value?: number;
          vehicle_brand?: string | null;
          vehicle_model?: string | null;
          vehicle_plate?: string | null;
          vehicle_type_id?: string | null;
          vehicle_type_name?: string | null;
          volume?: number | null;
          waiting_time_cost?: number | null;
          waiting_time_hours?: number | null;
          weight?: number | null;
        };
        Update: {
          additional_shippers?: Json;
          assigned_to?: string | null;
          cargo_type?: string | null;
          cargo_value?: number | null;
          carreteiro_antt?: number | null;
          carreteiro_real?: number | null;
          carrier_advance_date?: string | null;
          carrier_balance_date?: string | null;
          carrier_payment_method?: string | null;
          carrier_payment_term_id?: string | null;
          ciot_number?: string | null;
          ciot_status?: string | null;
          client_id?: string | null;
          client_name?: string;
          created_at?: string;
          created_by?: string;
          descarga_real?: number | null;
          destination?: string;
          destination_cep?: string | null;
          driver_id?: string | null;
          driver_name?: string | null;
          driver_phone?: string | null;
          driver_cnh?: string | null;
          driver_antt?: string | null;
          eta?: string | null;
          freight_modality?: string | null;
          freight_type?: string | null;
          has_analise_gr?: boolean | null;
          has_antt?: boolean | null;
          has_antt_motorista?: boolean | null;
          has_cnh?: boolean | null;
          has_comp_residencia?: boolean | null;
          has_comprovante_descarga?: boolean | null;
          has_crlv?: boolean | null;
          has_cte?: boolean;
          has_doc_rota?: boolean | null;
          has_gr?: boolean | null;
          has_mdf?: boolean | null;
          has_mdfe?: boolean | null;
          has_nfe?: boolean;
          has_pod?: boolean;
          has_vpo?: boolean | null;
          id?: string;
          km_distance?: number | null;
          notes?: string | null;
          origin?: string;
          origin_cep?: string | null;
          os_number?: string;
          owner_name?: string | null;
          owner_phone?: string | null;
          payment_method?: string | null;
          payment_term_id?: string | null;
          pedagio_charge_type?: Database['public']['Enums']['pedagio_charge_type'] | null;
          pedagio_debitado_no_cte?: boolean | null;
          pedagio_real?: number | null;
          pickup_date?: string | null;
          price_table_id?: string | null;
          pricing_breakdown?: Json | null;
          quote_id?: string | null;
          risk_evaluation_id?: string | null;
          shipper_id?: string | null;
          shipper_name?: string | null;
          stage?: Database['public']['Enums']['order_stage'];
          toll_value?: number | null;
          trip_id?: string | null;
          updated_at?: string;
          value?: number;
          vehicle_brand?: string | null;
          vehicle_model?: string | null;
          vehicle_plate?: string | null;
          vehicle_type_id?: string | null;
          vehicle_type_name?: string | null;
          volume?: number | null;
          waiting_time_cost?: number | null;
          waiting_time_hours?: number | null;
          weight?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'orders_carrier_payment_term_id_fkey';
            columns: ['carrier_payment_term_id'];
            isOneToOne: false;
            referencedRelation: 'payment_terms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'orders_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: false;
            referencedRelation: 'drivers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_payment_term_id_fkey';
            columns: ['payment_term_id'];
            isOneToOne: false;
            referencedRelation: 'payment_terms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_price_table_id_fkey';
            columns: ['price_table_id'];
            isOneToOne: false;
            referencedRelation: 'price_tables';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'orders_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_payment_reconciliation';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'orders_shipper_id_fkey';
            columns: ['shipper_id'];
            isOneToOne: false;
            referencedRelation: 'shippers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trip_financial_summary';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_payment_reconciliation';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'vw_trip_risk_summary';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'orders_vehicle_type_id_fkey';
            columns: ['vehicle_type_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_types';
            referencedColumns: ['id'];
          },
        ];
      };
      owners: {
        Row: {
          active: boolean;
          address: string | null;
          city: string | null;
          cpf_cnpj: string | null;
          cpf_cnpj_mask: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          rg: string | null;
          rg_emitter: string | null;
          rntrc: string | null;
          state: string | null;
          tipo_proprietario: number | null;
          uf: string | null;
          updated_at: string;
          zip_code: string | null;
          zip_code_mask: string | null;
        };
        Insert: {
          active?: boolean;
          address?: string | null;
          city?: string | null;
          cpf_cnpj?: string | null;
          cpf_cnpj_mask?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          rg?: string | null;
          rg_emitter?: string | null;
          rntrc?: string | null;
          state?: string | null;
          tipo_proprietario?: number | null;
          uf?: string | null;
          updated_at?: string;
          zip_code?: string | null;
          zip_code_mask?: string | null;
        };
        Update: {
          active?: boolean;
          address?: string | null;
          city?: string | null;
          cpf_cnpj?: string | null;
          cpf_cnpj_mask?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          rg?: string | null;
          rg_emitter?: string | null;
          rntrc?: string | null;
          state?: string | null;
          tipo_proprietario?: number | null;
          uf?: string | null;
          updated_at?: string;
          zip_code?: string | null;
          zip_code_mask?: string | null;
        };
        Relationships: [];
      };
      payment_proofs: {
        Row: {
          amount: number | null;
          created_at: string;
          document_id: string;
          expected_amount: number | null;
          extracted_fields: Json;
          extraction_confidence: number | null;
          id: string;
          method: string | null;
          order_id: string;
          paid_at: string | null;
          payee_document: string | null;
          payee_name: string | null;
          proof_type: string;
          status: string;
          transaction_id: string | null;
          trip_id: string | null;
          updated_at: string;
        };
        Insert: {
          amount?: number | null;
          created_at?: string;
          document_id: string;
          expected_amount?: number | null;
          extracted_fields?: Json;
          extraction_confidence?: number | null;
          id?: string;
          method?: string | null;
          order_id: string;
          paid_at?: string | null;
          payee_document?: string | null;
          payee_name?: string | null;
          proof_type: string;
          status?: string;
          transaction_id?: string | null;
          trip_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number | null;
          created_at?: string;
          document_id?: string;
          expected_amount?: number | null;
          extracted_fields?: Json;
          extraction_confidence?: number | null;
          id?: string;
          method?: string | null;
          order_id?: string;
          paid_at?: string | null;
          payee_document?: string | null;
          payee_name?: string | null;
          proof_type?: string;
          status?: string;
          transaction_id?: string | null;
          trip_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_proofs_document_id_fkey';
            columns: ['document_id'];
            isOneToOne: true;
            referencedRelation: 'documents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payment_proofs_document_id_fkey';
            columns: ['document_id'];
            isOneToOne: true;
            referencedRelation: 'order_documents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payment_proofs_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payment_proofs_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders_rs_per_km';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'payment_proofs_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_order_payment_reconciliation';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'payment_proofs_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'payment_proofs_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_financial_details';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'payment_proofs_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'vw_order_risk_status';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'payment_proofs_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trip_financial_summary';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'payment_proofs_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payment_proofs_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_payment_reconciliation';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'payment_proofs_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'vw_trip_risk_summary';
            referencedColumns: ['trip_id'];
          },
        ];
      };
      payment_terms: {
        Row: {
          active: boolean;
          adjustment_percent: number;
          advance_percent: number | null;
          code: string;
          created_at: string;
          created_by: string | null;
          days: number;
          id: string;
          name: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          active?: boolean;
          adjustment_percent?: number;
          advance_percent?: number | null;
          code: string;
          created_at?: string;
          created_by?: string | null;
          days: number;
          id?: string;
          name: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          active?: boolean;
          adjustment_percent?: number;
          advance_percent?: number | null;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          days?: number;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      petrobras_diesel_prices: {
        Row: {
          fetched_at: string;
          id: string;
          parcela_biodiesel: number | null;
          parcela_distribuicao: number | null;
          parcela_icms: number | null;
          parcela_impostos_federais: number | null;
          parcela_petrobras: number | null;
          periodo_coleta: string | null;
          preco_medio: number;
          source: string;
          uf: string;
        };
        Insert: {
          fetched_at?: string;
          id?: string;
          parcela_biodiesel?: number | null;
          parcela_distribuicao?: number | null;
          parcela_icms?: number | null;
          parcela_impostos_federais?: number | null;
          parcela_petrobras?: number | null;
          periodo_coleta?: string | null;
          preco_medio: number;
          source?: string;
          uf: string;
        };
        Update: {
          fetched_at?: string;
          id?: string;
          parcela_biodiesel?: number | null;
          parcela_distribuicao?: number | null;
          parcela_icms?: number | null;
          parcela_impostos_federais?: number | null;
          parcela_petrobras?: number | null;
          periodo_coleta?: string | null;
          preco_medio?: number;
          source?: string;
          uf?: string;
        };
        Relationships: [];
      };
      price_table_rows: {
        Row: {
          ad_valorem_percent: number | null;
          cost_per_kg: number | null;
          cost_per_ton: number | null;
          cost_value_percent: number | null;
          created_at: string;
          gris_percent: number | null;
          id: string;
          km_from: number;
          km_to: number;
          price_table_id: string;
          toll_percent: number | null;
          tso_percent: number | null;
          user_id: string | null;
        };
        Insert: {
          ad_valorem_percent?: number | null;
          cost_per_kg?: number | null;
          cost_per_ton?: number | null;
          cost_value_percent?: number | null;
          created_at?: string;
          gris_percent?: number | null;
          id?: string;
          km_from: number;
          km_to: number;
          price_table_id: string;
          toll_percent?: number | null;
          tso_percent?: number | null;
          user_id?: string | null;
        };
        Update: {
          ad_valorem_percent?: number | null;
          cost_per_kg?: number | null;
          cost_per_ton?: number | null;
          cost_value_percent?: number | null;
          created_at?: string;
          gris_percent?: number | null;
          id?: string;
          km_from?: number;
          km_to?: number;
          price_table_id?: string;
          toll_percent?: number | null;
          tso_percent?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'price_table_rows_price_table_id_fkey';
            columns: ['price_table_id'];
            isOneToOne: false;
            referencedRelation: 'price_tables';
            referencedColumns: ['id'];
          },
        ];
      };
      price_tables: {
        Row: {
          active: boolean;
          ad_valorem_lotacao_percent: number | null;
          created_at: string;
          created_by: string | null;
          id: string;
          methodology: string;
          modality: string;
          name: string;
          updated_at: string;
          user_id: string | null;
          valid_from: string | null;
          valid_until: string | null;
          version: number;
        };
        Insert: {
          active?: boolean;
          ad_valorem_lotacao_percent?: number | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          methodology: string;
          modality: string;
          name: string;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          version?: number;
        };
        Update: {
          active?: boolean;
          ad_valorem_lotacao_percent?: number | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          methodology?: string;
          modality?: string;
          name?: string;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'price_tables_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      pricing_parameters: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          key: string;
          unit: string | null;
          updated_at: string;
          user_id: string | null;
          valid_from: string | null;
          valid_until: string | null;
          value: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          key: string;
          unit?: string | null;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          value: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          key?: string;
          unit?: string | null;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          value?: number;
        };
        Relationships: [];
      };
      pricing_rules_config: {
        Row: {
          category: Database['public']['Enums']['pricing_rule_category'];
          id: string;
          is_active: boolean | null;
          key: string;
          label: string;
          max_value: number | null;
          metadata: Json | null;
          methodology: string;
          min_value: number | null;
          updated_at: string | null;
          value: number;
          value_type: Database['public']['Enums']['pricing_rule_value_type'];
          vehicle_type_id: string | null;
        };
        Insert: {
          category: Database['public']['Enums']['pricing_rule_category'];
          id?: string;
          is_active?: boolean | null;
          key: string;
          label: string;
          max_value?: number | null;
          metadata?: Json | null;
          methodology: string;
          min_value?: number | null;
          updated_at?: string | null;
          value: number;
          value_type: Database['public']['Enums']['pricing_rule_value_type'];
          vehicle_type_id?: string | null;
        };
        Update: {
          category?: Database['public']['Enums']['pricing_rule_category'];
          id?: string;
          is_active?: boolean | null;
          key?: string;
          label?: string;
          max_value?: number | null;
          metadata?: Json | null;
          methodology?: string;
          min_value?: number | null;
          updated_at?: string | null;
          value?: number;
          value_type?: Database['public']['Enums']['pricing_rule_value_type'];
          vehicle_type_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'pricing_rules_config_vehicle_type_id_fkey';
            columns: ['vehicle_type_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_types';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          perfil: Database['public']['Enums']['user_profile'] | null;
          phone: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name: string;
          id?: string;
          perfil?: Database['public']['Enums']['user_profile'] | null;
          phone?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          perfil?: Database['public']['Enums']['user_profile'] | null;
          phone?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      quote_contracts: {
        Row: {
          created_at: string;
          generated_at: string;
          generated_by: string | null;
          id: string;
          pdf_file_name: string | null;
          pdf_size_bytes: number | null;
          pdf_storage_path: string;
          quote_id: string;
          signature_envelope_id: string | null;
          signature_metadata: Json;
          signature_provider: string | null;
          signature_status: string;
          signed_at: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          generated_at?: string;
          generated_by?: string | null;
          id?: string;
          pdf_file_name?: string | null;
          pdf_size_bytes?: number | null;
          pdf_storage_path: string;
          quote_id: string;
          signature_envelope_id?: string | null;
          signature_metadata?: Json;
          signature_provider?: string | null;
          signature_status?: string;
          signed_at?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          generated_at?: string;
          generated_by?: string | null;
          id?: string;
          pdf_file_name?: string | null;
          pdf_size_bytes?: number | null;
          pdf_storage_path?: string;
          quote_id?: string;
          signature_envelope_id?: string | null;
          signature_metadata?: Json;
          signature_provider?: string | null;
          signature_status?: string;
          signed_at?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'quote_contracts_generated_by_fkey';
            columns: ['generated_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'quote_contracts_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quote_contracts_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'quote_contracts_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_payment_reconciliation';
            referencedColumns: ['quote_id'];
          },
        ];
      };
      quote_payment_proofs: {
        Row: {
          amount: number | null;
          created_at: string;
          delta_reason: string | null;
          document_id: string;
          expected_amount: number | null;
          extracted_fields: Json;
          id: string;
          proof_type: string;
          quote_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount?: number | null;
          created_at?: string;
          delta_reason?: string | null;
          document_id: string;
          expected_amount?: number | null;
          extracted_fields?: Json;
          id?: string;
          proof_type: string;
          quote_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number | null;
          created_at?: string;
          delta_reason?: string | null;
          document_id?: string;
          expected_amount?: number | null;
          extracted_fields?: Json;
          id?: string;
          proof_type?: string;
          quote_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'quote_payment_proofs_document_id_fkey';
            columns: ['document_id'];
            isOneToOne: true;
            referencedRelation: 'documents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quote_payment_proofs_document_id_fkey';
            columns: ['document_id'];
            isOneToOne: true;
            referencedRelation: 'order_documents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quote_payment_proofs_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quote_payment_proofs_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'quote_payment_proofs_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_payment_reconciliation';
            referencedColumns: ['quote_id'];
          },
        ];
      };
      quote_route_stops: {
        Row: {
          cep: string | null;
          city_uf: string | null;
          cnpj: string | null;
          created_at: string;
          id: string;
          label: string | null;
          metadata: Json | null;
          name: string | null;
          planned_km_from_prev: number | null;
          quote_id: string;
          sequence: number;
          stop_type: Database['public']['Enums']['route_stop_type'];
          updated_at: string;
        };
        Insert: {
          cep?: string | null;
          city_uf?: string | null;
          cnpj?: string | null;
          created_at?: string;
          id?: string;
          label?: string | null;
          metadata?: Json | null;
          name?: string | null;
          planned_km_from_prev?: number | null;
          quote_id: string;
          sequence?: number;
          stop_type?: Database['public']['Enums']['route_stop_type'];
          updated_at?: string;
        };
        Update: {
          cep?: string | null;
          city_uf?: string | null;
          cnpj?: string | null;
          created_at?: string;
          id?: string;
          label?: string | null;
          metadata?: Json | null;
          name?: string | null;
          planned_km_from_prev?: number | null;
          quote_id?: string;
          sequence?: number;
          stop_type?: Database['public']['Enums']['route_stop_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'quote_route_stops_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quote_route_stops_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'quote_route_stops_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_payment_reconciliation';
            referencedColumns: ['quote_id'];
          },
        ];
      };
      quotes: {
        Row: {
          additional_shippers: Json;
          advance_due_date: string | null;
          approval_metadata: Json | null;
          approval_status: string | null;
          assigned_to: string | null;
          balance_due_date: string | null;
          billable_weight: number | null;
          cargo_type: string | null;
          cargo_value: number | null;
          client_email: string | null;
          client_id: string | null;
          client_name: string;
          conditional_fees_breakdown: Json | null;
          created_at: string;
          created_by: string;
          cubage_weight: number | null;
          delivery_conditions_selected: Json | null;
          delivery_notes: string | null;
          destination: string;
          destination_cep: string | null;
          destination_ibge: number | null;
          destination_uf: string | null;
          discharge_checklist_selected: Json | null;
          discount_value: number | null;
          email_sent: boolean;
          email_sent_at: string | null;
          estimated_loading_date: string | null;
          freight_modality: string | null;
          freight_type: string | null;
          id: string;
          is_legacy: boolean;
          km_distance: number | null;
          nfe_keys: string[] | null;
          notes: string | null;
          origin: string;
          origin_cep: string | null;
          origin_ibge: number | null;
          origin_uf: string | null;
          payment_method: string | null;
          payment_term_id: string | null;
          price_table_id: string | null;
          pricing_breakdown: Json | null;
          quote_code: string | null;
          shipper_email: string | null;
          shipper_id: string | null;
          shipper_name: string | null;
          stage: Database['public']['Enums']['quote_stage'];
          tac_percent: number | null;
          tags: string[] | null;
          toll_value: number | null;
          tomador_tipo: number | null;
          updated_at: string;
          validity_date: string | null;
          value: number;
          vehicle_type_id: string | null;
          volume: number | null;
          waiting_time_cost: number | null;
          weight: number | null;
        };
        Insert: {
          additional_shippers?: Json;
          advance_due_date?: string | null;
          approval_metadata?: Json | null;
          approval_status?: string | null;
          assigned_to?: string | null;
          balance_due_date?: string | null;
          billable_weight?: number | null;
          cargo_type?: string | null;
          cargo_value?: number | null;
          client_email?: string | null;
          client_id?: string | null;
          client_name: string;
          conditional_fees_breakdown?: Json | null;
          created_at?: string;
          created_by: string;
          cubage_weight?: number | null;
          delivery_conditions_selected?: Json | null;
          delivery_notes?: string | null;
          destination: string;
          destination_cep?: string | null;
          destination_ibge?: number | null;
          destination_uf?: string | null;
          discharge_checklist_selected?: Json | null;
          discount_value?: number | null;
          email_sent?: boolean;
          email_sent_at?: string | null;
          estimated_loading_date?: string | null;
          freight_modality?: string | null;
          freight_type?: string | null;
          id?: string;
          is_legacy?: boolean;
          km_distance?: number | null;
          nfe_keys?: string[] | null;
          notes?: string | null;
          origin: string;
          origin_cep?: string | null;
          origin_ibge?: number | null;
          origin_uf?: string | null;
          payment_method?: string | null;
          payment_term_id?: string | null;
          price_table_id?: string | null;
          pricing_breakdown?: Json | null;
          quote_code?: string | null;
          shipper_email?: string | null;
          shipper_id?: string | null;
          shipper_name?: string | null;
          stage?: Database['public']['Enums']['quote_stage'];
          tac_percent?: number | null;
          tags?: string[] | null;
          toll_value?: number | null;
          tomador_tipo?: number | null;
          updated_at?: string;
          validity_date?: string | null;
          value?: number;
          vehicle_type_id?: string | null;
          volume?: number | null;
          waiting_time_cost?: number | null;
          weight?: number | null;
        };
        Update: {
          additional_shippers?: Json;
          advance_due_date?: string | null;
          approval_metadata?: Json | null;
          approval_status?: string | null;
          assigned_to?: string | null;
          balance_due_date?: string | null;
          billable_weight?: number | null;
          cargo_type?: string | null;
          cargo_value?: number | null;
          client_email?: string | null;
          client_id?: string | null;
          client_name?: string;
          conditional_fees_breakdown?: Json | null;
          created_at?: string;
          created_by?: string;
          cubage_weight?: number | null;
          delivery_conditions_selected?: Json | null;
          delivery_notes?: string | null;
          destination?: string;
          destination_cep?: string | null;
          destination_ibge?: number | null;
          destination_uf?: string | null;
          discharge_checklist_selected?: Json | null;
          discount_value?: number | null;
          email_sent?: boolean;
          email_sent_at?: string | null;
          estimated_loading_date?: string | null;
          freight_modality?: string | null;
          freight_type?: string | null;
          id?: string;
          is_legacy?: boolean;
          km_distance?: number | null;
          nfe_keys?: string[] | null;
          notes?: string | null;
          origin?: string;
          origin_cep?: string | null;
          origin_ibge?: number | null;
          origin_uf?: string | null;
          payment_method?: string | null;
          payment_term_id?: string | null;
          price_table_id?: string | null;
          pricing_breakdown?: Json | null;
          quote_code?: string | null;
          shipper_email?: string | null;
          shipper_id?: string | null;
          shipper_name?: string | null;
          stage?: Database['public']['Enums']['quote_stage'];
          tac_percent?: number | null;
          tags?: string[] | null;
          toll_value?: number | null;
          tomador_tipo?: number | null;
          updated_at?: string;
          validity_date?: string | null;
          value?: number;
          vehicle_type_id?: string | null;
          volume?: number | null;
          waiting_time_cost?: number | null;
          weight?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'quotes_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'quotes_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quotes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'quotes_payment_term_id_fkey';
            columns: ['payment_term_id'];
            isOneToOne: false;
            referencedRelation: 'payment_terms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quotes_price_table_id_fkey';
            columns: ['price_table_id'];
            isOneToOne: false;
            referencedRelation: 'price_tables';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quotes_shipper_id_fkey';
            columns: ['shipper_id'];
            isOneToOne: false;
            referencedRelation: 'shippers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quotes_vehicle_type_id_fkey';
            columns: ['vehicle_type_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_types';
            referencedColumns: ['id'];
          },
        ];
      };
      regulatory_updates: {
        Row: {
          action_required: boolean;
          ai_analysis: Json | null;
          analysis: Json | null;
          created_at: string;
          id: string;
          impact_areas: string[];
          notified: boolean;
          published_at: string | null;
          recommendation: string | null;
          relevance_score: number | null;
          source: string;
          source_name: string | null;
          source_url: string | null;
          summary: string | null;
          title: string;
          url: string | null;
        };
        Insert: {
          action_required?: boolean;
          ai_analysis?: Json | null;
          analysis?: Json | null;
          created_at?: string;
          id?: string;
          impact_areas?: string[];
          notified?: boolean;
          published_at?: string | null;
          recommendation?: string | null;
          relevance_score?: number | null;
          source: string;
          source_name?: string | null;
          source_url?: string | null;
          summary?: string | null;
          title: string;
          url?: string | null;
        };
        Update: {
          action_required?: boolean;
          ai_analysis?: Json | null;
          analysis?: Json | null;
          created_at?: string;
          id?: string;
          impact_areas?: string[];
          notified?: boolean;
          published_at?: string | null;
          recommendation?: string | null;
          relevance_score?: number | null;
          source?: string;
          source_name?: string | null;
          source_url?: string | null;
          summary?: string | null;
          title?: string;
          url?: string | null;
        };
        Relationships: [];
      };
      risk_costs: {
        Row: {
          apportioned: boolean | null;
          created_at: string | null;
          evaluation_id: string | null;
          id: string;
          order_id: string | null;
          quantity: number | null;
          scope: string;
          service_code: string;
          service_id: string;
          total_cost: number;
          trip_id: string | null;
          unit_cost: number;
          updated_at: string | null;
        };
        Insert: {
          apportioned?: boolean | null;
          created_at?: string | null;
          evaluation_id?: string | null;
          id?: string;
          order_id?: string | null;
          quantity?: number | null;
          scope: string;
          service_code: string;
          service_id: string;
          total_cost: number;
          trip_id?: string | null;
          unit_cost: number;
          updated_at?: string | null;
        };
        Update: {
          apportioned?: boolean | null;
          created_at?: string | null;
          evaluation_id?: string | null;
          id?: string;
          order_id?: string | null;
          quantity?: number | null;
          scope?: string;
          service_code?: string;
          service_id?: string;
          total_cost?: number;
          trip_id?: string | null;
          unit_cost?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'risk_costs_evaluation_id_fkey';
            columns: ['evaluation_id'];
            isOneToOne: false;
            referencedRelation: 'risk_evaluations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'risk_costs_evaluation_id_fkey';
            columns: ['evaluation_id'];
            isOneToOne: false;
            referencedRelation: 'vw_order_risk_status';
            referencedColumns: ['evaluation_id'];
          },
          {
            foreignKeyName: 'risk_costs_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'risk_costs_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders_rs_per_km';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'risk_costs_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_order_payment_reconciliation';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'risk_costs_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'risk_costs_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_financial_details';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'risk_costs_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'vw_order_risk_status';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'risk_costs_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'risk_services_catalog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'risk_costs_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trip_financial_summary';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'risk_costs_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'risk_costs_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_payment_reconciliation';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'risk_costs_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'vw_trip_risk_summary';
            referencedColumns: ['trip_id'];
          },
        ];
      };
      risk_evaluations: {
        Row: {
          approval_request_id: string | null;
          cargo_value_evaluated: number | null;
          created_at: string | null;
          criticality: Database['public']['Enums']['risk_criticality'];
          entity_id: string;
          entity_type: string;
          evaluated_at: string | null;
          evaluated_by: string | null;
          evaluation_notes: string | null;
          expires_at: string | null;
          id: string;
          policy_id: string | null;
          policy_rules_applied: string[] | null;
          requirements: Json;
          requirements_met: Json | null;
          route_municipalities: string[] | null;
          status: Database['public']['Enums']['risk_evaluation_status'];
          updated_at: string | null;
        };
        Insert: {
          approval_request_id?: string | null;
          cargo_value_evaluated?: number | null;
          created_at?: string | null;
          criticality?: Database['public']['Enums']['risk_criticality'];
          entity_id: string;
          entity_type: string;
          evaluated_at?: string | null;
          evaluated_by?: string | null;
          evaluation_notes?: string | null;
          expires_at?: string | null;
          id?: string;
          policy_id?: string | null;
          policy_rules_applied?: string[] | null;
          requirements?: Json;
          requirements_met?: Json | null;
          route_municipalities?: string[] | null;
          status?: Database['public']['Enums']['risk_evaluation_status'];
          updated_at?: string | null;
        };
        Update: {
          approval_request_id?: string | null;
          cargo_value_evaluated?: number | null;
          created_at?: string | null;
          criticality?: Database['public']['Enums']['risk_criticality'];
          entity_id?: string;
          entity_type?: string;
          evaluated_at?: string | null;
          evaluated_by?: string | null;
          evaluation_notes?: string | null;
          expires_at?: string | null;
          id?: string;
          policy_id?: string | null;
          policy_rules_applied?: string[] | null;
          requirements?: Json;
          requirements_met?: Json | null;
          route_municipalities?: string[] | null;
          status?: Database['public']['Enums']['risk_evaluation_status'];
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'risk_evaluations_evaluated_by_fkey';
            columns: ['evaluated_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'risk_evaluations_policy_id_fkey';
            columns: ['policy_id'];
            isOneToOne: false;
            referencedRelation: 'risk_policies';
            referencedColumns: ['id'];
          },
        ];
      };
      risk_evidence: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          document_id: string | null;
          evaluation_id: string;
          evidence_type: string;
          expires_at: string | null;
          id: string;
          notes: string | null;
          payload: Json;
          status: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          document_id?: string | null;
          evaluation_id: string;
          evidence_type: string;
          expires_at?: string | null;
          id?: string;
          notes?: string | null;
          payload?: Json;
          status?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          document_id?: string | null;
          evaluation_id?: string;
          evidence_type?: string;
          expires_at?: string | null;
          id?: string;
          notes?: string | null;
          payload?: Json;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'risk_evidence_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'risk_evidence_document_id_fkey';
            columns: ['document_id'];
            isOneToOne: false;
            referencedRelation: 'documents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'risk_evidence_document_id_fkey';
            columns: ['document_id'];
            isOneToOne: false;
            referencedRelation: 'order_documents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'risk_evidence_evaluation_id_fkey';
            columns: ['evaluation_id'];
            isOneToOne: false;
            referencedRelation: 'risk_evaluations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'risk_evidence_evaluation_id_fkey';
            columns: ['evaluation_id'];
            isOneToOne: false;
            referencedRelation: 'vw_order_risk_status';
            referencedColumns: ['evaluation_id'];
          },
        ];
      };
      risk_policies: {
        Row: {
          code: string;
          coverage_limit: number | null;
          created_at: string | null;
          created_by: string | null;
          deductible: number | null;
          document_url: string | null;
          endorsement: string | null;
          id: string;
          insurer: string | null;
          is_active: boolean | null;
          metadata: Json | null;
          name: string;
          policy_type: string;
          risk_manager: string | null;
          updated_at: string | null;
          valid_from: string;
          valid_until: string | null;
        };
        Insert: {
          code: string;
          coverage_limit?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          deductible?: number | null;
          document_url?: string | null;
          endorsement?: string | null;
          id?: string;
          insurer?: string | null;
          is_active?: boolean | null;
          metadata?: Json | null;
          name: string;
          policy_type: string;
          risk_manager?: string | null;
          updated_at?: string | null;
          valid_from: string;
          valid_until?: string | null;
        };
        Update: {
          code?: string;
          coverage_limit?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          deductible?: number | null;
          document_url?: string | null;
          endorsement?: string | null;
          id?: string;
          insurer?: string | null;
          is_active?: boolean | null;
          metadata?: Json | null;
          name?: string;
          policy_type?: string;
          risk_manager?: string | null;
          updated_at?: string | null;
          valid_from?: string;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'risk_policies_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      risk_policy_rules: {
        Row: {
          created_at: string | null;
          criticality: Database['public']['Enums']['risk_criticality'];
          criticality_boost: number | null;
          description: string | null;
          id: string;
          is_active: boolean | null;
          policy_id: string;
          requirements: Json;
          sort_order: number | null;
          trigger_config: Json;
          trigger_type: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          criticality: Database['public']['Enums']['risk_criticality'];
          criticality_boost?: number | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          policy_id: string;
          requirements?: Json;
          sort_order?: number | null;
          trigger_config: Json;
          trigger_type: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          criticality?: Database['public']['Enums']['risk_criticality'];
          criticality_boost?: number | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          policy_id?: string;
          requirements?: Json;
          sort_order?: number | null;
          trigger_config?: Json;
          trigger_type?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'risk_policy_rules_policy_id_fkey';
            columns: ['policy_id'];
            isOneToOne: false;
            referencedRelation: 'risk_policies';
            referencedColumns: ['id'];
          },
        ];
      };
      risk_services_catalog: {
        Row: {
          code: string;
          cost_type: string;
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          metadata: Json | null;
          name: string;
          provider: string;
          required_when: string | null;
          scope: string;
          unit_cost: number;
          updated_at: string | null;
          valid_from: string | null;
          valid_until: string | null;
          validity_days: number | null;
        };
        Insert: {
          code: string;
          cost_type?: string;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          metadata?: Json | null;
          name: string;
          provider: string;
          required_when?: string | null;
          scope?: string;
          unit_cost: number;
          updated_at?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          validity_days?: number | null;
        };
        Update: {
          code?: string;
          cost_type?: string;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          metadata?: Json | null;
          name?: string;
          provider?: string;
          required_when?: string | null;
          scope?: string;
          unit_cost?: number;
          updated_at?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          validity_days?: number | null;
        };
        Relationships: [];
      };
      route_metrics_config: {
        Row: {
          created_at: string;
          destination_uf: string;
          id: string;
          is_active: boolean;
          max_rs_per_km: number | null;
          min_rs_per_km: number | null;
          notes: string | null;
          origin_uf: string;
          target_rs_per_km: number | null;
          updated_at: string;
          vehicle_type_id: string | null;
        };
        Insert: {
          created_at?: string;
          destination_uf: string;
          id?: string;
          is_active?: boolean;
          max_rs_per_km?: number | null;
          min_rs_per_km?: number | null;
          notes?: string | null;
          origin_uf: string;
          target_rs_per_km?: number | null;
          updated_at?: string;
          vehicle_type_id?: string | null;
        };
        Update: {
          created_at?: string;
          destination_uf?: string;
          id?: string;
          is_active?: boolean;
          max_rs_per_km?: number | null;
          min_rs_per_km?: number | null;
          notes?: string | null;
          origin_uf?: string;
          target_rs_per_km?: number | null;
          updated_at?: string;
          vehicle_type_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'route_metrics_config_vehicle_type_id_fkey';
            columns: ['vehicle_type_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_types';
            referencedColumns: ['id'];
          },
        ];
      };
      shippers: {
        Row: {
          address: string | null;
          address_complement: string | null;
          address_neighborhood: string | null;
          address_number: string | null;
          cep_origem_override: string | null;
          city: string | null;
          cnae_main_code: string | null;
          cnae_main_description: string | null;
          cnaes_secondary: Json | null;
          cnpj: string | null;
          cnpj_lookup_at: string | null;
          company_size: string | null;
          contact_context: string | null;
          contact_enrichment_at: string | null;
          contact_name: string | null;
          cpf: string | null;
          created_at: string;
          created_by: string | null;
          efr: string | null;
          email: string | null;
          emit_cte_via: Database['public']['Enums']['cte_router'];
          enrichment_sources: Json | null;
          ibge_code: number | null;
          id: string;
          ie_indicator: number | null;
          legal_nature: string | null;
          legal_nature_code: string | null;
          legal_representative_cpf: string | null;
          legal_representative_name: string | null;
          legal_representative_role: string | null;
          name: string;
          notes: string | null;
          opening_date: string | null;
          partners: Json | null;
          phone: string | null;
          registration_status: string | null;
          registration_status_date: string | null;
          registration_status_reason: string | null;
          share_capital: number | null;
          state: string | null;
          state_registration: string | null;
          trade_name: string | null;
          updated_at: string;
          zip_code: string | null;
        };
        Insert: {
          address?: string | null;
          address_complement?: string | null;
          address_neighborhood?: string | null;
          address_number?: string | null;
          cep_origem_override?: string | null;
          city?: string | null;
          cnae_main_code?: string | null;
          cnae_main_description?: string | null;
          cnaes_secondary?: Json | null;
          cnpj?: string | null;
          cnpj_lookup_at?: string | null;
          company_size?: string | null;
          contact_context?: string | null;
          contact_enrichment_at?: string | null;
          contact_name?: string | null;
          cpf?: string | null;
          created_at?: string;
          created_by?: string | null;
          efr?: string | null;
          email?: string | null;
          emit_cte_via?: Database['public']['Enums']['cte_router'];
          enrichment_sources?: Json | null;
          ibge_code?: number | null;
          id?: string;
          ie_indicator?: number | null;
          legal_nature?: string | null;
          legal_nature_code?: string | null;
          legal_representative_cpf?: string | null;
          legal_representative_name?: string | null;
          legal_representative_role?: string | null;
          name: string;
          notes?: string | null;
          opening_date?: string | null;
          partners?: Json | null;
          phone?: string | null;
          registration_status?: string | null;
          registration_status_date?: string | null;
          registration_status_reason?: string | null;
          share_capital?: number | null;
          state?: string | null;
          state_registration?: string | null;
          trade_name?: string | null;
          updated_at?: string;
          zip_code?: string | null;
        };
        Update: {
          address?: string | null;
          address_complement?: string | null;
          address_neighborhood?: string | null;
          address_number?: string | null;
          cep_origem_override?: string | null;
          city?: string | null;
          cnae_main_code?: string | null;
          cnae_main_description?: string | null;
          cnaes_secondary?: Json | null;
          cnpj?: string | null;
          cnpj_lookup_at?: string | null;
          company_size?: string | null;
          contact_context?: string | null;
          contact_enrichment_at?: string | null;
          contact_name?: string | null;
          cpf?: string | null;
          created_at?: string;
          created_by?: string | null;
          efr?: string | null;
          email?: string | null;
          emit_cte_via?: Database['public']['Enums']['cte_router'];
          enrichment_sources?: Json | null;
          ibge_code?: number | null;
          id?: string;
          ie_indicator?: number | null;
          legal_nature?: string | null;
          legal_nature_code?: string | null;
          legal_representative_cpf?: string | null;
          legal_representative_name?: string | null;
          legal_representative_role?: string | null;
          name?: string;
          notes?: string | null;
          opening_date?: string | null;
          partners?: Json | null;
          phone?: string | null;
          registration_status?: string | null;
          registration_status_date?: string | null;
          registration_status_reason?: string | null;
          share_capital?: number | null;
          state?: string | null;
          state_registration?: string | null;
          trade_name?: string | null;
          updated_at?: string;
          zip_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'shippers_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      tac_rates: {
        Row: {
          adjustment_percent: number;
          created_at: string;
          created_by: string | null;
          diesel_price_base: number;
          diesel_price_current: number;
          id: string;
          reference_date: string;
          source_description: string | null;
          updated_at: string;
          user_id: string | null;
          variation_percent: number | null;
        };
        Insert: {
          adjustment_percent?: number;
          created_at?: string;
          created_by?: string | null;
          diesel_price_base: number;
          diesel_price_current: number;
          id?: string;
          reference_date: string;
          source_description?: string | null;
          updated_at?: string;
          user_id?: string | null;
          variation_percent?: number | null;
        };
        Update: {
          adjustment_percent?: number;
          created_at?: string;
          created_by?: string | null;
          diesel_price_base?: number;
          diesel_price_current?: number;
          id?: string;
          reference_date?: string;
          source_description?: string | null;
          updated_at?: string;
          user_id?: string | null;
          variation_percent?: number | null;
        };
        Relationships: [];
      };
      toll_routes: {
        Row: {
          created_at: string;
          created_by: string | null;
          destination_city: string | null;
          destination_state: string;
          distance_km: number | null;
          id: string;
          origin_city: string | null;
          origin_state: string;
          toll_value: number;
          updated_at: string;
          user_id: string | null;
          valid_from: string | null;
          valid_until: string | null;
          vehicle_type_id: string | null;
          via_description: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          destination_city?: string | null;
          destination_state: string;
          distance_km?: number | null;
          id?: string;
          origin_city?: string | null;
          origin_state: string;
          toll_value: number;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          vehicle_type_id?: string | null;
          via_description?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          destination_city?: string | null;
          destination_state?: string;
          distance_km?: number | null;
          id?: string;
          origin_city?: string | null;
          origin_state?: string;
          toll_value?: number;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          vehicle_type_id?: string | null;
          via_description?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'toll_routes_vehicle_type_id_fkey';
            columns: ['vehicle_type_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_types';
            referencedColumns: ['id'];
          },
        ];
      };
      trip_cost_items: {
        Row: {
          amount: number;
          category: string;
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          idempotency_key: string | null;
          is_frozen: boolean;
          manually_edited_at: string | null;
          manually_edited_by: string | null;
          order_id: string | null;
          reference_id: string | null;
          reference_key: string | null;
          scope: string;
          source: string;
          trip_id: string;
          updated_at: string;
        };
        Insert: {
          amount?: number;
          category: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          idempotency_key?: string | null;
          is_frozen?: boolean;
          manually_edited_at?: string | null;
          manually_edited_by?: string | null;
          order_id?: string | null;
          reference_id?: string | null;
          reference_key?: string | null;
          scope: string;
          source?: string;
          trip_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          idempotency_key?: string | null;
          is_frozen?: boolean;
          manually_edited_at?: string | null;
          manually_edited_by?: string | null;
          order_id?: string | null;
          reference_id?: string | null;
          reference_key?: string | null;
          scope?: string;
          source?: string;
          trip_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_cost_items_manually_edited_by_fkey';
            columns: ['manually_edited_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'trip_cost_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_cost_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders_rs_per_km';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'trip_cost_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_order_payment_reconciliation';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'trip_cost_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'trip_cost_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_financial_details';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'trip_cost_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'vw_order_risk_status';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'trip_cost_items_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trip_financial_summary';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'trip_cost_items_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_cost_items_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_payment_reconciliation';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'trip_cost_items_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'vw_trip_risk_summary';
            referencedColumns: ['trip_id'];
          },
        ];
      };
      trip_orders: {
        Row: {
          apportion_factor: number;
          apportion_key: string;
          created_at: string;
          id: string;
          manual_percent: number | null;
          order_id: string;
          trip_id: string;
        };
        Insert: {
          apportion_factor?: number;
          apportion_key?: string;
          created_at?: string;
          id?: string;
          manual_percent?: number | null;
          order_id: string;
          trip_id: string;
        };
        Update: {
          apportion_factor?: number;
          apportion_key?: string;
          created_at?: string;
          id?: string;
          manual_percent?: number | null;
          order_id?: string;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_orders_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_orders_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders_rs_per_km';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'trip_orders_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_order_payment_reconciliation';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'trip_orders_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'trip_orders_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_financial_details';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'trip_orders_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'vw_order_risk_status';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'trip_orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trip_financial_summary';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'trip_orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_payment_reconciliation';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'trip_orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'vw_trip_risk_summary';
            referencedColumns: ['trip_id'];
          },
        ];
      };
      trips: {
        Row: {
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          created_by: string | null;
          departure_at: string | null;
          driver_id: string;
          financial_status: string;
          id: string;
          notes: string | null;
          status_operational: string;
          trip_number: string;
          updated_at: string;
          vehicle_plate: string;
          vehicle_type_id: string | null;
        };
        Insert: {
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          departure_at?: string | null;
          driver_id: string;
          financial_status?: string;
          id?: string;
          notes?: string | null;
          status_operational?: string;
          trip_number: string;
          updated_at?: string;
          vehicle_plate: string;
          vehicle_type_id?: string | null;
        };
        Update: {
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          departure_at?: string | null;
          driver_id?: string;
          financial_status?: string;
          id?: string;
          notes?: string | null;
          status_operational?: string;
          trip_number?: string;
          updated_at?: string;
          vehicle_plate?: string;
          vehicle_type_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'trips_closed_by_fkey';
            columns: ['closed_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'trips_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'trips_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: false;
            referencedRelation: 'drivers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trips_vehicle_type_id_fkey';
            columns: ['vehicle_type_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_types';
            referencedColumns: ['id'];
          },
        ];
      };
      unloading_cost_rates: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          id: string;
          name: string;
          unit: string;
          updated_at: string;
          valid_from: string | null;
          valid_until: string | null;
          value: number;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          id?: string;
          name: string;
          unit?: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
          value?: number;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          unit?: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
          value?: number;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database['public']['Enums']['app_role'];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database['public']['Enums']['app_role'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database['public']['Enums']['app_role'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_roles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      vectra_manifestos: {
        Row: {
          ciot: string | null;
          combustivel: number | null;
          created_at: string | null;
          destino: string | null;
          emissao: string | null;
          frete: number | null;
          has_ciot: boolean | null;
          id: number;
          manifesto: string;
          motorista: string | null;
          origem: string | null;
          pedagio: number | null;
          peso: number | null;
          proprietario: string | null;
          rota: string | null;
          status: string | null;
          tipo: string | null;
          veiculo: string | null;
        };
        Insert: {
          ciot?: string | null;
          combustivel?: number | null;
          created_at?: string | null;
          destino?: string | null;
          emissao?: string | null;
          frete?: number | null;
          has_ciot?: boolean | null;
          id?: number;
          manifesto: string;
          motorista?: string | null;
          origem?: string | null;
          pedagio?: number | null;
          peso?: number | null;
          proprietario?: string | null;
          rota?: string | null;
          status?: string | null;
          tipo?: string | null;
          veiculo?: string | null;
        };
        Update: {
          ciot?: string | null;
          combustivel?: number | null;
          created_at?: string | null;
          destino?: string | null;
          emissao?: string | null;
          frete?: number | null;
          has_ciot?: boolean | null;
          id?: number;
          manifesto?: string;
          motorista?: string | null;
          origem?: string | null;
          pedagio?: number | null;
          peso?: number | null;
          proprietario?: string | null;
          rota?: string | null;
          status?: string | null;
          tipo?: string | null;
          veiculo?: string | null;
        };
        Relationships: [];
      };
      vectra_motoristas_margem: {
        Row: {
          created_at: string | null;
          custo_total: number | null;
          id: number;
          km_total: number | null;
          margem_pct: number | null;
          margem_rs: number | null;
          motorista: string;
          pedagio_total: number | null;
          peso_total: number | null;
          receita_total: number | null;
          viagens: number | null;
        };
        Insert: {
          created_at?: string | null;
          custo_total?: number | null;
          id?: number;
          km_total?: number | null;
          margem_pct?: number | null;
          margem_rs?: number | null;
          motorista: string;
          pedagio_total?: number | null;
          peso_total?: number | null;
          receita_total?: number | null;
          viagens?: number | null;
        };
        Update: {
          created_at?: string | null;
          custo_total?: number | null;
          id?: number;
          km_total?: number | null;
          margem_pct?: number | null;
          margem_rs?: number | null;
          motorista?: string;
          pedagio_total?: number | null;
          peso_total?: number | null;
          receita_total?: number | null;
          viagens?: number | null;
        };
        Relationships: [];
      };
      vectra_rentabilidade_rotas: {
        Row: {
          created_at: string | null;
          ctes: number | null;
          custo_total: number | null;
          id: number;
          margem_pct: number | null;
          margem_rs: number | null;
          receita_total: number | null;
          rota: string;
          viagens: number | null;
        };
        Insert: {
          created_at?: string | null;
          ctes?: number | null;
          custo_total?: number | null;
          id?: number;
          margem_pct?: number | null;
          margem_rs?: number | null;
          receita_total?: number | null;
          rota: string;
          viagens?: number | null;
        };
        Update: {
          created_at?: string | null;
          ctes?: number | null;
          custo_total?: number | null;
          id?: number;
          margem_pct?: number | null;
          margem_rs?: number | null;
          receita_total?: number | null;
          rota?: string;
          viagens?: number | null;
        };
        Relationships: [];
      };
      vehicle_types: {
        Row: {
          active: boolean;
          ailog_category: string | null;
          axes_count: number;
          code: string;
          created_at: string;
          id: string;
          name: string;
          rolling_type: string | null;
          updated_at: string;
          user_id: string | null;
          vehicle_profile: string | null;
        };
        Insert: {
          active?: boolean;
          ailog_category?: string | null;
          axes_count: number;
          code: string;
          created_at?: string;
          id?: string;
          name: string;
          rolling_type?: string | null;
          updated_at?: string;
          user_id?: string | null;
          vehicle_profile?: string | null;
        };
        Update: {
          active?: boolean;
          ailog_category?: string | null;
          axes_count?: number;
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          rolling_type?: string | null;
          updated_at?: string;
          user_id?: string | null;
          vehicle_profile?: string | null;
        };
        Relationships: [];
      };
      vehicles: {
        Row: {
          active: boolean;
          brand: string | null;
          capacity_kg: number | null;
          capacity_m3: number | null;
          color: string | null;
          cpf_cnpj_proprietario: string | null;
          created_at: string;
          driver_id: string | null;
          id: string;
          ie_proprietario: string | null;
          model: string | null;
          nome_proprietario: string | null;
          owner_id: string | null;
          plate: string;
          plate_2: string | null;
          plate_2_mask: string | null;
          plate_mask: string | null;
          qtd_pallets: number | null;
          reboque_capacity_kg: number | null;
          reboque_tara_kg: number | null;
          reboque_tipo_carroceria: string | null;
          reboque_uf_licenciamento: string | null;
          renavam: string | null;
          rntrc_proprietario: string | null;
          tara_kg: number | null;
          tipo_carroceria: string | null;
          tipo_proprietario: number | null;
          tipo_rodado: string | null;
          uf_licenciamento: string | null;
          uf_proprietario: string | null;
          updated_at: string;
          vehicle_type_id: string | null;
          year: number | null;
        };
        Insert: {
          active?: boolean;
          brand?: string | null;
          capacity_kg?: number | null;
          capacity_m3?: number | null;
          color?: string | null;
          cpf_cnpj_proprietario?: string | null;
          created_at?: string;
          driver_id?: string | null;
          id?: string;
          ie_proprietario?: string | null;
          model?: string | null;
          nome_proprietario?: string | null;
          owner_id?: string | null;
          plate: string;
          plate_2?: string | null;
          plate_2_mask?: string | null;
          plate_mask?: string | null;
          qtd_pallets?: number | null;
          reboque_capacity_kg?: number | null;
          reboque_tara_kg?: number | null;
          reboque_tipo_carroceria?: string | null;
          reboque_uf_licenciamento?: string | null;
          renavam?: string | null;
          rntrc_proprietario?: string | null;
          tara_kg?: number | null;
          tipo_carroceria?: string | null;
          tipo_proprietario?: number | null;
          tipo_rodado?: string | null;
          uf_licenciamento?: string | null;
          uf_proprietario?: string | null;
          updated_at?: string;
          vehicle_type_id?: string | null;
          year?: number | null;
        };
        Update: {
          active?: boolean;
          brand?: string | null;
          capacity_kg?: number | null;
          capacity_m3?: number | null;
          color?: string | null;
          cpf_cnpj_proprietario?: string | null;
          created_at?: string;
          driver_id?: string | null;
          id?: string;
          ie_proprietario?: string | null;
          model?: string | null;
          nome_proprietario?: string | null;
          owner_id?: string | null;
          plate?: string;
          plate_2?: string | null;
          plate_2_mask?: string | null;
          plate_mask?: string | null;
          qtd_pallets?: number | null;
          reboque_capacity_kg?: number | null;
          reboque_tara_kg?: number | null;
          reboque_tipo_carroceria?: string | null;
          reboque_uf_licenciamento?: string | null;
          renavam?: string | null;
          rntrc_proprietario?: string | null;
          tara_kg?: number | null;
          tipo_carroceria?: string | null;
          tipo_proprietario?: number | null;
          tipo_rodado?: string | null;
          uf_licenciamento?: string | null;
          uf_proprietario?: string | null;
          updated_at?: string;
          vehicle_type_id?: string | null;
          year?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicles_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: false;
            referencedRelation: 'drivers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicles_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicles_vehicle_type_id_fkey';
            columns: ['vehicle_type_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_types';
            referencedColumns: ['id'];
          },
        ];
      };
      waiting_time_rules: {
        Row: {
          context: string;
          created_at: string;
          created_by: string | null;
          free_hours: number;
          id: string;
          min_charge: number | null;
          rate_per_day: number | null;
          rate_per_hour: number | null;
          updated_at: string;
          user_id: string | null;
          valid_from: string | null;
          valid_until: string | null;
          vehicle_type_id: string | null;
        };
        Insert: {
          context?: string;
          created_at?: string;
          created_by?: string | null;
          free_hours?: number;
          id?: string;
          min_charge?: number | null;
          rate_per_day?: number | null;
          rate_per_hour?: number | null;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          vehicle_type_id?: string | null;
        };
        Update: {
          context?: string;
          created_at?: string;
          created_by?: string | null;
          free_hours?: number;
          id?: string;
          min_charge?: number | null;
          rate_per_day?: number | null;
          rate_per_hour?: number | null;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          vehicle_type_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'waiting_time_rules_vehicle_type_id_fkey';
            columns: ['vehicle_type_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_types';
            referencedColumns: ['id'];
          },
        ];
      };
      workflow_definitions: {
        Row: {
          active: boolean;
          created_at: string;
          entity_type: string;
          id: string;
          stages: Json;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          entity_type: string;
          id?: string;
          stages: Json;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          entity_type?: string;
          id?: string;
          stages?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      workflow_event_logs: {
        Row: {
          action: string;
          agent: string;
          created_at: string;
          details: Json | null;
          event_id: string | null;
          id: string;
        };
        Insert: {
          action: string;
          agent: string;
          created_at?: string;
          details?: Json | null;
          event_id?: string | null;
          id?: string;
        };
        Update: {
          action?: string;
          agent?: string;
          created_at?: string;
          details?: Json | null;
          event_id?: string | null;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workflow_event_logs_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'workflow_events';
            referencedColumns: ['id'];
          },
        ];
      };
      workflow_events: {
        Row: {
          created_at: string;
          created_by: string | null;
          entity_id: string;
          entity_type: string;
          error_message: string | null;
          event_type: string;
          execute_after: string | null;
          id: string;
          max_retries: number;
          payload: Json;
          processed_at: string | null;
          retry_count: number;
          status: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          entity_id: string;
          entity_type: string;
          error_message?: string | null;
          event_type: string;
          execute_after?: string | null;
          id?: string;
          max_retries?: number;
          payload?: Json;
          processed_at?: string | null;
          retry_count?: number;
          status?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          entity_id?: string;
          entity_type?: string;
          error_message?: string | null;
          event_type?: string;
          execute_after?: string | null;
          id?: string;
          max_retries?: number;
          payload?: Json;
          processed_at?: string | null;
          retry_count?: number;
          status?: string;
        };
        Relationships: [];
      };
      workflow_transitions: {
        Row: {
          approval_type: string | null;
          conditions: Json;
          created_at: string;
          description: string | null;
          from_stage: string;
          id: string;
          post_actions: Json;
          required_documents: Json;
          required_fields: Json;
          requires_approval: boolean;
          to_stage: string;
          workflow_id: string;
        };
        Insert: {
          approval_type?: string | null;
          conditions?: Json;
          created_at?: string;
          description?: string | null;
          from_stage: string;
          id?: string;
          post_actions?: Json;
          required_documents?: Json;
          required_fields?: Json;
          requires_approval?: boolean;
          to_stage: string;
          workflow_id: string;
        };
        Update: {
          approval_type?: string | null;
          conditions?: Json;
          created_at?: string;
          description?: string | null;
          from_stage?: string;
          id?: string;
          post_actions?: Json;
          required_documents?: Json;
          required_fields?: Json;
          requires_approval?: boolean;
          to_stage?: string;
          workflow_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workflow_transitions_workflow_id_fkey';
            columns: ['workflow_id'];
            isOneToOne: false;
            referencedRelation: 'workflow_definitions';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      financial_documents_kanban: {
        Row: {
          code: string | null;
          created_at: string | null;
          erp_reference: string | null;
          erp_status: string | null;
          id: string | null;
          installments_pending: number | null;
          installments_settled: number | null;
          installments_total: number | null;
          is_overdue: boolean | null;
          next_due_date: string | null;
          notes: string | null;
          owner_id: string | null;
          source_id: string | null;
          source_type: Database['public']['Enums']['financial_source_type'] | null;
          status: string | null;
          total_amount: number | null;
          type: Database['public']['Enums']['financial_doc_type'] | null;
          updated_at: string | null;
        };
        Insert: {
          code?: string | null;
          created_at?: string | null;
          erp_reference?: string | null;
          erp_status?: string | null;
          id?: string | null;
          installments_pending?: never;
          installments_settled?: never;
          installments_total?: never;
          is_overdue?: never;
          next_due_date?: never;
          notes?: string | null;
          owner_id?: string | null;
          source_id?: string | null;
          source_type?: Database['public']['Enums']['financial_source_type'] | null;
          status?: string | null;
          total_amount?: number | null;
          type?: Database['public']['Enums']['financial_doc_type'] | null;
          updated_at?: string | null;
        };
        Update: {
          code?: string | null;
          created_at?: string | null;
          erp_reference?: string | null;
          erp_status?: string | null;
          id?: string | null;
          installments_pending?: never;
          installments_settled?: never;
          installments_total?: never;
          is_overdue?: never;
          next_due_date?: never;
          notes?: string | null;
          owner_id?: string | null;
          source_id?: string | null;
          source_type?: Database['public']['Enums']['financial_source_type'] | null;
          status?: string | null;
          total_amount?: number | null;
          type?: Database['public']['Enums']['financial_doc_type'] | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'financial_documents_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
        ];
      };
      financial_payable_kanban: {
        Row: {
          axes_count: number | null;
          cargo_type: string | null;
          carreteiro_antt: number | null;
          carreteiro_real: number | null;
          carrier_name: string | null;
          carrier_phone: string | null;
          client_name: string | null;
          code: string | null;
          created_at: string | null;
          destination: string | null;
          destination_cep: string | null;
          erp_reference: string | null;
          erp_status: string | null;
          freight_modality: string | null;
          freight_type: string | null;
          id: string | null;
          installments_pending: number | null;
          installments_settled: number | null;
          installments_total: number | null;
          is_overdue: boolean | null;
          km_distance: number | null;
          next_due_date: string | null;
          notes: string | null;
          order_value: number | null;
          origin: string | null;
          origin_cep: string | null;
          owner_id: string | null;
          payment_term_adjustment: number | null;
          payment_term_advance: number | null;
          payment_term_code: string | null;
          payment_term_days: number | null;
          payment_term_name: string | null;
          pricing_breakdown: Json | null;
          shipper_name: string | null;
          source_id: string | null;
          source_type: Database['public']['Enums']['financial_source_type'] | null;
          status: string | null;
          toll_value: number | null;
          total_amount: number | null;
          type: Database['public']['Enums']['financial_doc_type'] | null;
          updated_at: string | null;
          vehicle_type_code: string | null;
          vehicle_type_name: string | null;
          volume: number | null;
          weight: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'financial_documents_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
        ];
      };
      financial_receivable_kanban: {
        Row: {
          axes_count: number | null;
          cargo_type: string | null;
          client_name: string | null;
          code: string | null;
          contract_pdf_path: string | null;
          contract_signature_status: string | null;
          contract_version: number | null;
          created_at: string | null;
          destination: string | null;
          destination_cep: string | null;
          erp_reference: string | null;
          erp_status: string | null;
          freight_modality: string | null;
          freight_type: string | null;
          has_contract: boolean | null;
          id: string | null;
          installments_pending: number | null;
          installments_settled: number | null;
          installments_total: number | null;
          is_overdue: boolean | null;
          km_distance: number | null;
          next_due_date: string | null;
          notes: string | null;
          origin: string | null;
          origin_cep: string | null;
          owner_id: string | null;
          payment_term_adjustment: number | null;
          payment_term_advance: number | null;
          payment_term_code: string | null;
          payment_term_days: number | null;
          payment_term_name: string | null;
          pricing_breakdown: Json | null;
          quote_value: number | null;
          shipper_name: string | null;
          source_id: string | null;
          source_type: Database['public']['Enums']['financial_source_type'] | null;
          status: string | null;
          toll_value: number | null;
          total_amount: number | null;
          type: Database['public']['Enums']['financial_doc_type'] | null;
          updated_at: string | null;
          vehicle_type_code: string | null;
          vehicle_type_name: string | null;
          volume: number | null;
          weight: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'financial_documents_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
        ];
      };
      gris_service_items: {
        Row: {
          amount: number | null;
          order_id: string | null;
        };
        Insert: {
          amount?: never;
          order_id?: string | null;
        };
        Update: {
          amount?: never;
          order_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'order_gris_services_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_gris_services_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders_rs_per_km';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'order_gris_services_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_order_payment_reconciliation';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'order_gris_services_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'order_gris_services_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_financial_details';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'order_gris_services_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'vw_order_risk_status';
            referencedColumns: ['order_id'];
          },
        ];
      };
      load_composition_discount_summary: {
        Row: {
          avg_final_margin_percent: number | null;
          composition_id: string | null;
          margin_rules_applied: string[] | null;
          min_final_margin_percent: number | null;
          shipper_count: number | null;
          total_discount_offered: number | null;
          total_final_price: number | null;
          total_original_price: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'load_composition_discount_breakdown_composition_id_fkey';
            columns: ['composition_id'];
            isOneToOne: false;
            referencedRelation: 'load_composition_suggestions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'load_composition_discount_breakdown_composition_id_fkey';
            columns: ['composition_id'];
            isOneToOne: false;
            referencedRelation: 'load_composition_summary';
            referencedColumns: ['id'];
          },
        ];
      };
      load_composition_summary: {
        Row: {
          approved_at: string | null;
          base_km_total: number | null;
          composed_km_total: number | null;
          consolidation_score: number | null;
          created_at: string | null;
          delta_km_abs: number | null;
          delta_km_percent: number | null;
          estimated_savings_brl: number | null;
          id: string | null;
          num_stops: number | null;
          quote_ids: string[] | null;
          route_evaluation_model: string | null;
          shipper_id: string | null;
          status: string | null;
          technical_explanation: string | null;
          trigger_source: string | null;
        };
        Insert: {
          approved_at?: string | null;
          base_km_total?: number | null;
          composed_km_total?: number | null;
          consolidation_score?: number | null;
          created_at?: string | null;
          delta_km_abs?: number | null;
          delta_km_percent?: number | null;
          estimated_savings_brl?: number | null;
          id?: string | null;
          num_stops?: never;
          quote_ids?: string[] | null;
          route_evaluation_model?: string | null;
          shipper_id?: string | null;
          status?: string | null;
          technical_explanation?: string | null;
          trigger_source?: string | null;
        };
        Update: {
          approved_at?: string | null;
          base_km_total?: number | null;
          composed_km_total?: number | null;
          consolidation_score?: number | null;
          created_at?: string | null;
          delta_km_abs?: number | null;
          delta_km_percent?: number | null;
          estimated_savings_brl?: number | null;
          id?: string | null;
          num_stops?: never;
          quote_ids?: string[] | null;
          route_evaluation_model?: string | null;
          shipper_id?: string | null;
          status?: string | null;
          technical_explanation?: string | null;
          trigger_source?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'load_composition_suggestions_shipper_id_fkey';
            columns: ['shipper_id'];
            isOneToOne: false;
            referencedRelation: 'shippers';
            referencedColumns: ['id'];
          },
        ];
      };
      order_documents: {
        Row: {
          created_at: string | null;
          file_name: string | null;
          id: string | null;
          order_id: string | null;
          status: string | null;
          type: Database['public']['Enums']['document_type'] | null;
        };
        Insert: {
          created_at?: string | null;
          file_name?: string | null;
          id?: string | null;
          order_id?: string | null;
          status?: never;
          type?: Database['public']['Enums']['document_type'] | null;
        };
        Update: {
          created_at?: string | null;
          file_name?: string | null;
          id?: string | null;
          order_id?: string | null;
          status?: never;
          type?: Database['public']['Enums']['document_type'] | null;
        };
        Relationships: [
          {
            foreignKeyName: 'documents_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'documents_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders_rs_per_km';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'documents_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_order_payment_reconciliation';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'documents_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'documents_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_financial_details';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'documents_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'vw_order_risk_status';
            referencedColumns: ['order_id'];
          },
        ];
      };
      orders_rs_per_km: {
        Row: {
          carreteiro_real: number | null;
          client_name: string | null;
          destination: string | null;
          km_distance: number | null;
          order_date: string | null;
          order_id: string | null;
          origin: string | null;
          os_number: string | null;
          rs_per_km: number | null;
          tipo: string | null;
          trip_id: string | null;
          vehicle_type_id: string | null;
          vehicle_type_name: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_vehicle_type_id_fkey';
            columns: ['vehicle_type_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_types';
            referencedColumns: ['id'];
          },
        ];
      };
      trip_financial_summary: {
        Row: {
          custos_diretos: number | null;
          custos_os: number | null;
          custos_trip: number | null;
          driver_id: string | null;
          financial_status: string | null;
          margem_bruta: number | null;
          margem_percent: number | null;
          orders_count: number | null;
          receita_bruta: number | null;
          status_operational: string | null;
          trip_id: string | null;
          trip_number: string | null;
          vehicle_plate: string | null;
        };
        Insert: {
          custos_diretos?: never;
          custos_os?: never;
          custos_trip?: never;
          driver_id?: string | null;
          financial_status?: string | null;
          margem_bruta?: never;
          margem_percent?: never;
          orders_count?: never;
          receita_bruta?: never;
          status_operational?: string | null;
          trip_id?: string | null;
          trip_number?: string | null;
          vehicle_plate?: string | null;
        };
        Update: {
          custos_diretos?: never;
          custos_os?: never;
          custos_trip?: never;
          driver_id?: string | null;
          financial_status?: string | null;
          margem_bruta?: never;
          margem_percent?: never;
          orders_count?: never;
          receita_bruta?: never;
          status_operational?: string | null;
          trip_id?: string | null;
          trip_number?: string | null;
          vehicle_plate?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'trips_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: false;
            referencedRelation: 'drivers';
            referencedColumns: ['id'];
          },
        ];
      };
      v_cash_flow_summary: {
        Row: {
          doc_count: number | null;
          pending_amount: number | null;
          period: string | null;
          settled_amount: number | null;
          status: string | null;
          total_amount: number | null;
          type: Database['public']['Enums']['financial_doc_type'] | null;
        };
        Relationships: [];
      };
      v_dre_audit_mismatches: {
        Row: {
          description: string | null;
          mismatch_type: string | null;
          order_id: string | null;
          os_number: string | null;
          quote_code: string | null;
          quote_id: string | null;
          reference_date: string | null;
          severity: string | null;
        };
        Relationships: [];
      };
      v_dre_regime_comparison: {
        Row: {
          carga_tributaria_pct: number | null;
          cofins: number | null;
          cot_count: number | null;
          csll: number | null;
          das: number | null;
          icms: number | null;
          irpj: number | null;
          margem_liquida_avg: number | null;
          month: string | null;
          month_label: string | null;
          os_count: number | null;
          pis: number | null;
          receita_bruta: number | null;
          regime_fiscal: string | null;
          resultado_liquido: number | null;
          total_impostos: number | null;
        };
        Relationships: [];
      };
      v_order_payment_reconciliation: {
        Row: {
          delta_amount: number | null;
          expected_amount: number | null;
          has_expected_value: boolean | null;
          is_reconciled: boolean | null;
          last_paid_at: string | null;
          order_id: string | null;
          os_number: string | null;
          paid_amount: number | null;
          proofs_count: number | null;
          trip_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trip_financial_summary';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_payment_reconciliation';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'vw_trip_risk_summary';
            referencedColumns: ['trip_id'];
          },
        ];
      };
      v_quote_order_divergence: {
        Row: {
          axes_divergence: boolean | null;
          client_name: string | null;
          delta_km: number | null;
          delta_toll: number | null;
          delta_value: number | null;
          destination: string | null;
          margem_percent_prevista: number | null;
          order_axes_count: number | null;
          order_created_at: string | null;
          order_id: string | null;
          order_km: number | null;
          order_stage: Database['public']['Enums']['order_stage'] | null;
          order_toll_value: number | null;
          order_value: number | null;
          origin: string | null;
          os_number: string | null;
          quote_axes_count: number | null;
          quote_code: string | null;
          quote_id: string | null;
          quote_km: number | null;
          quote_toll_value: number | null;
          quote_value: number | null;
        };
        Relationships: [];
      };
      v_quote_payment_reconciliation: {
        Row: {
          delta_amount: number | null;
          expected_amount: number | null;
          is_reconciled: boolean | null;
          paid_amount: number | null;
          proofs_count: number | null;
          quote_code: string | null;
          quote_id: string | null;
        };
        Relationships: [];
      };
      v_trip_financial_details: {
        Row: {
          carreteiro_previsto: number | null;
          carreteiro_real: number | null;
          descarga_previsto: number | null;
          descarga_real: number | null;
          gris_previsto: number | null;
          is_avulsa: boolean | null;
          order_id: string | null;
          os_number: string | null;
          pedagio_previsto: number | null;
          pedagio_real: number | null;
          receita_prevista: number | null;
          receita_real: number | null;
          trip_id: string | null;
          trip_number: string | null;
          trip_status: string | null;
          tso_previsto: number | null;
          vehicle_plate: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trip_financial_summary';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_payment_reconciliation';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'vw_trip_risk_summary';
            referencedColumns: ['trip_id'];
          },
        ];
      };
      v_trip_payment_reconciliation: {
        Row: {
          all_orders_reconciled: boolean | null;
          delta_amount: number | null;
          expected_amount: number | null;
          financial_status: string | null;
          last_paid_at: string | null;
          orders_count: number | null;
          paid_amount: number | null;
          status_operational: string | null;
          total_reconciled: boolean | null;
          trip_id: string | null;
          trip_number: string | null;
          trip_reconciled: boolean | null;
        };
        Relationships: [];
      };
      valid_users: {
        Row: {
          email: string | null;
          user_id: string | null;
        };
        Insert: {
          email?: string | null;
          user_id?: string | null;
        };
        Update: {
          email?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      vw_order_risk_status: {
        Row: {
          approval_request_id: string | null;
          buonny_valid: boolean | null;
          cargo_value: number | null;
          criticality: Database['public']['Enums']['risk_criticality'] | null;
          evaluation_id: string | null;
          order_id: string | null;
          os_number: string | null;
          requirements: Json | null;
          requirements_met: Json | null;
          risk_status: Database['public']['Enums']['risk_evaluation_status'] | null;
          stage: Database['public']['Enums']['order_stage'] | null;
          total_risk_cost: number | null;
          trip_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trip_financial_summary';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_payment_reconciliation';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'vw_trip_risk_summary';
            referencedColumns: ['trip_id'];
          },
        ];
      };
      vw_trip_risk_summary: {
        Row: {
          all_orders_approved: boolean | null;
          max_criticality: string | null;
          order_count: number | null;
          status_operational: string | null;
          total_cargo_value: number | null;
          total_risk_cost: number | null;
          trip_criticality: Database['public']['Enums']['risk_criticality'] | null;
          trip_id: string | null;
          trip_number: string | null;
          trip_risk_status: Database['public']['Enums']['risk_evaluation_status'] | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      check_ai_budget: { Args: never; Returns: Json };
      copy_quote_adiantamento_to_fat: {
        Args: { p_fat_id: string; p_quote_id: string };
        Returns: undefined;
      };
      create_trip: {
        Args: {
          p_departure_at?: string;
          p_driver_id: string;
          p_notes?: string;
          p_trip_number?: string;
          p_vehicle_plate: string;
          p_vehicle_type_id?: string;
        };
        Returns: {
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          created_by: string | null;
          departure_at: string | null;
          driver_id: string;
          financial_status: string;
          id: string;
          notes: string | null;
          status_operational: string;
          trip_number: string;
          updated_at: string;
          vehicle_plate: string;
          vehicle_type_id: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'trips';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      current_user_profile: {
        Args: never;
        Returns: Database['public']['Enums']['user_profile'];
      };
      ensure_financial_document: {
        Args: {
          doc_type: Database['public']['Enums']['financial_doc_type'];
          source_id_in: string;
          total_amount_in?: number;
        };
        Returns: Json;
      };
      find_price_row_by_km: {
        Args: {
          p_km_numeric: number;
          p_price_table_id: string;
          p_rounding?: string;
        };
        Returns: {
          cost_per_ton: number;
          id: string;
          km_from: number;
          km_to: number;
          matched_km: number;
        }[];
      };
      generate_os_number: { Args: never; Returns: string };
      generate_quote_code: { Args: never; Returns: string };
      generate_trip_number: { Args: never; Returns: string };
      get_ai_daily_spend: { Args: never; Returns: number };
      get_ai_monthly_spend: { Args: never; Returns: number };
      get_ai_usage_stats: { Args: never; Returns: Json };
      get_card_full_data: {
        Args: { p_order_id?: string; p_quote_id?: string };
        Returns: Json;
      };
      get_diesel_cost_by_route: {
        Args: { p_from?: string; p_to?: string };
        Returns: {
          ctes: number;
          custo_por_km: number;
          dest_uf: string;
          diesel_dest: number;
          diesel_orig: number;
          diesel_total_medio: number;
          diesel_total_soma: number;
          km_medio: number;
          media_rota: number;
          origin_uf: string;
          pct_ticket: number;
          receita_media: number;
          rota: string;
        }[];
      };
      get_route_metrics: {
        Args: { p_from: string; p_to: string; p_vehicle_type_id?: string };
        Returns: {
          avg_km: number;
          avg_paid: number;
          avg_rs_per_km: number;
          destination_uf: string;
          orders_count: number;
          origin_uf: string;
          p50_rs_per_km: number;
          p90_rs_per_km: number;
          route_key: string;
          vehicle_type_id: string;
          vehicle_type_name: string;
        }[];
      };
      get_user_role: {
        Args: { _user_id: string };
        Returns: Database['public']['Enums']['app_role'];
      };
      get_valid_transitions: {
        Args: { p_entity_type: string; p_from_stage: string };
        Returns: Json;
      };
      has_any_role: {
        Args: {
          _roles: Database['public']['Enums']['app_role'][];
          _user_id: string;
        };
        Returns: boolean;
      };
      has_profile: {
        Args: { allowed: Database['public']['Enums']['user_profile'][] };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database['public']['Enums']['app_role'];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
      link_order_to_target_trip: {
        Args: { p_order_id: string; p_trip_id: string };
        Returns: string;
      };
      link_order_to_trip: { Args: { p_order_id: string }; Returns: string };
      next_collection_order_seq: {
        Args: { p_month: number; p_year: number };
        Returns: number;
      };
      next_cte_numero: {
        Args: {
          p_ambiente: Database['public']['Enums']['focus_ambiente'];
          p_serie?: number;
        };
        Returns: number;
      };
      next_mdfe_numero: {
        Args: {
          p_ambiente: Database['public']['Enums']['focus_ambiente'];
          p_serie?: number;
        };
        Returns: number;
      };
      set_user_profile: {
        Args: {
          new_profile: Database['public']['Enums']['user_profile'];
          target_user_id: string;
        };
        Returns: undefined;
      };
      sync_cost_items_from_breakdown: {
        Args: { p_trip_id: string };
        Returns: undefined;
      };
      validate_quote_antt_floor: { Args: { p_quote_id: string }; Returns: Json };
      validate_transition: {
        Args: {
          p_entity_id: string;
          p_entity_type: string;
          p_from_stage: string;
          p_to_stage: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      app_role: 'admin' | 'comercial' | 'operacao' | 'fiscal' | 'leitura';
      averba_doc_type: 'cte' | 'nfe' | 'mdfe';
      averba_status: 'pending' | 'processing' | 'averbado' | 'declarado' | 'erro';
      collection_order_status: 'emitida' | 'cancelada';
      compliance_check_status: 'ok' | 'warning' | 'violation';
      compliance_check_type:
        | 'pre_contratacao'
        | 'pre_coleta'
        | 'pre_entrega'
        | 'auditoria_periodica';
      cte_emission_status:
        | 'draft'
        | 'sent'
        | 'processing'
        | 'authorized'
        | 'rejected'
        | 'cancelled';
      cte_router: 'cfn' | 'active' | 'none';
      document_type:
        | 'nfe'
        | 'cte'
        | 'pod'
        | 'outros'
        | 'cnh'
        | 'crlv'
        | 'comp_residencia'
        | 'antt_motorista'
        | 'mdfe'
        | 'adiantamento'
        | 'analise_gr'
        | 'doc_rota'
        | 'comprovante_vpo'
        | 'adiantamento_carreteiro'
        | 'saldo_carreteiro'
        | 'comprovante_descarga'
        | 'a_vista_fat'
        | 'saldo_fat'
        | 'a_prazo_fat'
        | 'a_vista_pag';
      driver_contract_type: 'proprio' | 'agregado' | 'terceiro';
      driver_qualification_status:
        | 'pendente'
        | 'em_analise'
        | 'aprovado'
        | 'reprovado'
        | 'bloqueado';
      financial_doc_type: 'FAT' | 'PAG';
      financial_installment_status: 'pendente' | 'baixado';
      financial_source_type: 'quote' | 'order';
      focus_ambiente: 'homolog' | 'prod';
      mdfe_emission_status:
        | 'draft'
        | 'sent'
        | 'processing'
        | 'authorized'
        | 'rejected'
        | 'encerrado'
        | 'cancelled';
      occurrence_severity: 'baixa' | 'media' | 'alta' | 'critica';
      order_stage:
        | 'ordem_criada'
        | 'busca_motorista'
        | 'documentacao'
        | 'coleta_realizada'
        | 'em_transito'
        | 'entregue';
      pedagio_charge_type: 'VALE_PEDAGIO_EMBARCADOR' | 'PEDAGIO_DEBITADO_CTE' | 'RATEIO_FRACIONADO';
      pricing_rule_category:
        | 'taxa'
        | 'estadia'
        | 'veiculo'
        | 'markup'
        | 'imposto'
        | 'prazo'
        | 'carga_descarga'
        | 'aluguel'
        | 'risco'
        | 'ntc';
      pricing_rule_value_type: 'fixed' | 'percentage' | 'per_km' | 'per_ton';
      quote_stage:
        | 'novo_pedido'
        | 'qualificacao'
        | 'precificacao'
        | 'enviado'
        | 'negociacao'
        | 'ganho'
        | 'perdido';
      risk_criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      risk_evaluation_status: 'pending' | 'evaluated' | 'approved' | 'rejected' | 'expired';
      rntrc_registry_type: 'TAC' | 'ETC';
      route_stop_type: 'origin' | 'stop' | 'destination';
      user_profile: 'admin' | 'operacional' | 'financeiro' | 'comercial';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ['admin', 'comercial', 'operacao', 'fiscal', 'leitura'],
      averba_doc_type: ['cte', 'nfe', 'mdfe'],
      averba_status: ['pending', 'processing', 'averbado', 'declarado', 'erro'],
      collection_order_status: ['emitida', 'cancelada'],
      compliance_check_status: ['ok', 'warning', 'violation'],
      compliance_check_type: [
        'pre_contratacao',
        'pre_coleta',
        'pre_entrega',
        'auditoria_periodica',
      ],
      cte_emission_status: ['draft', 'sent', 'processing', 'authorized', 'rejected', 'cancelled'],
      cte_router: ['cfn', 'active', 'none'],
      document_type: [
        'nfe',
        'cte',
        'pod',
        'outros',
        'cnh',
        'crlv',
        'comp_residencia',
        'antt_motorista',
        'mdfe',
        'adiantamento',
        'analise_gr',
        'doc_rota',
        'comprovante_vpo',
        'adiantamento_carreteiro',
        'saldo_carreteiro',
        'comprovante_descarga',
        'a_vista_fat',
        'saldo_fat',
        'a_prazo_fat',
        'a_vista_pag',
      ],
      driver_contract_type: ['proprio', 'agregado', 'terceiro'],
      driver_qualification_status: ['pendente', 'em_analise', 'aprovado', 'reprovado', 'bloqueado'],
      financial_doc_type: ['FAT', 'PAG'],
      financial_installment_status: ['pendente', 'baixado'],
      financial_source_type: ['quote', 'order'],
      focus_ambiente: ['homolog', 'prod'],
      mdfe_emission_status: [
        'draft',
        'sent',
        'processing',
        'authorized',
        'rejected',
        'encerrado',
        'cancelled',
      ],
      occurrence_severity: ['baixa', 'media', 'alta', 'critica'],
      order_stage: [
        'ordem_criada',
        'busca_motorista',
        'documentacao',
        'coleta_realizada',
        'em_transito',
        'entregue',
      ],
      pedagio_charge_type: ['VALE_PEDAGIO_EMBARCADOR', 'PEDAGIO_DEBITADO_CTE', 'RATEIO_FRACIONADO'],
      pricing_rule_category: [
        'taxa',
        'estadia',
        'veiculo',
        'markup',
        'imposto',
        'prazo',
        'carga_descarga',
        'aluguel',
        'risco',
        'ntc',
      ],
      pricing_rule_value_type: ['fixed', 'percentage', 'per_km', 'per_ton'],
      quote_stage: [
        'novo_pedido',
        'qualificacao',
        'precificacao',
        'enviado',
        'negociacao',
        'ganho',
        'perdido',
      ],
      risk_criticality: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      risk_evaluation_status: ['pending', 'evaluated', 'approved', 'rejected', 'expired'],
      rntrc_registry_type: ['TAC', 'ETC'],
      route_stop_type: ['origin', 'stop', 'destination'],
      user_profile: ['admin', 'operacional', 'financeiro', 'comercial'],
    },
  },
} as const;
