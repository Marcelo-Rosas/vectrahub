export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.1';
  };
  public: {
    Tables: {
      agent_jobs: {
        Row: {
          collected_data_id: string | null;
          created_at: string | null;
          id: string;
          picked_at: string | null;
          result: Json | null;
          status: string | null;
        };
        Insert: {
          collected_data_id?: string | null;
          created_at?: string | null;
          id?: string;
          picked_at?: string | null;
          result?: Json | null;
          status?: string | null;
        };
        Update: {
          collected_data_id?: string | null;
          created_at?: string | null;
          id?: string;
          picked_at?: string | null;
          result?: Json | null;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'agent_jobs_collected_data_id_fkey';
            columns: ['collected_data_id'];
            isOneToOne: false;
            referencedRelation: 'collected_data';
            referencedColumns: ['id'];
          },
        ];
      };
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
          triggered_by: string | null;
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
          triggered_by?: string | null;
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
          triggered_by?: string | null;
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
      areas: {
        Row: {
          cor: string;
          ordem: number;
          rotulo: string;
          slug: string;
          tipo_negocio: string;
        };
        Insert: {
          cor: string;
          ordem?: number;
          rotulo: string;
          slug: string;
          tipo_negocio?: string;
        };
        Update: {
          cor?: string;
          ordem?: number;
          rotulo?: string;
          slug?: string;
          tipo_negocio?: string;
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
      auditoria_eventos: {
        Row: {
          created_at: string | null;
          entidade: string;
          entidade_id: string | null;
          evento: string;
          id: string;
          projeto_id: string | null;
          snapshot_antes: Json | null;
          snapshot_depois: Json | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          entidade: string;
          entidade_id?: string | null;
          evento: string;
          id?: string;
          projeto_id?: string | null;
          snapshot_antes?: Json | null;
          snapshot_depois?: Json | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          entidade?: string;
          entidade_id?: string | null;
          evento?: string;
          id?: string;
          projeto_id?: string | null;
          snapshot_antes?: Json | null;
          snapshot_depois?: Json | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'auditoria_eventos_projeto_id_fkey';
            columns: ['projeto_id'];
            isOneToOne: false;
            referencedRelation: 'user_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'auditoria_eventos_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      bairros_alternativos: {
        Row: {
          academias_existentes: Json | null;
          bairro: string;
          concorrentes_no_bairro: number | null;
          id: string;
          metodologia: string | null;
          motivo: string | null;
          ordem: number | null;
          prioridade: string | null;
          relatorio_id: string;
          status_competitivo: string | null;
          ticket_sugerido: string | null;
        };
        Insert: {
          academias_existentes?: Json | null;
          bairro: string;
          concorrentes_no_bairro?: number | null;
          id?: string;
          metodologia?: string | null;
          motivo?: string | null;
          ordem?: number | null;
          prioridade?: string | null;
          relatorio_id: string;
          status_competitivo?: string | null;
          ticket_sugerido?: string | null;
        };
        Update: {
          academias_existentes?: Json | null;
          bairro?: string;
          concorrentes_no_bairro?: number | null;
          id?: string;
          metodologia?: string | null;
          motivo?: string | null;
          ordem?: number | null;
          prioridade?: string | null;
          relatorio_id?: string;
          status_competitivo?: string | null;
          ticket_sugerido?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'bairros_alternativos_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'relatorios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bairros_alternativos_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'v_relatorios_resumo';
            referencedColumns: ['id'];
          },
        ];
      };
      cache_geocode: {
        Row: {
          cached_at: string;
          endereco_norm: string;
          expires_at: string;
          hit_count: number;
          last_hit_at: string | null;
          lat: number | null;
          lng: number | null;
          payload: Json | null;
          source: string | null;
        };
        Insert: {
          cached_at?: string;
          endereco_norm: string;
          expires_at?: string;
          hit_count?: number;
          last_hit_at?: string | null;
          lat?: number | null;
          lng?: number | null;
          payload?: Json | null;
          source?: string | null;
        };
        Update: {
          cached_at?: string;
          endereco_norm?: string;
          expires_at?: string;
          hit_count?: number;
          last_hit_at?: string | null;
          lat?: number | null;
          lng?: number | null;
          payload?: Json | null;
          source?: string | null;
        };
        Relationships: [];
      };
      cache_reviews: {
        Row: {
          cached_at: string;
          expires_at: string;
          hit_count: number;
          place_id: string;
          reviews: Json | null;
          source: string | null;
        };
        Insert: {
          cached_at?: string;
          expires_at?: string;
          hit_count?: number;
          place_id: string;
          reviews?: Json | null;
          source?: string | null;
        };
        Update: {
          cached_at?: string;
          expires_at?: string;
          hit_count?: number;
          place_id?: string;
          reviews?: Json | null;
          source?: string | null;
        };
        Relationships: [];
      };
      candidatos: {
        Row: {
          area_estimada_m2: number | null;
          avenida_principal: boolean | null;
          cartorio: Json | null;
          created_at: string | null;
          endereco: string | null;
          estimativa_visibilidade: string | null;
          id: string;
          lat: number | null;
          listing_id: string | null;
          listing_source: string | null;
          listing_url: string | null;
          lng: number | null;
          modalidade: string | null;
          motivo: string | null;
          nome: string;
          place_id: string | null;
          polos_geradores: Json | null;
          posicao: number;
          price_raw: string | null;
          proximo_passo: string | null;
          qualidade_sinal: string | null;
          relatorio_id: string;
          score_ancoragem: number | null;
          score_geoscout: number | null;
          score_geral: number | null;
          status_business: string | null;
          street_view_url: string | null;
          telefone: string | null;
          tem_24h: boolean | null;
          tipo: string | null;
          tipo_imovel_codigo_onr: number | null;
          tipo_imovel_label: string | null;
          tipos_google: Json | null;
          website: string | null;
        };
        Insert: {
          area_estimada_m2?: number | null;
          avenida_principal?: boolean | null;
          cartorio?: Json | null;
          created_at?: string | null;
          endereco?: string | null;
          estimativa_visibilidade?: string | null;
          id?: string;
          lat?: number | null;
          listing_id?: string | null;
          listing_source?: string | null;
          listing_url?: string | null;
          lng?: number | null;
          modalidade?: string | null;
          motivo?: string | null;
          nome: string;
          place_id?: string | null;
          polos_geradores?: Json | null;
          posicao: number;
          price_raw?: string | null;
          proximo_passo?: string | null;
          qualidade_sinal?: string | null;
          relatorio_id: string;
          score_ancoragem?: number | null;
          score_geoscout?: number | null;
          score_geral?: number | null;
          status_business?: string | null;
          street_view_url?: string | null;
          telefone?: string | null;
          tem_24h?: boolean | null;
          tipo?: string | null;
          tipo_imovel_codigo_onr?: number | null;
          tipo_imovel_label?: string | null;
          tipos_google?: Json | null;
          website?: string | null;
        };
        Update: {
          area_estimada_m2?: number | null;
          avenida_principal?: boolean | null;
          cartorio?: Json | null;
          created_at?: string | null;
          endereco?: string | null;
          estimativa_visibilidade?: string | null;
          id?: string;
          lat?: number | null;
          listing_id?: string | null;
          listing_source?: string | null;
          listing_url?: string | null;
          lng?: number | null;
          modalidade?: string | null;
          motivo?: string | null;
          nome?: string;
          place_id?: string | null;
          polos_geradores?: Json | null;
          posicao?: number;
          price_raw?: string | null;
          proximo_passo?: string | null;
          qualidade_sinal?: string | null;
          relatorio_id?: string;
          score_ancoragem?: number | null;
          score_geoscout?: number | null;
          score_geral?: number | null;
          status_business?: string | null;
          street_view_url?: string | null;
          telefone?: string | null;
          tem_24h?: boolean | null;
          tipo?: string | null;
          tipo_imovel_codigo_onr?: number | null;
          tipo_imovel_label?: string | null;
          tipos_google?: Json | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'candidatos_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'relatorios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'candidatos_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'v_relatorios_resumo';
            referencedColumns: ['id'];
          },
        ];
      };
      catalogos_metodologia: {
        Row: {
          atualizado_em: string | null;
          catalogo: string;
          chave: string;
          fonte: string | null;
          metadata: Json | null;
          sinonimos: string[] | null;
          valor: string;
        };
        Insert: {
          atualizado_em?: string | null;
          catalogo: string;
          chave: string;
          fonte?: string | null;
          metadata?: Json | null;
          sinonimos?: string[] | null;
          valor: string;
        };
        Update: {
          atualizado_em?: string | null;
          catalogo?: string;
          chave?: string;
          fonte?: string | null;
          metadata?: Json | null;
          sinonimos?: string[] | null;
          valor?: string;
        };
        Relationships: [];
      };
      cenarios_financeiros: {
        Row: {
          alunos_break_even: number | null;
          alunos_pico_calculado: number | null;
          alunos_projetados: number | null;
          capacidade_maxima_alunos: number | null;
          capacidade_simultanea_pico: number | null;
          capex_alvara_e_taxas: number | null;
          capex_contingencia_pct: number | null;
          capex_contingencia_valor: number | null;
          capex_equipamentos: number | null;
          capex_estimado: number | null;
          capex_obra_adaptacao: number | null;
          capex_projeto_arquitetonico: number | null;
          capex_total: number | null;
          capital_giro: number | null;
          capital_giro_meses: number | null;
          custo_agua: number | null;
          custo_aluguel: number | null;
          custo_condominio: number | null;
          custo_contabilidade: number | null;
          custo_energia: number | null;
          custo_folha: number | null;
          custo_internet: number | null;
          custo_iptu: number | null;
          custo_manutencao: number | null;
          custo_outros: number | null;
          custo_seguro: number | null;
          custo_sistema_gestao: number | null;
          custos_fixos: number | null;
          custos_fixos_total: number | null;
          custos_totais: number | null;
          folga_capacidade_pct: number | null;
          frequencia_semanal_aluno: number | null;
          id: string;
          investimento_total: number | null;
          justificativa: string | null;
          lucro_mensal_estimado: number | null;
          margem_percentual: number | null;
          marketing_mensal: number | null;
          marketing_pct_faturamento: number | null;
          matr_por_m2_realista: number | null;
          matriculas_agressivo: number | null;
          matriculas_conservador: number | null;
          matriculas_realista: number | null;
          modelo: Database['public']['Enums']['cenario_modelo'];
          payback_meses: number | null;
          pico_share: number | null;
          receita_mensal: number | null;
          relatorio_id: string;
          taxa_cancelamento_mensal: number | null;
          taxa_inadimplencia: number | null;
          ticket_medio: number | null;
          ticket_realizado_estimado: number | null;
          tir_anual_pct: number | null;
          viabilidade: Database['public']['Enums']['viabilidade_status'] | null;
          vpl_5_anos: number | null;
        };
        Insert: {
          alunos_break_even?: number | null;
          alunos_pico_calculado?: number | null;
          alunos_projetados?: number | null;
          capacidade_maxima_alunos?: number | null;
          capacidade_simultanea_pico?: number | null;
          capex_alvara_e_taxas?: number | null;
          capex_contingencia_pct?: number | null;
          capex_contingencia_valor?: number | null;
          capex_equipamentos?: number | null;
          capex_estimado?: number | null;
          capex_obra_adaptacao?: number | null;
          capex_projeto_arquitetonico?: number | null;
          capex_total?: number | null;
          capital_giro?: number | null;
          capital_giro_meses?: number | null;
          custo_agua?: number | null;
          custo_aluguel?: number | null;
          custo_condominio?: number | null;
          custo_contabilidade?: number | null;
          custo_energia?: number | null;
          custo_folha?: number | null;
          custo_internet?: number | null;
          custo_iptu?: number | null;
          custo_manutencao?: number | null;
          custo_outros?: number | null;
          custo_seguro?: number | null;
          custo_sistema_gestao?: number | null;
          custos_fixos?: number | null;
          custos_fixos_total?: number | null;
          custos_totais?: number | null;
          folga_capacidade_pct?: number | null;
          frequencia_semanal_aluno?: number | null;
          id?: string;
          investimento_total?: number | null;
          justificativa?: string | null;
          lucro_mensal_estimado?: number | null;
          margem_percentual?: number | null;
          marketing_mensal?: number | null;
          marketing_pct_faturamento?: number | null;
          matr_por_m2_realista?: number | null;
          matriculas_agressivo?: number | null;
          matriculas_conservador?: number | null;
          matriculas_realista?: number | null;
          modelo: Database['public']['Enums']['cenario_modelo'];
          payback_meses?: number | null;
          pico_share?: number | null;
          receita_mensal?: number | null;
          relatorio_id: string;
          taxa_cancelamento_mensal?: number | null;
          taxa_inadimplencia?: number | null;
          ticket_medio?: number | null;
          ticket_realizado_estimado?: number | null;
          tir_anual_pct?: number | null;
          viabilidade?: Database['public']['Enums']['viabilidade_status'] | null;
          vpl_5_anos?: number | null;
        };
        Update: {
          alunos_break_even?: number | null;
          alunos_pico_calculado?: number | null;
          alunos_projetados?: number | null;
          capacidade_maxima_alunos?: number | null;
          capacidade_simultanea_pico?: number | null;
          capex_alvara_e_taxas?: number | null;
          capex_contingencia_pct?: number | null;
          capex_contingencia_valor?: number | null;
          capex_equipamentos?: number | null;
          capex_estimado?: number | null;
          capex_obra_adaptacao?: number | null;
          capex_projeto_arquitetonico?: number | null;
          capex_total?: number | null;
          capital_giro?: number | null;
          capital_giro_meses?: number | null;
          custo_agua?: number | null;
          custo_aluguel?: number | null;
          custo_condominio?: number | null;
          custo_contabilidade?: number | null;
          custo_energia?: number | null;
          custo_folha?: number | null;
          custo_internet?: number | null;
          custo_iptu?: number | null;
          custo_manutencao?: number | null;
          custo_outros?: number | null;
          custo_seguro?: number | null;
          custo_sistema_gestao?: number | null;
          custos_fixos?: number | null;
          custos_fixos_total?: number | null;
          custos_totais?: number | null;
          folga_capacidade_pct?: number | null;
          frequencia_semanal_aluno?: number | null;
          id?: string;
          investimento_total?: number | null;
          justificativa?: string | null;
          lucro_mensal_estimado?: number | null;
          margem_percentual?: number | null;
          marketing_mensal?: number | null;
          marketing_pct_faturamento?: number | null;
          matr_por_m2_realista?: number | null;
          matriculas_agressivo?: number | null;
          matriculas_conservador?: number | null;
          matriculas_realista?: number | null;
          modelo?: Database['public']['Enums']['cenario_modelo'];
          payback_meses?: number | null;
          pico_share?: number | null;
          receita_mensal?: number | null;
          relatorio_id?: string;
          taxa_cancelamento_mensal?: number | null;
          taxa_inadimplencia?: number | null;
          ticket_medio?: number | null;
          ticket_realizado_estimado?: number | null;
          tir_anual_pct?: number | null;
          viabilidade?: Database['public']['Enums']['viabilidade_status'] | null;
          vpl_5_anos?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cenarios_financeiros_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'relatorios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cenarios_financeiros_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'v_relatorios_resumo';
            referencedColumns: ['id'];
          },
        ];
      };
      censo_setor: {
        Row: {
          ano: number;
          domicilios: number | null;
          id_municipio: string;
          id_setor: string;
          lat: number | null;
          lng: number | null;
          media_moradores: number | null;
          pessoas: number | null;
          updated_at: string;
        };
        Insert: {
          ano?: number;
          domicilios?: number | null;
          id_municipio: string;
          id_setor: string;
          lat?: number | null;
          lng?: number | null;
          media_moradores?: number | null;
          pessoas?: number | null;
          updated_at?: string;
        };
        Update: {
          ano?: number;
          domicilios?: number | null;
          id_municipio?: string;
          id_setor?: string;
          lat?: number | null;
          lng?: number | null;
          media_moradores?: number | null;
          pessoas?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      censo_setor_idade_sexo: {
        Row: {
          h_15_24: number | null;
          h_25_39: number | null;
          h_40_59: number | null;
          h_60_mais: number | null;
          h_total: number | null;
          id_municipio: string;
          id_setor: string;
          lat: number | null;
          lng: number | null;
          m_15_24: number | null;
          m_25_39: number | null;
          m_40_59: number | null;
          m_60_mais: number | null;
          m_total: number | null;
          pessoas: number | null;
          updated_at: string | null;
        };
        Insert: {
          h_15_24?: number | null;
          h_25_39?: number | null;
          h_40_59?: number | null;
          h_60_mais?: number | null;
          h_total?: number | null;
          id_municipio: string;
          id_setor: string;
          lat?: number | null;
          lng?: number | null;
          m_15_24?: number | null;
          m_25_39?: number | null;
          m_40_59?: number | null;
          m_60_mais?: number | null;
          m_total?: number | null;
          pessoas?: number | null;
          updated_at?: string | null;
        };
        Update: {
          h_15_24?: number | null;
          h_25_39?: number | null;
          h_40_59?: number | null;
          h_60_mais?: number | null;
          h_total?: number | null;
          id_municipio?: string;
          id_setor?: string;
          lat?: number | null;
          lng?: number | null;
          m_15_24?: number | null;
          m_25_39?: number | null;
          m_40_59?: number | null;
          m_60_mais?: number | null;
          m_total?: number | null;
          pessoas?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      chat_interacoes: {
        Row: {
          correcao: string | null;
          created_at: string;
          endpoint: string;
          feedback: number | null;
          feedback_comentario: string | null;
          feedback_em: string | null;
          id: string;
          intencao: string | null;
          kb_fontes: Json;
          modelo: string | null;
          pergunta: string;
          relatorio_id: string | null;
          resposta: string;
          session_id: string | null;
          user_id: string;
        };
        Insert: {
          correcao?: string | null;
          created_at?: string;
          endpoint: string;
          feedback?: number | null;
          feedback_comentario?: string | null;
          feedback_em?: string | null;
          id?: string;
          intencao?: string | null;
          kb_fontes?: Json;
          modelo?: string | null;
          pergunta: string;
          relatorio_id?: string | null;
          resposta: string;
          session_id?: string | null;
          user_id: string;
        };
        Update: {
          correcao?: string | null;
          created_at?: string;
          endpoint?: string;
          feedback?: number | null;
          feedback_comentario?: string | null;
          feedback_em?: string | null;
          id?: string;
          intencao?: string | null;
          kb_fontes?: Json;
          modelo?: string | null;
          pergunta?: string;
          relatorio_id?: string | null;
          resposta?: string;
          session_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
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
            referencedRelation: 'orders';
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
      cno_obras_fitness: {
        Row: {
          area_m2: number | null;
          bairro: string | null;
          cep: string | null;
          data_inicio: string | null;
          data_situacao: string | null;
          em_curso: boolean | null;
          fonte: string;
          id_cno: string;
          id_municipio: string | null;
          id_municipio_rf: string | null;
          logradouro: string | null;
          metodo_classificacao: string | null;
          ni_responsavel: string | null;
          nome: string | null;
          nome_empresarial: string | null;
          nome_responsavel: string | null;
          numero_logradouro: string | null;
          qualificacao_responsavel: string | null;
          raw: Json | null;
          sigla_uf: string | null;
          situacao: string | null;
          tipo_logradouro: string | null;
          updated_at: string;
        };
        Insert: {
          area_m2?: number | null;
          bairro?: string | null;
          cep?: string | null;
          data_inicio?: string | null;
          data_situacao?: string | null;
          em_curso?: boolean | null;
          fonte?: string;
          id_cno: string;
          id_municipio?: string | null;
          id_municipio_rf?: string | null;
          logradouro?: string | null;
          metodo_classificacao?: string | null;
          ni_responsavel?: string | null;
          nome?: string | null;
          nome_empresarial?: string | null;
          nome_responsavel?: string | null;
          numero_logradouro?: string | null;
          qualificacao_responsavel?: string | null;
          raw?: Json | null;
          sigla_uf?: string | null;
          situacao?: string | null;
          tipo_logradouro?: string | null;
          updated_at?: string;
        };
        Update: {
          area_m2?: number | null;
          bairro?: string | null;
          cep?: string | null;
          data_inicio?: string | null;
          data_situacao?: string | null;
          em_curso?: boolean | null;
          fonte?: string;
          id_cno?: string;
          id_municipio?: string | null;
          id_municipio_rf?: string | null;
          logradouro?: string | null;
          metodo_classificacao?: string | null;
          ni_responsavel?: string | null;
          nome?: string | null;
          nome_empresarial?: string | null;
          nome_responsavel?: string | null;
          numero_logradouro?: string | null;
          qualificacao_responsavel?: string | null;
          raw?: Json | null;
          sigla_uf?: string | null;
          situacao?: string | null;
          tipo_logradouro?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      cno_obras_grande_porte: {
        Row: {
          area_m2: number | null;
          bairro: string | null;
          cep: string | null;
          data_inicio: string | null;
          data_situacao: string | null;
          em_curso: boolean | null;
          fonte: string;
          id_cno: string;
          id_municipio: string | null;
          id_municipio_rf: string | null;
          logradouro: string | null;
          ni_responsavel: string | null;
          nome: string | null;
          numero_logradouro: string | null;
          raw: Json | null;
          sigla_uf: string | null;
          situacao: string | null;
          tipo_logradouro: string | null;
          updated_at: string;
        };
        Insert: {
          area_m2?: number | null;
          bairro?: string | null;
          cep?: string | null;
          data_inicio?: string | null;
          data_situacao?: string | null;
          em_curso?: boolean | null;
          fonte?: string;
          id_cno: string;
          id_municipio?: string | null;
          id_municipio_rf?: string | null;
          logradouro?: string | null;
          ni_responsavel?: string | null;
          nome?: string | null;
          numero_logradouro?: string | null;
          raw?: Json | null;
          sigla_uf?: string | null;
          situacao?: string | null;
          tipo_logradouro?: string | null;
          updated_at?: string;
        };
        Update: {
          area_m2?: number | null;
          bairro?: string | null;
          cep?: string | null;
          data_inicio?: string | null;
          data_situacao?: string | null;
          em_curso?: boolean | null;
          fonte?: string;
          id_cno?: string;
          id_municipio?: string | null;
          id_municipio_rf?: string | null;
          logradouro?: string | null;
          ni_responsavel?: string | null;
          nome?: string | null;
          numero_logradouro?: string | null;
          raw?: Json | null;
          sigla_uf?: string | null;
          situacao?: string | null;
          tipo_logradouro?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      cnpj_contato_cache: {
        Row: {
          bairro: string | null;
          cnpj: string;
          email: string | null;
          enriched_at: string;
          expires_at: string;
          fonte: string;
          municipio: string | null;
          nome_fantasia: string | null;
          qsa: Json;
          razao_social: string | null;
          socio_administrador: Json | null;
          telefone: string | null;
          uf: string | null;
        };
        Insert: {
          bairro?: string | null;
          cnpj: string;
          email?: string | null;
          enriched_at?: string;
          expires_at: string;
          fonte?: string;
          municipio?: string | null;
          nome_fantasia?: string | null;
          qsa?: Json;
          razao_social?: string | null;
          socio_administrador?: Json | null;
          telefone?: string | null;
          uf?: string | null;
        };
        Update: {
          bairro?: string | null;
          cnpj?: string;
          email?: string | null;
          enriched_at?: string;
          expires_at?: string;
          fonte?: string;
          municipio?: string | null;
          nome_fantasia?: string | null;
          qsa?: Json;
          razao_social?: string | null;
          socio_administrador?: Json | null;
          telefone?: string | null;
          uf?: string | null;
        };
        Relationships: [];
      };
      cnpj_fitness_estabelecimentos: {
        Row: {
          bairro: string | null;
          cep: string | null;
          cidade: string | null;
          cnae_fiscal_principal: string | null;
          cnaes_secundarios: string | null;
          cnpj: string;
          complemento: string | null;
          created_at: string;
          data_inicio_atividade: string | null;
          data_situacao_cadastral: string | null;
          email: string | null;
          id: string;
          logradouro: string | null;
          municipio_codigo: string | null;
          nome_fantasia: string | null;
          numero: string | null;
          razao_social: string | null;
          ref_month: string;
          segmento_operacao: string | null;
          situacao_cadastral: number | null;
          telefone: string | null;
          uf: string | null;
        };
        Insert: {
          bairro?: string | null;
          cep?: string | null;
          cidade?: string | null;
          cnae_fiscal_principal?: string | null;
          cnaes_secundarios?: string | null;
          cnpj: string;
          complemento?: string | null;
          created_at?: string;
          data_inicio_atividade?: string | null;
          data_situacao_cadastral?: string | null;
          email?: string | null;
          id?: string;
          logradouro?: string | null;
          municipio_codigo?: string | null;
          nome_fantasia?: string | null;
          numero?: string | null;
          razao_social?: string | null;
          ref_month: string;
          segmento_operacao?: string | null;
          situacao_cadastral?: number | null;
          telefone?: string | null;
          uf?: string | null;
        };
        Update: {
          bairro?: string | null;
          cep?: string | null;
          cidade?: string | null;
          cnae_fiscal_principal?: string | null;
          cnaes_secundarios?: string | null;
          cnpj?: string;
          complemento?: string | null;
          created_at?: string;
          data_inicio_atividade?: string | null;
          data_situacao_cadastral?: string | null;
          email?: string | null;
          id?: string;
          logradouro?: string | null;
          municipio_codigo?: string | null;
          nome_fantasia?: string | null;
          numero?: string | null;
          razao_social?: string | null;
          ref_month?: string;
          segmento_operacao?: string | null;
          situacao_cadastral?: number | null;
          telefone?: string | null;
          uf?: string | null;
        };
        Relationships: [];
      };
      collected_data: {
        Row: {
          collected_at: string | null;
          id: string;
          markdown: string;
          processed: boolean | null;
          raw: Json | null;
          source_ref: string;
          source_type: string;
          task_id: string | null;
        };
        Insert: {
          collected_at?: string | null;
          id?: string;
          markdown: string;
          processed?: boolean | null;
          raw?: Json | null;
          source_ref: string;
          source_type: string;
          task_id?: string | null;
        };
        Update: {
          collected_at?: string | null;
          id?: string;
          markdown?: string;
          processed?: boolean | null;
          raw?: Json | null;
          source_ref?: string;
          source_type?: string;
          task_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'collected_data_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
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
          sender_2_data: Json | null;
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
          sender_2_data?: Json | null;
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
          sender_2_data?: Json | null;
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
      commercial_closeout_events: {
        Row: {
          closeout_type: string;
          created_at: string;
          id: string;
          message_event_id: string | null;
          payload: Json;
          quote_id: string;
        };
        Insert: {
          closeout_type: string;
          created_at?: string;
          id?: string;
          message_event_id?: string | null;
          payload?: Json;
          quote_id: string;
        };
        Update: {
          closeout_type?: string;
          created_at?: string;
          id?: string;
          message_event_id?: string | null;
          payload?: Json;
          quote_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'commercial_closeout_events_message_event_id_fkey';
            columns: ['message_event_id'];
            isOneToOne: false;
            referencedRelation: 'commercial_message_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_closeout_events_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_closeout_events_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'commercial_closeout_events_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_payment_reconciliation';
            referencedColumns: ['quote_id'];
          },
        ];
      };
      commercial_followup_rules: {
        Row: {
          active: boolean;
          channel: string;
          created_at: string;
          id: string;
          max_attempts: number;
          name: string;
          offset_minutes: number;
          priority: number;
          quote_stage: string;
          requires_estimated_loading_date: boolean;
          stop_on_reply: boolean;
          stop_on_stage_change: boolean;
          strategy_key: string;
          template_key: string;
          trigger_after_minutes: number;
          trigger_anchor: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          channel: string;
          created_at?: string;
          id?: string;
          max_attempts?: number;
          name: string;
          offset_minutes?: number;
          priority?: number;
          quote_stage: string;
          requires_estimated_loading_date?: boolean;
          stop_on_reply?: boolean;
          stop_on_stage_change?: boolean;
          strategy_key?: string;
          template_key: string;
          trigger_after_minutes?: number;
          trigger_anchor?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          channel?: string;
          created_at?: string;
          id?: string;
          max_attempts?: number;
          name?: string;
          offset_minutes?: number;
          priority?: number;
          quote_stage?: string;
          requires_estimated_loading_date?: boolean;
          stop_on_reply?: boolean;
          stop_on_stage_change?: boolean;
          strategy_key?: string;
          template_key?: string;
          trigger_after_minutes?: number;
          trigger_anchor?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      commercial_followup_runs: {
        Row: {
          attempt_no: number;
          channel: string;
          created_at: string;
          id: string;
          notification_log_id: string | null;
          quote_id: string;
          recipient_email: string | null;
          recipient_phone: string | null;
          replied_at: string | null;
          rule_id: string;
          sent_at: string | null;
          status: string;
          stopped_reason: string | null;
          target_type: string | null;
          template_key: string;
        };
        Insert: {
          attempt_no: number;
          channel: string;
          created_at?: string;
          id?: string;
          notification_log_id?: string | null;
          quote_id: string;
          recipient_email?: string | null;
          recipient_phone?: string | null;
          replied_at?: string | null;
          rule_id: string;
          sent_at?: string | null;
          status?: string;
          stopped_reason?: string | null;
          target_type?: string | null;
          template_key: string;
        };
        Update: {
          attempt_no?: number;
          channel?: string;
          created_at?: string;
          id?: string;
          notification_log_id?: string | null;
          quote_id?: string;
          recipient_email?: string | null;
          recipient_phone?: string | null;
          replied_at?: string | null;
          rule_id?: string;
          sent_at?: string | null;
          status?: string;
          stopped_reason?: string | null;
          target_type?: string | null;
          template_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'commercial_followup_runs_notification_log_id_fkey';
            columns: ['notification_log_id'];
            isOneToOne: false;
            referencedRelation: 'notification_logs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_followup_runs_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_followup_runs_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'commercial_followup_runs_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_payment_reconciliation';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'commercial_followup_runs_rule_id_fkey';
            columns: ['rule_id'];
            isOneToOne: false;
            referencedRelation: 'commercial_followup_rules';
            referencedColumns: ['id'];
          },
        ];
      };
      commercial_message_events: {
        Row: {
          channel: string;
          classification: string | null;
          client_id: string | null;
          created_at: string;
          direction: string;
          external_message_id: string | null;
          id: string;
          message_text: string | null;
          metadata: Json;
          phone: string | null;
          quote_id: string | null;
          shipper_id: string | null;
          target_email: string | null;
          target_name: string | null;
          target_type: string | null;
          template_key: string | null;
        };
        Insert: {
          channel: string;
          classification?: string | null;
          client_id?: string | null;
          created_at?: string;
          direction: string;
          external_message_id?: string | null;
          id?: string;
          message_text?: string | null;
          metadata?: Json;
          phone?: string | null;
          quote_id?: string | null;
          shipper_id?: string | null;
          target_email?: string | null;
          target_name?: string | null;
          target_type?: string | null;
          template_key?: string | null;
        };
        Update: {
          channel?: string;
          classification?: string | null;
          client_id?: string | null;
          created_at?: string;
          direction?: string;
          external_message_id?: string | null;
          id?: string;
          message_text?: string | null;
          metadata?: Json;
          phone?: string | null;
          quote_id?: string | null;
          shipper_id?: string | null;
          target_email?: string | null;
          target_name?: string | null;
          target_type?: string | null;
          template_key?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'commercial_message_events_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_message_events_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_message_events_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'commercial_message_events_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_payment_reconciliation';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'commercial_message_events_shipper_id_fkey';
            columns: ['shipper_id'];
            isOneToOne: false;
            referencedRelation: 'shippers';
            referencedColumns: ['id'];
          },
        ];
      };
      commercial_operational_handoffs: {
        Row: {
          blockers: Json;
          created_at: string;
          handoff_status: string;
          handoff_summary: Json;
          id: string;
          missing_fields: Json;
          operational_owner_name: string | null;
          order_id: string | null;
          quote_id: string;
          source: string;
          updated_at: string;
        };
        Insert: {
          blockers?: Json;
          created_at?: string;
          handoff_status?: string;
          handoff_summary?: Json;
          id?: string;
          missing_fields?: Json;
          operational_owner_name?: string | null;
          order_id?: string | null;
          quote_id: string;
          source?: string;
          updated_at?: string;
        };
        Update: {
          blockers?: Json;
          created_at?: string;
          handoff_status?: string;
          handoff_summary?: Json;
          id?: string;
          missing_fields?: Json;
          operational_owner_name?: string | null;
          order_id?: string | null;
          quote_id?: string;
          source?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'commercial_operational_handoffs_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_operational_handoffs_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders_rs_per_km';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'commercial_operational_handoffs_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_order_payment_reconciliation';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'commercial_operational_handoffs_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'commercial_operational_handoffs_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_financial_details';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'commercial_operational_handoffs_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'vw_order_risk_status';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'commercial_operational_handoffs_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_operational_handoffs_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'commercial_operational_handoffs_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_payment_reconciliation';
            referencedColumns: ['quote_id'];
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
          id: string;
          legal_name: string;
          legal_representative_cpf: string | null;
          legal_representative_name: string | null;
          legal_representative_role: string | null;
          municipal_registration: string | null;
          signature_city: string;
          singleton: boolean;
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
          id?: string;
          legal_name?: string;
          legal_representative_cpf?: string | null;
          legal_representative_name?: string | null;
          legal_representative_role?: string | null;
          municipal_registration?: string | null;
          signature_city?: string;
          singleton?: boolean;
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
          id?: string;
          legal_name?: string;
          legal_representative_cpf?: string | null;
          legal_representative_name?: string | null;
          legal_representative_role?: string | null;
          municipal_registration?: string | null;
          signature_city?: string;
          singleton?: boolean;
          state_registration?: string;
          trade_name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      competidor_intel_cache: {
        Row: {
          bairro: string | null;
          cidade: string | null;
          collected_at: string;
          instagram_username: string | null;
          metricas: Json | null;
          place_id: string;
          planos_precos: Json | null;
          posts_slim: Json | null;
          profile: Json | null;
          servicos: Json | null;
          updated_at: string;
        };
        Insert: {
          bairro?: string | null;
          cidade?: string | null;
          collected_at?: string;
          instagram_username?: string | null;
          metricas?: Json | null;
          place_id: string;
          planos_precos?: Json | null;
          posts_slim?: Json | null;
          profile?: Json | null;
          servicos?: Json | null;
          updated_at?: string;
        };
        Update: {
          bairro?: string | null;
          cidade?: string | null;
          collected_at?: string;
          instagram_username?: string | null;
          metricas?: Json | null;
          place_id?: string;
          planos_precos?: Json | null;
          posts_slim?: Json | null;
          profile?: Json | null;
          servicos?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      competidores: {
        Row: {
          atividade_marketing: Json | null;
          bairro_concorrente: string | null;
          created_at: string | null;
          distancia_km: number | null;
          endereco: string | null;
          google_maps_uri: string | null;
          horarios_pico: Json | null;
          id: string;
          instagram_profile: Json | null;
          lat: number | null;
          lng: number | null;
          nome: string;
          num_avaliacoes: number | null;
          oferta_mapeada: Json | null;
          origem_busca: string | null;
          pico_semanal: string | null;
          place_id: string | null;
          planos_precos: Json | null;
          rating_oficial: number | null;
          relatorio_id: string;
          reviews: Json | null;
          telefone: string | null;
          tem_24h: boolean | null;
          website: string | null;
          whatsapp_link: string | null;
        };
        Insert: {
          atividade_marketing?: Json | null;
          bairro_concorrente?: string | null;
          created_at?: string | null;
          distancia_km?: number | null;
          endereco?: string | null;
          google_maps_uri?: string | null;
          horarios_pico?: Json | null;
          id?: string;
          instagram_profile?: Json | null;
          lat?: number | null;
          lng?: number | null;
          nome: string;
          num_avaliacoes?: number | null;
          oferta_mapeada?: Json | null;
          origem_busca?: string | null;
          pico_semanal?: string | null;
          place_id?: string | null;
          planos_precos?: Json | null;
          rating_oficial?: number | null;
          relatorio_id: string;
          reviews?: Json | null;
          telefone?: string | null;
          tem_24h?: boolean | null;
          website?: string | null;
          whatsapp_link?: string | null;
        };
        Update: {
          atividade_marketing?: Json | null;
          bairro_concorrente?: string | null;
          created_at?: string | null;
          distancia_km?: number | null;
          endereco?: string | null;
          google_maps_uri?: string | null;
          horarios_pico?: Json | null;
          id?: string;
          instagram_profile?: Json | null;
          lat?: number | null;
          lng?: number | null;
          nome?: string;
          num_avaliacoes?: number | null;
          oferta_mapeada?: Json | null;
          origem_busca?: string | null;
          pico_semanal?: string | null;
          place_id?: string | null;
          planos_precos?: Json | null;
          rating_oficial?: number | null;
          relatorio_id?: string;
          reviews?: Json | null;
          telefone?: string | null;
          tem_24h?: boolean | null;
          website?: string | null;
          whatsapp_link?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'competidores_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'relatorios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'competidores_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'v_relatorios_resumo';
            referencedColumns: ['id'];
          },
        ];
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
      'd1-wrapper': {
        Row: {
          _attrs: Json | null;
          created_at: string | null;
          file_size: number | null;
          name: string | null;
          num_tables: number | null;
          uuid: string | null;
          version: string | null;
        };
        Insert: {
          _attrs?: Json | null;
          created_at?: string | null;
          file_size?: number | null;
          name?: string | null;
          num_tables?: number | null;
          uuid?: string | null;
          version?: string | null;
        };
        Update: {
          _attrs?: Json | null;
          created_at?: string | null;
          file_size?: number | null;
          name?: string | null;
          num_tables?: number | null;
          uuid?: string | null;
          version?: string | null;
        };
        Relationships: [];
      };
      delivery_assessments: {
        Row: {
          alertas: Json | null;
          cargo_type: string | null;
          carroceria_recomendada: string | null;
          chapas_recomendados: number | null;
          chapas_solicitados: number | null;
          cidade: string | null;
          created_at: string | null;
          custo_chapas_rs: number | null;
          endereco: string;
          endereco_formatado: string | null;
          equipamento_apoio: string | null;
          estado: string | null;
          id: string;
          lat: number | null;
          lng: number | null;
          maps_url: string | null;
          nivel_dificuldade: string | null;
          notas: string | null;
          order_id: string | null;
          perguntas_pendentes: Json | null;
          peso_kg: number | null;
          quote_id: string | null;
          respostas_qualificacao: Json | null;
          restricao_aet: Json | null;
          score_detalhado: Json | null;
          score_total: number | null;
          status: string | null;
          street_view_disponivel: boolean | null;
          street_view_url: string | null;
          updated_at: string | null;
          veiculo_recomendado: string | null;
          volume_m3: number | null;
          volumes: number | null;
        };
        Insert: {
          alertas?: Json | null;
          cargo_type?: string | null;
          carroceria_recomendada?: string | null;
          chapas_recomendados?: number | null;
          chapas_solicitados?: number | null;
          cidade?: string | null;
          created_at?: string | null;
          custo_chapas_rs?: number | null;
          endereco: string;
          endereco_formatado?: string | null;
          equipamento_apoio?: string | null;
          estado?: string | null;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          maps_url?: string | null;
          nivel_dificuldade?: string | null;
          notas?: string | null;
          order_id?: string | null;
          perguntas_pendentes?: Json | null;
          peso_kg?: number | null;
          quote_id?: string | null;
          respostas_qualificacao?: Json | null;
          restricao_aet?: Json | null;
          score_detalhado?: Json | null;
          score_total?: number | null;
          status?: string | null;
          street_view_disponivel?: boolean | null;
          street_view_url?: string | null;
          updated_at?: string | null;
          veiculo_recomendado?: string | null;
          volume_m3?: number | null;
          volumes?: number | null;
        };
        Update: {
          alertas?: Json | null;
          cargo_type?: string | null;
          carroceria_recomendada?: string | null;
          chapas_recomendados?: number | null;
          chapas_solicitados?: number | null;
          cidade?: string | null;
          created_at?: string | null;
          custo_chapas_rs?: number | null;
          endereco?: string;
          endereco_formatado?: string | null;
          equipamento_apoio?: string | null;
          estado?: string | null;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          maps_url?: string | null;
          nivel_dificuldade?: string | null;
          notas?: string | null;
          order_id?: string | null;
          perguntas_pendentes?: Json | null;
          peso_kg?: number | null;
          quote_id?: string | null;
          respostas_qualificacao?: Json | null;
          restricao_aet?: Json | null;
          score_detalhado?: Json | null;
          score_total?: number | null;
          status?: string | null;
          street_view_disponivel?: boolean | null;
          street_view_url?: string | null;
          updated_at?: string | null;
          veiculo_recomendado?: string | null;
          volume_m3?: number | null;
          volumes?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'delivery_assessments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'delivery_assessments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders_rs_per_km';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'delivery_assessments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_order_payment_reconciliation';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'delivery_assessments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'delivery_assessments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_financial_details';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'delivery_assessments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'vw_order_risk_status';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'delivery_assessments_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'delivery_assessments_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'delivery_assessments_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_payment_reconciliation';
            referencedColumns: ['quote_id'];
          },
        ];
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
          validation_errors: string[] | null;
          validation_metadata: Json | null;
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
          validation_errors?: string[] | null;
          validation_metadata?: Json | null;
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
          validation_errors?: string[] | null;
          validation_metadata?: Json | null;
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
      driver_offer_ranking_config: {
        Row: {
          buonny_cargo_value_threshold: number;
          id: number;
          max_offers_default: number;
          max_timeouts_before_escalation: number;
          min_quality_score: number;
          timeout_hours_default: number;
          updated_at: string;
          weight_price: number;
          weight_proximity: number;
          weight_quality_score: number;
          weight_route_history: number;
        };
        Insert: {
          buonny_cargo_value_threshold?: number;
          id?: number;
          max_offers_default?: number;
          max_timeouts_before_escalation?: number;
          min_quality_score?: number;
          timeout_hours_default?: number;
          updated_at?: string;
          weight_price?: number;
          weight_proximity?: number;
          weight_quality_score?: number;
          weight_route_history?: number;
        };
        Update: {
          buonny_cargo_value_threshold?: number;
          id?: number;
          max_offers_default?: number;
          max_timeouts_before_escalation?: number;
          min_quality_score?: number;
          timeout_hours_default?: number;
          updated_at?: string;
          weight_price?: number;
          weight_proximity?: number;
          weight_quality_score?: number;
          weight_route_history?: number;
        };
        Relationships: [];
      };
      driver_offer_sequences: {
        Row: {
          accepted_at: string | null;
          accepted_driver_id: string | null;
          cargo_type: string | null;
          cargo_value: number | null;
          created_at: string;
          created_by: string | null;
          current_position: number;
          destination: string | null;
          destination_city: string | null;
          destination_state: string | null;
          escalated_at: string | null;
          escalation_reason: string | null;
          estimated_loading_date: string | null;
          id: string;
          max_offers: number;
          order_id: string | null;
          origin: string | null;
          origin_city: string | null;
          origin_state: string | null;
          quote_id: string;
          status: Database['public']['Enums']['offer_sequence_status'];
          timeout_hours: number;
          trip_id: string | null;
          updated_at: string;
          vehicle_type_id: string | null;
          weight: number | null;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_driver_id?: string | null;
          cargo_type?: string | null;
          cargo_value?: number | null;
          created_at?: string;
          created_by?: string | null;
          current_position?: number;
          destination?: string | null;
          destination_city?: string | null;
          destination_state?: string | null;
          escalated_at?: string | null;
          escalation_reason?: string | null;
          estimated_loading_date?: string | null;
          id?: string;
          max_offers?: number;
          order_id?: string | null;
          origin?: string | null;
          origin_city?: string | null;
          origin_state?: string | null;
          quote_id: string;
          status?: Database['public']['Enums']['offer_sequence_status'];
          timeout_hours?: number;
          trip_id?: string | null;
          updated_at?: string;
          vehicle_type_id?: string | null;
          weight?: number | null;
        };
        Update: {
          accepted_at?: string | null;
          accepted_driver_id?: string | null;
          cargo_type?: string | null;
          cargo_value?: number | null;
          created_at?: string;
          created_by?: string | null;
          current_position?: number;
          destination?: string | null;
          destination_city?: string | null;
          destination_state?: string | null;
          escalated_at?: string | null;
          escalation_reason?: string | null;
          estimated_loading_date?: string | null;
          id?: string;
          max_offers?: number;
          order_id?: string | null;
          origin?: string | null;
          origin_city?: string | null;
          origin_state?: string | null;
          quote_id?: string;
          status?: Database['public']['Enums']['offer_sequence_status'];
          timeout_hours?: number;
          trip_id?: string | null;
          updated_at?: string;
          vehicle_type_id?: string | null;
          weight?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'driver_offer_sequences_accepted_driver_id_fkey';
            columns: ['accepted_driver_id'];
            isOneToOne: false;
            referencedRelation: 'drivers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'driver_offer_sequences_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'driver_offer_sequences_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'driver_offer_sequences_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders_rs_per_km';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'driver_offer_sequences_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_order_payment_reconciliation';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'driver_offer_sequences_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'driver_offer_sequences_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_financial_details';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'driver_offer_sequences_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'vw_order_risk_status';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'driver_offer_sequences_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: true;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'driver_offer_sequences_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: true;
            referencedRelation: 'v_quote_order_divergence';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'driver_offer_sequences_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: true;
            referencedRelation: 'v_quote_payment_reconciliation';
            referencedColumns: ['quote_id'];
          },
          {
            foreignKeyName: 'driver_offer_sequences_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trip_financial_summary';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'driver_offer_sequences_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'driver_offer_sequences_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'v_trip_payment_reconciliation';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'driver_offer_sequences_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'vw_trip_risk_summary';
            referencedColumns: ['trip_id'];
          },
          {
            foreignKeyName: 'driver_offer_sequences_vehicle_type_id_fkey';
            columns: ['vehicle_type_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_types';
            referencedColumns: ['id'];
          },
        ];
      };
      driver_offers: {
        Row: {
          buonny_check_id: string | null;
          buonny_status: string | null;
          created_at: string;
          driver_id: string;
          freight_value_offered: number | null;
          id: string;
          offered_at: string | null;
          position: number;
          ranking_details: Json | null;
          ranking_score: number | null;
          responded_at: string | null;
          response_channel: string | null;
          response_text: string | null;
          sequence_id: string;
          skip_reason: string | null;
          status: Database['public']['Enums']['driver_offer_status'];
          timeout_at: string | null;
          whatsapp_message_id: string | null;
        };
        Insert: {
          buonny_check_id?: string | null;
          buonny_status?: string | null;
          created_at?: string;
          driver_id: string;
          freight_value_offered?: number | null;
          id?: string;
          offered_at?: string | null;
          position: number;
          ranking_details?: Json | null;
          ranking_score?: number | null;
          responded_at?: string | null;
          response_channel?: string | null;
          response_text?: string | null;
          sequence_id: string;
          skip_reason?: string | null;
          status?: Database['public']['Enums']['driver_offer_status'];
          timeout_at?: string | null;
          whatsapp_message_id?: string | null;
        };
        Update: {
          buonny_check_id?: string | null;
          buonny_status?: string | null;
          created_at?: string;
          driver_id?: string;
          freight_value_offered?: number | null;
          id?: string;
          offered_at?: string | null;
          position?: number;
          ranking_details?: Json | null;
          ranking_score?: number | null;
          responded_at?: string | null;
          response_channel?: string | null;
          response_text?: string | null;
          sequence_id?: string;
          skip_reason?: string | null;
          status?: Database['public']['Enums']['driver_offer_status'];
          timeout_at?: string | null;
          whatsapp_message_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'driver_offers_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: false;
            referencedRelation: 'drivers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'driver_offers_sequence_id_fkey';
            columns: ['sequence_id'];
            isOneToOne: false;
            referencedRelation: 'driver_offer_sequences';
            referencedColumns: ['id'];
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
        Relationships: [
          {
            foreignKeyName: 'drivers_cnh_category_fk';
            columns: ['cnh_category'];
            isOneToOne: false;
            referencedRelation: 'cnh_categories';
            referencedColumns: ['code'];
          },
        ];
      };
      edge_function_api_keys: {
        Row: {
          created_at: string | null;
          expires_at: string | null;
          id: string;
          is_active: boolean;
          key_hash: string;
          last_used: string | null;
          name: string;
          scopes: string[];
        };
        Insert: {
          created_at?: string | null;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean;
          key_hash: string;
          last_used?: string | null;
          name: string;
          scopes?: string[];
        };
        Update: {
          created_at?: string | null;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean;
          key_hash?: string;
          last_used?: string | null;
          name?: string;
          scopes?: string[];
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
      insurance_logs: {
        Row: {
          created_at: string;
          destination_uf: string | null;
          duration_ms: number | null;
          environment: string;
          error_code: string | null;
          error_message: string | null;
          fallback_used: boolean;
          function_name: string;
          id: string;
          origin_uf: string | null;
          premium_estimate_cents: number | null;
          product_type: string | null;
          raw: Json | null;
          request_id: string | null;
          source: string;
          status: string;
          trace_id: string | null;
          weight: number | null;
        };
        Insert: {
          created_at?: string;
          destination_uf?: string | null;
          duration_ms?: number | null;
          environment?: string;
          error_code?: string | null;
          error_message?: string | null;
          fallback_used?: boolean;
          function_name?: string;
          id?: string;
          origin_uf?: string | null;
          premium_estimate_cents?: number | null;
          product_type?: string | null;
          raw?: Json | null;
          request_id?: string | null;
          source?: string;
          status: string;
          trace_id?: string | null;
          weight?: number | null;
        };
        Update: {
          created_at?: string;
          destination_uf?: string | null;
          duration_ms?: number | null;
          environment?: string;
          error_code?: string | null;
          error_message?: string | null;
          fallback_used?: boolean;
          function_name?: string;
          id?: string;
          origin_uf?: string | null;
          premium_estimate_cents?: number | null;
          product_type?: string | null;
          raw?: Json | null;
          request_id?: string | null;
          source?: string;
          status?: string;
          trace_id?: string | null;
          weight?: number | null;
        };
        Relationships: [];
      };
      ipece_renda_bairro: {
        Row: {
          ano: number;
          bairro: string;
          bairro_norm: string;
          cidade: string;
          domicilios: number | null;
          fonte: string;
          id: number;
          moradores_domicilio: number | null;
          percentil: number | null;
          pessoas: number | null;
          ranking: number | null;
          renda_pc: number | null;
          renda_resp_domicilio: number;
          uf: string;
          updated_at: string;
        };
        Insert: {
          ano?: number;
          bairro: string;
          bairro_norm: string;
          cidade?: string;
          domicilios?: number | null;
          fonte?: string;
          id?: never;
          moradores_domicilio?: number | null;
          percentil?: number | null;
          pessoas?: number | null;
          ranking?: number | null;
          renda_pc?: number | null;
          renda_resp_domicilio: number;
          uf?: string;
          updated_at?: string;
        };
        Update: {
          ano?: number;
          bairro?: string;
          bairro_norm?: string;
          cidade?: string;
          domicilios?: number | null;
          fonte?: string;
          id?: never;
          moradores_domicilio?: number | null;
          percentil?: number | null;
          pessoas?: number | null;
          ranking?: number | null;
          renda_pc?: number | null;
          renda_resp_domicilio?: number;
          uf?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      kb_chunks: {
        Row: {
          ano_referencia: number | null;
          conteudo: string;
          created_at: string;
          embedding: string | null;
          fonte: string;
          id: string;
          metadados: Json;
          titulo: string | null;
          url: string | null;
        };
        Insert: {
          ano_referencia?: number | null;
          conteudo: string;
          created_at?: string;
          embedding?: string | null;
          fonte: string;
          id?: string;
          metadados?: Json;
          titulo?: string | null;
          url?: string | null;
        };
        Update: {
          ano_referencia?: number | null;
          conteudo?: string;
          created_at?: string;
          embedding?: string | null;
          fonte?: string;
          id?: string;
          metadados?: Json;
          titulo?: string | null;
          url?: string | null;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          apollo_contact_id: string | null;
          apollo_sync_status: string;
          apollo_synced_at: string | null;
          bairro: string | null;
          cidade: string | null;
          created_at: string;
          email: string;
          empresa: string | null;
          fonte: string;
          id: string;
          mensagem: string | null;
          nome: string;
          org_id: string;
          perfil: string | null;
          telefone: string | null;
          updated_at: string;
          utm_campaign: string | null;
          utm_medium: string | null;
          utm_source: string | null;
        };
        Insert: {
          apollo_contact_id?: string | null;
          apollo_sync_status?: string;
          apollo_synced_at?: string | null;
          bairro?: string | null;
          cidade?: string | null;
          created_at?: string;
          email: string;
          empresa?: string | null;
          fonte?: string;
          id?: string;
          mensagem?: string | null;
          nome: string;
          org_id?: string;
          perfil?: string | null;
          telefone?: string | null;
          updated_at?: string;
          utm_campaign?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
        };
        Update: {
          apollo_contact_id?: string | null;
          apollo_sync_status?: string;
          apollo_synced_at?: string | null;
          bairro?: string | null;
          cidade?: string | null;
          created_at?: string;
          email?: string;
          empresa?: string | null;
          fonte?: string;
          id?: string;
          mensagem?: string | null;
          nome?: string;
          org_id?: string;
          perfil?: string | null;
          telefone?: string | null;
          updated_at?: string;
          utm_campaign?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
        };
        Relationships: [];
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
      ltl_parameters: {
        Row: {
          correction_factor: number;
          created_at: string;
          cubage_factor: number;
          dispatch_fee: number;
          gris_high_risk_percent: number;
          gris_min: number;
          gris_min_cargo_limit: number;
          gris_percent: number;
          id: string;
          min_freight: number;
          min_freight_cargo_limit: number;
          min_tso: number;
          reference_month: string;
        };
        Insert: {
          correction_factor?: number;
          created_at?: string;
          cubage_factor?: number;
          dispatch_fee?: number;
          gris_high_risk_percent?: number;
          gris_min?: number;
          gris_min_cargo_limit?: number;
          gris_percent?: number;
          id?: string;
          min_freight?: number;
          min_freight_cargo_limit?: number;
          min_tso?: number;
          reference_month: string;
        };
        Update: {
          correction_factor?: number;
          created_at?: string;
          cubage_factor?: number;
          dispatch_fee?: number;
          gris_high_risk_percent?: number;
          gris_min?: number;
          gris_min_cargo_limit?: number;
          gris_percent?: number;
          id?: string;
          min_freight?: number;
          min_freight_cargo_limit?: number;
          min_tso?: number;
          reference_month?: string;
        };
        Relationships: [];
      };
      market_bundles: {
        Row: {
          bairro: string | null;
          cidade: string;
          gerado_em: string | null;
          payload: Json;
          slug: string;
          stale: boolean;
          uf: string;
          updated_at: string;
          valido_ate: string | null;
        };
        Insert: {
          bairro?: string | null;
          cidade: string;
          gerado_em?: string | null;
          payload: Json;
          slug: string;
          stale?: boolean;
          uf: string;
          updated_at?: string;
          valido_ate?: string | null;
        };
        Update: {
          bairro?: string | null;
          cidade?: string;
          gerado_em?: string | null;
          payload?: Json;
          slug?: string;
          stale?: boolean;
          uf?: string;
          updated_at?: string;
          valido_ate?: string | null;
        };
        Relationships: [];
      };
      market_indices: {
        Row: {
          alerta_nivel: string;
          created_at: string | null;
          desp_adm_12meses: number | null;
          desp_adm_mensal: number | null;
          diesel_comum_12meses: number | null;
          diesel_comum_mensal: number | null;
          diesel_comum_preco: number | null;
          diesel_s10_12meses: number | null;
          diesel_s10_mensal: number | null;
          diesel_s10_preco: number | null;
          fonte_url: string;
          gerado_em: string;
          id: string;
          inctf_12meses: number | null;
          inctf_ano: number | null;
          inctf_mensal: number | null;
          inctl_12meses: number | null;
          inctl_ano: number | null;
          inctl_mensal: number | null;
          lotacao_cavalo_12m: number | null;
          lotacao_pneu_12m: number | null;
          lotacao_salario_12m: number | null;
          lotacao_semirreboque_12m: number | null;
          periodo_referencia: string;
          reajuste_sugerido_pct: number | null;
          resumo_whatsapp: string | null;
        };
        Insert: {
          alerta_nivel?: string;
          created_at?: string | null;
          desp_adm_12meses?: number | null;
          desp_adm_mensal?: number | null;
          diesel_comum_12meses?: number | null;
          diesel_comum_mensal?: number | null;
          diesel_comum_preco?: number | null;
          diesel_s10_12meses?: number | null;
          diesel_s10_mensal?: number | null;
          diesel_s10_preco?: number | null;
          fonte_url: string;
          gerado_em: string;
          id?: string;
          inctf_12meses?: number | null;
          inctf_ano?: number | null;
          inctf_mensal?: number | null;
          inctl_12meses?: number | null;
          inctl_ano?: number | null;
          inctl_mensal?: number | null;
          lotacao_cavalo_12m?: number | null;
          lotacao_pneu_12m?: number | null;
          lotacao_salario_12m?: number | null;
          lotacao_semirreboque_12m?: number | null;
          periodo_referencia: string;
          reajuste_sugerido_pct?: number | null;
          resumo_whatsapp?: string | null;
        };
        Update: {
          alerta_nivel?: string;
          created_at?: string | null;
          desp_adm_12meses?: number | null;
          desp_adm_mensal?: number | null;
          diesel_comum_12meses?: number | null;
          diesel_comum_mensal?: number | null;
          diesel_comum_preco?: number | null;
          diesel_s10_12meses?: number | null;
          diesel_s10_mensal?: number | null;
          diesel_s10_preco?: number | null;
          fonte_url?: string;
          gerado_em?: string;
          id?: string;
          inctf_12meses?: number | null;
          inctf_ano?: number | null;
          inctf_mensal?: number | null;
          inctl_12meses?: number | null;
          inctl_ano?: number | null;
          inctl_mensal?: number | null;
          lotacao_cavalo_12m?: number | null;
          lotacao_pneu_12m?: number | null;
          lotacao_salario_12m?: number | null;
          lotacao_semirreboque_12m?: number | null;
          periodo_referencia?: string;
          reajuste_sugerido_pct?: number | null;
          resumo_whatsapp?: string | null;
        };
        Relationships: [];
      };
      market_snapshots: {
        Row: {
          gerado_em: string | null;
          nome: string;
          payload: Json;
          updated_at: string;
        };
        Insert: {
          gerado_em?: string | null;
          nome: string;
          payload: Json;
          updated_at?: string;
        };
        Update: {
          gerado_em?: string | null;
          nome?: string;
          payload?: Json;
          updated_at?: string;
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
      messages: {
        Row: {
          attachments: Json | null;
          content: string;
          created_at: string | null;
          id: string;
          role: string;
          session_id: string;
          timestamp: string;
        };
        Insert: {
          attachments?: Json | null;
          content: string;
          created_at?: string | null;
          id?: string;
          role: string;
          session_id: string;
          timestamp?: string;
        };
        Update: {
          attachments?: Json | null;
          content?: string;
          created_at?: string | null;
          id?: string;
          role?: string;
          session_id?: string;
          timestamp?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      mirofish_monthly_revenue: {
        Row: {
          ano_mes: string;
          created_at: string | null;
          ctes: number;
          id: number;
          mes: string;
          valor: number;
        };
        Insert: {
          ano_mes: string;
          created_at?: string | null;
          ctes: number;
          id?: number;
          mes: string;
          valor: number;
        };
        Update: {
          ano_mes?: string;
          created_at?: string | null;
          ctes?: number;
          id?: number;
          mes?: string;
          valor?: number;
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
          agents_count: number | null;
          completed_at: string | null;
          created_at: string | null;
          error: string | null;
          generated_at: string | null;
          id: string;
          mirofish_report_id: string;
          period_end: string | null;
          period_start: string | null;
          period_type: string | null;
          raw_insights: Json | null;
          sections: Json | null;
          simulation_id: string;
          simulation_requirement: string | null;
          status: string | null;
          summary: string | null;
          synced_at: string | null;
          title: string | null;
          updated_at: string | null;
        };
        Insert: {
          agents_count?: number | null;
          completed_at?: string | null;
          created_at?: string | null;
          error?: string | null;
          generated_at?: string | null;
          id?: string;
          mirofish_report_id: string;
          period_end?: string | null;
          period_start?: string | null;
          period_type?: string | null;
          raw_insights?: Json | null;
          sections?: Json | null;
          simulation_id: string;
          simulation_requirement?: string | null;
          status?: string | null;
          summary?: string | null;
          synced_at?: string | null;
          title?: string | null;
          updated_at?: string | null;
        };
        Update: {
          agents_count?: number | null;
          completed_at?: string | null;
          created_at?: string | null;
          error?: string | null;
          generated_at?: string | null;
          id?: string;
          mirofish_report_id?: string;
          period_end?: string | null;
          period_start?: string | null;
          period_type?: string | null;
          raw_insights?: Json | null;
          sections?: Json | null;
          simulation_id?: string;
          simulation_requirement?: string | null;
          status?: string | null;
          summary?: string | null;
          synced_at?: string | null;
          title?: string | null;
          updated_at?: string | null;
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
      municipio_pib: {
        Row: {
          ano: number | null;
          fonte: string | null;
          id_municipio: string;
          nome: string | null;
          pib_per_capita: number | null;
          pib_reais: number | null;
          populacao: number | null;
          uf: string | null;
          updated_at: string;
        };
        Insert: {
          ano?: number | null;
          fonte?: string | null;
          id_municipio: string;
          nome?: string | null;
          pib_per_capita?: number | null;
          pib_reais?: number | null;
          populacao?: number | null;
          uf?: string | null;
          updated_at?: string;
        };
        Update: {
          ano?: number | null;
          fonte?: string | null;
          id_municipio?: string;
          nome?: string | null;
          pib_per_capita?: number | null;
          pib_reais?: number | null;
          populacao?: number | null;
          uf?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      municipio_publico_sexo: {
        Row: {
          faixa_idade: string;
          fonte: string | null;
          homens: number;
          id_municipio: string;
          mulheres: number;
          pct_homens: number;
          pct_mulheres: number;
          total: number;
          updated_at: string | null;
        };
        Insert: {
          faixa_idade: string;
          fonte?: string | null;
          homens: number;
          id_municipio: string;
          mulheres: number;
          pct_homens: number;
          pct_mulheres: number;
          total: number;
          updated_at?: string | null;
        };
        Update: {
          faixa_idade?: string;
          fonte?: string | null;
          homens?: number;
          id_municipio?: string;
          mulheres?: number;
          pct_homens?: number;
          pct_mulheres?: number;
          total?: number;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      municipio_rf_ibge: {
        Row: {
          fonte: string;
          id_municipio: string;
          id_municipio_rf: string;
          updated_at: string;
        };
        Insert: {
          fonte?: string;
          id_municipio: string;
          id_municipio_rf: string;
          updated_at?: string;
        };
        Update: {
          fonte?: string;
          id_municipio?: string;
          id_municipio_rf?: string;
          updated_at?: string;
        };
        Relationships: [];
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
          summary: string | null;
          tags: string[] | null;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          raw_snippet?: string | null;
          relevance_score?: number | null;
          source_name?: string | null;
          source_type?: string;
          source_url?: string | null;
          summary?: string | null;
          tags?: string[] | null;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          raw_snippet?: string | null;
          relevance_score?: number | null;
          source_name?: string | null;
          source_type?: string;
          source_url?: string | null;
          summary?: string | null;
          tags?: string[] | null;
          title?: string;
          updated_at?: string | null;
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
          is_meta_approved: boolean | null;
          key: string;
          meta_category: string | null;
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
          is_meta_approved?: boolean | null;
          key: string;
          meta_category?: string | null;
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
          is_meta_approved?: boolean | null;
          key?: string;
          meta_category?: string | null;
          meta_language_code?: string | null;
          meta_template_name?: string | null;
          meta_variables?: Json | null;
          subject_template?: string | null;
        };
        Relationships: [];
      };
      ntc_articles_seen: {
        Row: {
          categoria: string | null;
          created_at: string | null;
          data_pub: string | null;
          id: string;
          inserido_em: string | null;
          motivo_relevancia: string | null;
          periodo_referencia: string | null;
          precisa_insercao_manual: boolean | null;
          resumo_inferido: string | null;
          tipo_indice: string | null;
          titulo: string;
          url: string;
        };
        Insert: {
          categoria?: string | null;
          created_at?: string | null;
          data_pub?: string | null;
          id?: string;
          inserido_em?: string | null;
          motivo_relevancia?: string | null;
          periodo_referencia?: string | null;
          precisa_insercao_manual?: boolean | null;
          resumo_inferido?: string | null;
          tipo_indice?: string | null;
          titulo: string;
          url: string;
        };
        Update: {
          categoria?: string | null;
          created_at?: string | null;
          data_pub?: string | null;
          id?: string;
          inserido_em?: string | null;
          motivo_relevancia?: string | null;
          periodo_referencia?: string | null;
          precisa_insercao_manual?: boolean | null;
          resumo_inferido?: string | null;
          tipo_indice?: string | null;
          titulo?: string;
          url?: string;
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
      ntc_scrape_log: {
        Row: {
          dia_semana: number | null;
          duration_ms: number | null;
          error_message: string | null;
          gerado_em: string | null;
          hora_brt: number | null;
          hora_utc: number | null;
          http_status: number | null;
          id: string;
          is_new_period: boolean | null;
          periodo_referencia: string | null;
          response_preview: string | null;
          scraped_at: string;
          status: string;
        };
        Insert: {
          dia_semana?: number | null;
          duration_ms?: number | null;
          error_message?: string | null;
          gerado_em?: string | null;
          hora_brt?: number | null;
          hora_utc?: number | null;
          http_status?: number | null;
          id?: string;
          is_new_period?: boolean | null;
          periodo_referencia?: string | null;
          response_preview?: string | null;
          scraped_at?: string;
          status: string;
        };
        Update: {
          dia_semana?: number | null;
          duration_ms?: number | null;
          error_message?: string | null;
          gerado_em?: string | null;
          hora_brt?: number | null;
          hora_utc?: number | null;
          http_status?: number | null;
          id?: string;
          is_new_period?: boolean | null;
          periodo_referencia?: string | null;
          response_preview?: string | null;
          scraped_at?: string;
          status?: string;
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
      okrs: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          descricao: string | null;
          id: string;
          kr1_atual: number | null;
          kr1_descricao: string | null;
          kr1_target: number | null;
          kr2_atual: number | null;
          kr2_descricao: string | null;
          kr2_target: number | null;
          kr3_atual: number | null;
          kr3_descricao: string | null;
          kr3_target: number | null;
          objetivo: string;
          playbook_id: string;
          projeto_id: string;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          descricao?: string | null;
          id?: string;
          kr1_atual?: number | null;
          kr1_descricao?: string | null;
          kr1_target?: number | null;
          kr2_atual?: number | null;
          kr2_descricao?: string | null;
          kr2_target?: number | null;
          kr3_atual?: number | null;
          kr3_descricao?: string | null;
          kr3_target?: number | null;
          objetivo: string;
          playbook_id: string;
          projeto_id: string;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          descricao?: string | null;
          id?: string;
          kr1_atual?: number | null;
          kr1_descricao?: string | null;
          kr1_target?: number | null;
          kr2_atual?: number | null;
          kr2_descricao?: string | null;
          kr2_target?: number | null;
          kr3_atual?: number | null;
          kr3_descricao?: string | null;
          kr3_target?: number | null;
          objetivo?: string;
          playbook_id?: string;
          projeto_id?: string;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'okrs_playbook_id_fkey';
            columns: ['playbook_id'];
            isOneToOne: false;
            referencedRelation: 'playbooks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'okrs_projeto_id_fkey';
            columns: ['projeto_id'];
            isOneToOne: false;
            referencedRelation: 'user_projects';
            referencedColumns: ['id'];
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
      oportunidades_prospeccao: {
        Row: {
          apollo_account_id: string | null;
          apollo_enrichment_log: Json | null;
          apollo_person_id: string | null;
          apollo_sync_error: string | null;
          apollo_sync_status: string | null;
          apollo_synced_at: string | null;
          area_total_m2: number | null;
          cidade: string | null;
          cno: string | null;
          cnpj: string;
          contato_cnpj: Json | null;
          contato_validado_em: string | null;
          created_at: string;
          data_inicio_atividade: string | null;
          data_inicio_obra: string | null;
          data_situacao_obra: string | null;
          endereco_cno: Json | null;
          endereco_cnpj: Json | null;
          id: string;
          motivo_match: string | null;
          municipio_codigo: string | null;
          nome_fantasia: string | null;
          nome_obra: string | null;
          org_id: string | null;
          origem: string | null;
          prioridade: string;
          razao_social: string | null;
          relatorio_id: string | null;
          score_match: number | null;
          segmento_operacao: string | null;
          situacao_cadastral: number | null;
          situacao_obra: string | null;
          status: string;
          uf: string | null;
          updated_at: string;
          webhook_enviado_at: string | null;
          webhook_payload: Json | null;
          webhook_resposta_http: number | null;
          webhook_tentativas: number;
          webhook_url: string | null;
        };
        Insert: {
          apollo_account_id?: string | null;
          apollo_enrichment_log?: Json | null;
          apollo_person_id?: string | null;
          apollo_sync_error?: string | null;
          apollo_sync_status?: string | null;
          apollo_synced_at?: string | null;
          area_total_m2?: number | null;
          cidade?: string | null;
          cno?: string | null;
          cnpj: string;
          contato_cnpj?: Json | null;
          contato_validado_em?: string | null;
          created_at?: string;
          data_inicio_atividade?: string | null;
          data_inicio_obra?: string | null;
          data_situacao_obra?: string | null;
          endereco_cno?: Json | null;
          endereco_cnpj?: Json | null;
          id?: string;
          motivo_match?: string | null;
          municipio_codigo?: string | null;
          nome_fantasia?: string | null;
          nome_obra?: string | null;
          org_id?: string | null;
          origem?: string | null;
          prioridade?: string;
          razao_social?: string | null;
          relatorio_id?: string | null;
          score_match?: number | null;
          segmento_operacao?: string | null;
          situacao_cadastral?: number | null;
          situacao_obra?: string | null;
          status?: string;
          uf?: string | null;
          updated_at?: string;
          webhook_enviado_at?: string | null;
          webhook_payload?: Json | null;
          webhook_resposta_http?: number | null;
          webhook_tentativas?: number;
          webhook_url?: string | null;
        };
        Update: {
          apollo_account_id?: string | null;
          apollo_enrichment_log?: Json | null;
          apollo_person_id?: string | null;
          apollo_sync_error?: string | null;
          apollo_sync_status?: string | null;
          apollo_synced_at?: string | null;
          area_total_m2?: number | null;
          cidade?: string | null;
          cno?: string | null;
          cnpj?: string;
          contato_cnpj?: Json | null;
          contato_validado_em?: string | null;
          created_at?: string;
          data_inicio_atividade?: string | null;
          data_inicio_obra?: string | null;
          data_situacao_obra?: string | null;
          endereco_cno?: Json | null;
          endereco_cnpj?: Json | null;
          id?: string;
          motivo_match?: string | null;
          municipio_codigo?: string | null;
          nome_fantasia?: string | null;
          nome_obra?: string | null;
          org_id?: string | null;
          origem?: string | null;
          prioridade?: string;
          razao_social?: string | null;
          relatorio_id?: string | null;
          score_match?: number | null;
          segmento_operacao?: string | null;
          situacao_cadastral?: number | null;
          situacao_obra?: string | null;
          status?: string;
          uf?: string | null;
          updated_at?: string;
          webhook_enviado_at?: string | null;
          webhook_payload?: Json | null;
          webhook_resposta_http?: number | null;
          webhook_tentativas?: number;
          webhook_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'oportunidades_prospeccao_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'oportunidades_prospeccao_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'relatorios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'oportunidades_prospeccao_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'v_relatorios_resumo';
            referencedColumns: ['id'];
          },
        ];
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
          driver_antt: string | null;
          driver_cnh: string | null;
          driver_id: string | null;
          driver_name: string | null;
          driver_phone: string | null;
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
          driver_antt?: string | null;
          driver_cnh?: string | null;
          driver_id?: string | null;
          driver_name?: string | null;
          driver_phone?: string | null;
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
          driver_antt?: string | null;
          driver_cnh?: string | null;
          driver_id?: string | null;
          driver_name?: string | null;
          driver_phone?: string | null;
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
      organization_members: {
        Row: {
          created_at: string | null;
          org_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          org_id: string;
          role?: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          org_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_members_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string | null;
          id: string;
          limite_relatorios_mes: number;
          nome: string;
          plano: string;
          slug: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          limite_relatorios_mes?: number;
          nome: string;
          plano?: string;
          slug: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          limite_relatorios_mes?: number;
          nome?: string;
          plano?: string;
          slug?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      otimizacoes_custo: {
        Row: {
          agente: string;
          aprovado_em: string | null;
          aprovado_por: string | null;
          criado_em: string | null;
          criado_por: string | null;
          descricao: string;
          economia_brl_estimada: number;
          economia_brl_real: number | null;
          id: string;
          implementado_em: string | null;
          implementado_por: string | null;
          justificativa_aprovacao: string | null;
          modelo_atual: string | null;
          modelo_sugerido: string | null;
          org_id: string;
          referencia_dados: Json | null;
          resultado_observacao: string | null;
          severidade: string;
          status: Database['public']['Enums']['otimizacao_status'];
          tipo: Database['public']['Enums']['otimizacao_tipo'];
          titulo: string;
        };
        Insert: {
          agente: string;
          aprovado_em?: string | null;
          aprovado_por?: string | null;
          criado_em?: string | null;
          criado_por?: string | null;
          descricao: string;
          economia_brl_estimada?: number;
          economia_brl_real?: number | null;
          id?: string;
          implementado_em?: string | null;
          implementado_por?: string | null;
          justificativa_aprovacao?: string | null;
          modelo_atual?: string | null;
          modelo_sugerido?: string | null;
          org_id: string;
          referencia_dados?: Json | null;
          resultado_observacao?: string | null;
          severidade: string;
          status?: Database['public']['Enums']['otimizacao_status'];
          tipo: Database['public']['Enums']['otimizacao_tipo'];
          titulo: string;
        };
        Update: {
          agente?: string;
          aprovado_em?: string | null;
          aprovado_por?: string | null;
          criado_em?: string | null;
          criado_por?: string | null;
          descricao?: string;
          economia_brl_estimada?: number;
          economia_brl_real?: number | null;
          id?: string;
          implementado_em?: string | null;
          implementado_por?: string | null;
          justificativa_aprovacao?: string | null;
          modelo_atual?: string | null;
          modelo_sugerido?: string | null;
          org_id?: string;
          referencia_dados?: Json | null;
          resultado_observacao?: string | null;
          severidade?: string;
          status?: Database['public']['Enums']['otimizacao_status'];
          tipo?: Database['public']['Enums']['otimizacao_tipo'];
          titulo?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'otimizacoes_custo_aprovado_por_fkey';
            columns: ['aprovado_por'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'otimizacoes_custo_criado_por_fkey';
            columns: ['criado_por'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'otimizacoes_custo_implementado_por_fkey';
            columns: ['implementado_por'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'otimizacoes_custo_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
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
          state: string | null;
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
          state?: string | null;
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
          state?: string | null;
          updated_at?: string;
          zip_code?: string | null;
          zip_code_mask?: string | null;
        };
        Relationships: [];
      };
      parametros_metodologia: {
        Row: {
          categoria: string | null;
          data_coleta: string | null;
          fonte: string;
          metodo: string | null;
          nome: string;
          unidade: string | null;
          updated_at: string;
          valor: number;
        };
        Insert: {
          categoria?: string | null;
          data_coleta?: string | null;
          fonte: string;
          metodo?: string | null;
          nome: string;
          unidade?: string | null;
          updated_at?: string;
          valor: number;
        };
        Update: {
          categoria?: string | null;
          data_coleta?: string | null;
          fonte?: string;
          metodo?: string | null;
          nome?: string;
          unidade?: string | null;
          updated_at?: string;
          valor?: number;
        };
        Relationships: [];
      };
      parceiro_leads: {
        Row: {
          comissao_gerada: number | null;
          created_at: string | null;
          dados_projeto: Json | null;
          deleted_at: string | null;
          id: string;
          notas_internas: string | null;
          notas_parceiro: string | null;
          parceiro_id: string;
          projeto_id: string;
          solicitante_email: string | null;
          solicitante_nome: string | null;
          solicitante_telefone: string | null;
          status: string;
          tarefa_id: string | null;
          updated_at: string | null;
          valor_fechado: number | null;
        };
        Insert: {
          comissao_gerada?: number | null;
          created_at?: string | null;
          dados_projeto?: Json | null;
          deleted_at?: string | null;
          id?: string;
          notas_internas?: string | null;
          notas_parceiro?: string | null;
          parceiro_id: string;
          projeto_id: string;
          solicitante_email?: string | null;
          solicitante_nome?: string | null;
          solicitante_telefone?: string | null;
          status?: string;
          tarefa_id?: string | null;
          updated_at?: string | null;
          valor_fechado?: number | null;
        };
        Update: {
          comissao_gerada?: number | null;
          created_at?: string | null;
          dados_projeto?: Json | null;
          deleted_at?: string | null;
          id?: string;
          notas_internas?: string | null;
          notas_parceiro?: string | null;
          parceiro_id?: string;
          projeto_id?: string;
          solicitante_email?: string | null;
          solicitante_nome?: string | null;
          solicitante_telefone?: string | null;
          status?: string;
          tarefa_id?: string | null;
          updated_at?: string | null;
          valor_fechado?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'parceiro_leads_parceiro_id_fkey';
            columns: ['parceiro_id'];
            isOneToOne: false;
            referencedRelation: 'parceiros';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parceiro_leads_projeto_id_fkey';
            columns: ['projeto_id'];
            isOneToOne: false;
            referencedRelation: 'user_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parceiro_leads_tarefa_id_fkey';
            columns: ['tarefa_id'];
            isOneToOne: false;
            referencedRelation: 'tarefas';
            referencedColumns: ['id'];
          },
        ];
      };
      parceiros: {
        Row: {
          categorias: string[];
          cidades_atuacao: string[] | null;
          comissao_percentual: number | null;
          created_at: string | null;
          curadoria_em: string | null;
          curadoria_nota: number | null;
          curadoria_observacao: string | null;
          curadoria_por: string | null;
          deleted_at: string | null;
          desconto_codigo: string | null;
          desconto_oferecido: string | null;
          descricao: string | null;
          diferenciais: string[] | null;
          email: string | null;
          id: string;
          lead_maximo_mes: number | null;
          lead_valor: number | null;
          leads_convertidos: number | null;
          leads_gerados: number | null;
          logo_url: string | null;
          nome: string;
          rating_medio: number | null;
          site_url: string | null;
          status: string;
          telefone: string | null;
          tipo_parceria: string;
          ufs_atuacao: string[] | null;
          updated_at: string | null;
          valor_mensalidade: number | null;
        };
        Insert: {
          categorias?: string[];
          cidades_atuacao?: string[] | null;
          comissao_percentual?: number | null;
          created_at?: string | null;
          curadoria_em?: string | null;
          curadoria_nota?: number | null;
          curadoria_observacao?: string | null;
          curadoria_por?: string | null;
          deleted_at?: string | null;
          desconto_codigo?: string | null;
          desconto_oferecido?: string | null;
          descricao?: string | null;
          diferenciais?: string[] | null;
          email?: string | null;
          id?: string;
          lead_maximo_mes?: number | null;
          lead_valor?: number | null;
          leads_convertidos?: number | null;
          leads_gerados?: number | null;
          logo_url?: string | null;
          nome: string;
          rating_medio?: number | null;
          site_url?: string | null;
          status?: string;
          telefone?: string | null;
          tipo_parceria?: string;
          ufs_atuacao?: string[] | null;
          updated_at?: string | null;
          valor_mensalidade?: number | null;
        };
        Update: {
          categorias?: string[];
          cidades_atuacao?: string[] | null;
          comissao_percentual?: number | null;
          created_at?: string | null;
          curadoria_em?: string | null;
          curadoria_nota?: number | null;
          curadoria_observacao?: string | null;
          curadoria_por?: string | null;
          deleted_at?: string | null;
          desconto_codigo?: string | null;
          desconto_oferecido?: string | null;
          descricao?: string | null;
          diferenciais?: string[] | null;
          email?: string | null;
          id?: string;
          lead_maximo_mes?: number | null;
          lead_valor?: number | null;
          leads_convertidos?: number | null;
          leads_gerados?: number | null;
          logo_url?: string | null;
          nome?: string;
          rating_medio?: number | null;
          site_url?: string | null;
          status?: string;
          telefone?: string | null;
          tipo_parceria?: string;
          ufs_atuacao?: string[] | null;
          updated_at?: string | null;
          valor_mensalidade?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'parceiros_curadoria_por_fkey';
            columns: ['curadoria_por'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      partner_quotes: {
        Row: {
          cargo_value: number;
          client_cnpj: string | null;
          client_email: string | null;
          client_name: string | null;
          client_phone: string | null;
          created_at: string | null;
          destination_cep: string;
          destination_city: string;
          destination_state: string | null;
          freight_value: number | null;
          id: string;
          km_distance: number | null;
          modality: string;
          notes: string | null;
          origin_cep: string;
          origin_city: string;
          pricing_breakdown: Json | null;
          shipper_id: string;
          status: string | null;
          toll_value: number | null;
          updated_at: string | null;
          user_id: string;
          vehicle_type: string | null;
          weight_kg: number;
        };
        Insert: {
          cargo_value: number;
          client_cnpj?: string | null;
          client_email?: string | null;
          client_name?: string | null;
          client_phone?: string | null;
          created_at?: string | null;
          destination_cep: string;
          destination_city: string;
          destination_state?: string | null;
          freight_value?: number | null;
          id?: string;
          km_distance?: number | null;
          modality: string;
          notes?: string | null;
          origin_cep: string;
          origin_city: string;
          pricing_breakdown?: Json | null;
          shipper_id: string;
          status?: string | null;
          toll_value?: number | null;
          updated_at?: string | null;
          user_id: string;
          vehicle_type?: string | null;
          weight_kg: number;
        };
        Update: {
          cargo_value?: number;
          client_cnpj?: string | null;
          client_email?: string | null;
          client_name?: string | null;
          client_phone?: string | null;
          created_at?: string | null;
          destination_cep?: string;
          destination_city?: string;
          destination_state?: string | null;
          freight_value?: number | null;
          id?: string;
          km_distance?: number | null;
          modality?: string;
          notes?: string | null;
          origin_cep?: string;
          origin_city?: string;
          pricing_breakdown?: Json | null;
          shipper_id?: string;
          status?: string | null;
          toll_value?: number | null;
          updated_at?: string | null;
          user_id?: string;
          vehicle_type?: string | null;
          weight_kg?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'partner_quotes_shipper_id_fkey';
            columns: ['shipper_id'];
            isOneToOne: false;
            referencedRelation: 'partner_shippers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'partner_quotes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'partner_users';
            referencedColumns: ['id'];
          },
        ];
      };
      partner_shippers: {
        Row: {
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          logo_url: string | null;
          name: string;
          origin_cep: string;
          origin_city: string;
          primary_color: string | null;
          slug: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          logo_url?: string | null;
          name: string;
          origin_cep: string;
          origin_city: string;
          primary_color?: string | null;
          slug: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          logo_url?: string | null;
          name?: string;
          origin_cep?: string;
          origin_city?: string;
          primary_color?: string | null;
          slug?: string;
        };
        Relationships: [];
      };
      partner_tokens: {
        Row: {
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          logo_url: string | null;
          origin_cep: string;
          origin_city: string;
          partner_name: string;
          partner_slug: string;
          primary_color: string | null;
          token: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          logo_url?: string | null;
          origin_cep: string;
          origin_city: string;
          partner_name: string;
          partner_slug: string;
          primary_color?: string | null;
          token: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          logo_url?: string | null;
          origin_cep?: string;
          origin_city?: string;
          partner_name?: string;
          partner_slug?: string;
          primary_color?: string | null;
          token?: string;
        };
        Relationships: [];
      };
      partner_users: {
        Row: {
          created_at: string | null;
          email: string;
          id: string;
          is_active: boolean | null;
          last_login: string | null;
          name: string;
          password_hash: string;
          shipper_id: string;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          id?: string;
          is_active?: boolean | null;
          last_login?: string | null;
          name: string;
          password_hash: string;
          shipper_id: string;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          id?: string;
          is_active?: boolean | null;
          last_login?: string | null;
          name?: string;
          password_hash?: string;
          shipper_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'partner_users_shipper_id_fkey';
            columns: ['shipper_id'];
            isOneToOne: false;
            referencedRelation: 'partner_shippers';
            referencedColumns: ['id'];
          },
        ];
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
      playbooks: {
        Row: {
          created_at: string | null;
          custo_planejado_total: number | null;
          custo_real_total: number | null;
          data_conclusao: string | null;
          data_inicio: string | null;
          data_prevista_conclusao: string | null;
          deleted_at: string | null;
          descricao: string | null;
          id: string;
          nome: string;
          org_id: string | null;
          percentual_concluido: number | null;
          projeto_id: string;
          relatorio_id: string | null;
          status: string;
          tarefas_concluidas: number | null;
          total_tarefas: number | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          custo_planejado_total?: number | null;
          custo_real_total?: number | null;
          data_conclusao?: string | null;
          data_inicio?: string | null;
          data_prevista_conclusao?: string | null;
          deleted_at?: string | null;
          descricao?: string | null;
          id?: string;
          nome?: string;
          org_id?: string | null;
          percentual_concluido?: number | null;
          projeto_id: string;
          relatorio_id?: string | null;
          status?: string;
          tarefas_concluidas?: number | null;
          total_tarefas?: number | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          custo_planejado_total?: number | null;
          custo_real_total?: number | null;
          data_conclusao?: string | null;
          data_inicio?: string | null;
          data_prevista_conclusao?: string | null;
          deleted_at?: string | null;
          descricao?: string | null;
          id?: string;
          nome?: string;
          org_id?: string | null;
          percentual_concluido?: number | null;
          projeto_id?: string;
          relatorio_id?: string | null;
          status?: string;
          tarefas_concluidas?: number | null;
          total_tarefas?: number | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'playbooks_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'playbooks_projeto_id_fkey';
            columns: ['projeto_id'];
            isOneToOne: false;
            referencedRelation: 'user_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'playbooks_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'relatorios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'playbooks_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'v_relatorios_resumo';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'playbooks_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
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
          weight_rate_10: number | null;
          weight_rate_100: number | null;
          weight_rate_150: number | null;
          weight_rate_20: number | null;
          weight_rate_200: number | null;
          weight_rate_30: number | null;
          weight_rate_50: number | null;
          weight_rate_70: number | null;
          weight_rate_above_200: number | null;
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
          weight_rate_10?: number | null;
          weight_rate_100?: number | null;
          weight_rate_150?: number | null;
          weight_rate_20?: number | null;
          weight_rate_200?: number | null;
          weight_rate_30?: number | null;
          weight_rate_50?: number | null;
          weight_rate_70?: number | null;
          weight_rate_above_200?: number | null;
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
          weight_rate_10?: number | null;
          weight_rate_100?: number | null;
          weight_rate_150?: number | null;
          weight_rate_20?: number | null;
          weight_rate_200?: number | null;
          weight_rate_30?: number | null;
          weight_rate_50?: number | null;
          weight_rate_70?: number | null;
          weight_rate_above_200?: number | null;
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
      pricing_route_overrides: {
        Row: {
          cargo_type: string | null;
          created_at: string | null;
          description: string | null;
          destination_city: string | null;
          destination_uf: string;
          id: string;
          is_active: boolean;
          modality: string | null;
          notes: string | null;
          origin_city: string | null;
          origin_uf: string;
          override_type: string | null;
          override_value: number | null;
          profit_margin_percent: number | null;
          updated_at: string | null;
        };
        Insert: {
          cargo_type?: string | null;
          created_at?: string | null;
          description?: string | null;
          destination_city?: string | null;
          destination_uf: string;
          id?: string;
          is_active?: boolean;
          modality?: string | null;
          notes?: string | null;
          origin_city?: string | null;
          origin_uf: string;
          override_type?: string | null;
          override_value?: number | null;
          profit_margin_percent?: number | null;
          updated_at?: string | null;
        };
        Update: {
          cargo_type?: string | null;
          created_at?: string | null;
          description?: string | null;
          destination_city?: string | null;
          destination_uf?: string;
          id?: string;
          is_active?: boolean;
          modality?: string | null;
          notes?: string | null;
          origin_city?: string | null;
          origin_uf?: string;
          override_type?: string | null;
          override_value?: number | null;
          profit_margin_percent?: number | null;
          updated_at?: string | null;
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
      processes: {
        Row: {
          atualizado_em: string | null;
          criado_em: string | null;
          descricao: string | null;
          dominio: string | null;
          id: string;
          nome: string;
          owner: string | null;
          status: string | null;
        };
        Insert: {
          atualizado_em?: string | null;
          criado_em?: string | null;
          descricao?: string | null;
          dominio?: string | null;
          id?: string;
          nome: string;
          owner?: string | null;
          status?: string | null;
        };
        Update: {
          atualizado_em?: string | null;
          criado_em?: string | null;
          descricao?: string | null;
          dominio?: string | null;
          id?: string;
          nome?: string;
          owner?: string | null;
          status?: string | null;
        };
        Relationships: [];
      };
      product_dimensions: {
        Row: {
          altura_m: number;
          box: string | null;
          codigo_base: string;
          comprimento_m: number;
          created_at: string | null;
          descricao: string | null;
          id: string;
          largura_m: number;
          peso_kg: number;
          supplier: string;
          updated_at: string | null;
          volume_m3: number | null;
        };
        Insert: {
          altura_m: number;
          box?: string | null;
          codigo_base: string;
          comprimento_m: number;
          created_at?: string | null;
          descricao?: string | null;
          id?: string;
          largura_m: number;
          peso_kg: number;
          supplier?: string;
          updated_at?: string | null;
          volume_m3?: number | null;
        };
        Update: {
          altura_m?: number;
          box?: string | null;
          codigo_base?: string;
          comprimento_m?: number;
          created_at?: string | null;
          descricao?: string | null;
          id?: string;
          largura_m?: number;
          peso_kg?: number;
          supplier?: string;
          updated_at?: string | null;
          volume_m3?: number | null;
        };
        Relationships: [];
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
      project_messages: {
        Row: {
          content: string;
          created_at: string | null;
          id: string;
          projeto_id: string;
          role: string;
          tokens_entrada: number | null;
          tokens_saida: number | null;
          tool_calls: Json | null;
          tool_results: Json | null;
        };
        Insert: {
          content: string;
          created_at?: string | null;
          id?: string;
          projeto_id: string;
          role: string;
          tokens_entrada?: number | null;
          tokens_saida?: number | null;
          tool_calls?: Json | null;
          tool_results?: Json | null;
        };
        Update: {
          content?: string;
          created_at?: string | null;
          id?: string;
          projeto_id?: string;
          role?: string;
          tokens_entrada?: number | null;
          tokens_saida?: number | null;
          tool_calls?: Json | null;
          tool_results?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'project_messages_projeto_id_fkey';
            columns: ['projeto_id'];
            isOneToOne: false;
            referencedRelation: 'user_projects';
            referencedColumns: ['id'];
          },
        ];
      };
      projeto_membros: {
        Row: {
          aceitado_em: string | null;
          convidado_por: string | null;
          convite_expira_em: string | null;
          convite_token: string | null;
          created_at: string | null;
          email: string;
          id: string;
          papel: string;
          projeto_id: string;
          removido_em: string | null;
          removido_por: string | null;
          status: string;
          user_id: string | null;
        };
        Insert: {
          aceitado_em?: string | null;
          convidado_por?: string | null;
          convite_expira_em?: string | null;
          convite_token?: string | null;
          created_at?: string | null;
          email: string;
          id?: string;
          papel: string;
          projeto_id: string;
          removido_em?: string | null;
          removido_por?: string | null;
          status?: string;
          user_id?: string | null;
        };
        Update: {
          aceitado_em?: string | null;
          convidado_por?: string | null;
          convite_expira_em?: string | null;
          convite_token?: string | null;
          created_at?: string | null;
          email?: string;
          id?: string;
          papel?: string;
          projeto_id?: string;
          removido_em?: string | null;
          removido_por?: string | null;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'projeto_membros_convidado_por_fkey';
            columns: ['convidado_por'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'projeto_membros_projeto_id_fkey';
            columns: ['projeto_id'];
            isOneToOne: false;
            referencedRelation: 'user_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projeto_membros_removido_por_fkey';
            columns: ['removido_por'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'projeto_membros_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      projeto_pessoas: {
        Row: {
          area_slug: string | null;
          criado_em: string;
          deleted_at: string | null;
          email: string | null;
          id: string;
          nome: string;
          papel: string | null;
          projeto_id: string;
          telefone: string | null;
        };
        Insert: {
          area_slug?: string | null;
          criado_em?: string;
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          nome: string;
          papel?: string | null;
          projeto_id: string;
          telefone?: string | null;
        };
        Update: {
          area_slug?: string | null;
          criado_em?: string;
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          nome?: string;
          papel?: string | null;
          projeto_id?: string;
          telefone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'projeto_pessoas_area_slug_fkey';
            columns: ['area_slug'];
            isOneToOne: false;
            referencedRelation: 'areas';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'projeto_pessoas_projeto_id_fkey';
            columns: ['projeto_id'];
            isOneToOne: false;
            referencedRelation: 'user_projects';
            referencedColumns: ['id'];
          },
        ];
      };
      prospects: {
        Row: {
          assigned_to: string | null;
          bairro: string | null;
          cep: string | null;
          cidade: string | null;
          created_at: string;
          dados_publicos: Json;
          decisor: Json | null;
          endereco: string | null;
          first_seen_at: string;
          id: string;
          instagram_handle: string;
          last_check_at: string | null;
          nome_publico: string | null;
          notas: string | null;
          origem: string;
          receita_federal: Json | null;
          score: number | null;
          status: Database['public']['Enums']['scout_prospect_status'];
          temperatura: Database['public']['Enums']['scout_temperatura'];
          uf: string | null;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          bairro?: string | null;
          cep?: string | null;
          cidade?: string | null;
          created_at?: string;
          dados_publicos?: Json;
          decisor?: Json | null;
          endereco?: string | null;
          first_seen_at?: string;
          id?: string;
          instagram_handle: string;
          last_check_at?: string | null;
          nome_publico?: string | null;
          notas?: string | null;
          origem?: string;
          receita_federal?: Json | null;
          score?: number | null;
          status?: Database['public']['Enums']['scout_prospect_status'];
          temperatura?: Database['public']['Enums']['scout_temperatura'];
          uf?: string | null;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          bairro?: string | null;
          cep?: string | null;
          cidade?: string | null;
          created_at?: string;
          dados_publicos?: Json;
          decisor?: Json | null;
          endereco?: string | null;
          first_seen_at?: string;
          id?: string;
          instagram_handle?: string;
          last_check_at?: string | null;
          nome_publico?: string | null;
          notas?: string | null;
          origem?: string;
          receita_federal?: Json | null;
          score?: number | null;
          status?: Database['public']['Enums']['scout_prospect_status'];
          temperatura?: Database['public']['Enums']['scout_temperatura'];
          uf?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'prospects_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
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
          commercial_owner_name: string | null;
          conditional_fees_breakdown: Json | null;
          created_at: string;
          created_by: string;
          cubage_weight: number | null;
          delivered_at: string | null;
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
          followup_target_locked_at: string | null;
          followup_target_type: string | null;
          freight_modality: string | null;
          freight_type: string | null;
          handoff_required: boolean;
          id: string;
          is_legacy: boolean;
          km_distance: number | null;
          last_commercial_reply_at: string | null;
          nfe_keys: string[] | null;
          notes: string | null;
          opened_at: string | null;
          origin: string;
          origin_cep: string | null;
          origin_ibge: number | null;
          origin_uf: string | null;
          payment_method: string | null;
          payment_term_id: string | null;
          price_table_id: string | null;
          pricing_breakdown: Json | null;
          proposal_sent_at: string | null;
          quote_code: string | null;
          resend_email_id: string | null;
          sent_at: string | null;
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
          commercial_owner_name?: string | null;
          conditional_fees_breakdown?: Json | null;
          created_at?: string;
          created_by: string;
          cubage_weight?: number | null;
          delivered_at?: string | null;
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
          followup_target_locked_at?: string | null;
          followup_target_type?: string | null;
          freight_modality?: string | null;
          freight_type?: string | null;
          handoff_required?: boolean;
          id?: string;
          is_legacy?: boolean;
          km_distance?: number | null;
          last_commercial_reply_at?: string | null;
          nfe_keys?: string[] | null;
          notes?: string | null;
          opened_at?: string | null;
          origin: string;
          origin_cep?: string | null;
          origin_ibge?: number | null;
          origin_uf?: string | null;
          payment_method?: string | null;
          payment_term_id?: string | null;
          price_table_id?: string | null;
          pricing_breakdown?: Json | null;
          proposal_sent_at?: string | null;
          quote_code?: string | null;
          resend_email_id?: string | null;
          sent_at?: string | null;
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
          commercial_owner_name?: string | null;
          conditional_fees_breakdown?: Json | null;
          created_at?: string;
          created_by?: string;
          cubage_weight?: number | null;
          delivered_at?: string | null;
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
          followup_target_locked_at?: string | null;
          followup_target_type?: string | null;
          freight_modality?: string | null;
          freight_type?: string | null;
          handoff_required?: boolean;
          id?: string;
          is_legacy?: boolean;
          km_distance?: number | null;
          last_commercial_reply_at?: string | null;
          nfe_keys?: string[] | null;
          notes?: string | null;
          opened_at?: string | null;
          origin?: string;
          origin_cep?: string | null;
          origin_ibge?: number | null;
          origin_uf?: string | null;
          payment_method?: string | null;
          payment_term_id?: string | null;
          price_table_id?: string | null;
          pricing_breakdown?: Json | null;
          proposal_sent_at?: string | null;
          quote_code?: string | null;
          resend_email_id?: string | null;
          sent_at?: string | null;
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
      relatorio_api_calls: {
        Row: {
          agente: string;
          api_sku: string;
          created_at: string;
          custo_brl: number;
          id: string;
          num_calls: number;
          relatorio_id: string;
          tool_name: string;
        };
        Insert: {
          agente: string;
          api_sku: string;
          created_at?: string;
          custo_brl?: number;
          id?: string;
          num_calls?: number;
          relatorio_id: string;
          tool_name: string;
        };
        Update: {
          agente?: string;
          api_sku?: string;
          created_at?: string;
          custo_brl?: number;
          id?: string;
          num_calls?: number;
          relatorio_id?: string;
          tool_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'relatorio_api_calls_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'relatorios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'relatorio_api_calls_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'v_relatorios_resumo';
            referencedColumns: ['id'];
          },
        ];
      };
      relatorio_custos_agentes: {
        Row: {
          agente: string;
          created_at: string;
          custo_brl: number;
          modelo: string;
          relatorio_id: string;
          tokens_in: number;
          tokens_out: number;
        };
        Insert: {
          agente: string;
          created_at?: string;
          custo_brl?: number;
          modelo: string;
          relatorio_id: string;
          tokens_in?: number;
          tokens_out?: number;
        };
        Update: {
          agente?: string;
          created_at?: string;
          custo_brl?: number;
          modelo?: string;
          relatorio_id?: string;
          tokens_in?: number;
          tokens_out?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'relatorio_custos_agentes_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'relatorios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'relatorio_custos_agentes_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'v_relatorios_resumo';
            referencedColumns: ['id'];
          },
        ];
      };
      relatorio_inputs: {
        Row: {
          a0_research_provider: string | null;
          area_m2_max: number;
          area_m2_min: number;
          bairro: string;
          bairros_indicados: Json | null;
          cidade: string;
          estacionamento_obrigatorio: boolean | null;
          genero_alvo: string;
          metadados: Json | null;
          publico_alvo: string;
          relatorio_id: string;
          tamanho_preset: string | null;
          tipo_negocio: Database['public']['Enums']['negocio_tipo'];
          uf: string | null;
        };
        Insert: {
          a0_research_provider?: string | null;
          area_m2_max: number;
          area_m2_min: number;
          bairro: string;
          bairros_indicados?: Json | null;
          cidade: string;
          estacionamento_obrigatorio?: boolean | null;
          genero_alvo?: string;
          metadados?: Json | null;
          publico_alvo?: string;
          relatorio_id: string;
          tamanho_preset?: string | null;
          tipo_negocio?: Database['public']['Enums']['negocio_tipo'];
          uf?: string | null;
        };
        Update: {
          a0_research_provider?: string | null;
          area_m2_max?: number;
          area_m2_min?: number;
          bairro?: string;
          bairros_indicados?: Json | null;
          cidade?: string;
          estacionamento_obrigatorio?: boolean | null;
          genero_alvo?: string;
          metadados?: Json | null;
          publico_alvo?: string;
          relatorio_id?: string;
          tamanho_preset?: string | null;
          tipo_negocio?: Database['public']['Enums']['negocio_tipo'];
          uf?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'relatorio_inputs_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: true;
            referencedRelation: 'relatorios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'relatorio_inputs_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: true;
            referencedRelation: 'v_relatorios_resumo';
            referencedColumns: ['id'];
          },
        ];
      };
      relatorio_outputs: {
        Row: {
          alertas: Json | null;
          aluguel_amostras: Json | null;
          aluguel_fonte_meta: Json | null;
          aluguel_max_m2: number | null;
          aluguel_mediana_m2: number | null;
          aluguel_mensal: number | null;
          aluguel_min_m2: number | null;
          aneis_competitivos: Json;
          cobertura_redes_a0: Json | null;
          contato_decisor: Json | null;
          demanda_futura: Json;
          demografia_bairro: Json;
          embedding: string | null;
          entrantes_cnpj_90d: Json;
          fonte_aluguel: string | null;
          justificativa_financeira: string | null;
          market_context: Json | null;
          modelo_recomendado: string | null;
          nivel_saturacao: string | null;
          obras_cno_em_curso: Json;
          posicionamento_estrategico: Json | null;
          posicionamento_recomendado: string | null;
          queries_aluguel_com_dados: number | null;
          rating_medio_concorrentes: number | null;
          relatorio_id: string;
          resumo_executivo: string | null;
          score_bairro: number | null;
          score_concorrencia: number | null;
          score_demografico: number | null;
          score_top1_candidato: number | null;
          score_viabilidade: number | null;
          total_concorrentes_analisados: number | null;
          veredito: string;
          zoneamento: Json | null;
        };
        Insert: {
          alertas?: Json | null;
          aluguel_amostras?: Json | null;
          aluguel_fonte_meta?: Json | null;
          aluguel_max_m2?: number | null;
          aluguel_mediana_m2?: number | null;
          aluguel_mensal?: number | null;
          aluguel_min_m2?: number | null;
          aneis_competitivos?: Json;
          cobertura_redes_a0?: Json | null;
          contato_decisor?: Json | null;
          demanda_futura?: Json;
          demografia_bairro?: Json;
          embedding?: string | null;
          entrantes_cnpj_90d?: Json;
          fonte_aluguel?: string | null;
          justificativa_financeira?: string | null;
          market_context?: Json | null;
          modelo_recomendado?: string | null;
          nivel_saturacao?: string | null;
          obras_cno_em_curso?: Json;
          posicionamento_estrategico?: Json | null;
          posicionamento_recomendado?: string | null;
          queries_aluguel_com_dados?: number | null;
          rating_medio_concorrentes?: number | null;
          relatorio_id: string;
          resumo_executivo?: string | null;
          score_bairro?: number | null;
          score_concorrencia?: number | null;
          score_demografico?: number | null;
          score_top1_candidato?: number | null;
          score_viabilidade?: number | null;
          total_concorrentes_analisados?: number | null;
          veredito: string;
          zoneamento?: Json | null;
        };
        Update: {
          alertas?: Json | null;
          aluguel_amostras?: Json | null;
          aluguel_fonte_meta?: Json | null;
          aluguel_max_m2?: number | null;
          aluguel_mediana_m2?: number | null;
          aluguel_mensal?: number | null;
          aluguel_min_m2?: number | null;
          aneis_competitivos?: Json;
          cobertura_redes_a0?: Json | null;
          contato_decisor?: Json | null;
          demanda_futura?: Json;
          demografia_bairro?: Json;
          embedding?: string | null;
          entrantes_cnpj_90d?: Json;
          fonte_aluguel?: string | null;
          justificativa_financeira?: string | null;
          market_context?: Json | null;
          modelo_recomendado?: string | null;
          nivel_saturacao?: string | null;
          obras_cno_em_curso?: Json;
          posicionamento_estrategico?: Json | null;
          posicionamento_recomendado?: string | null;
          queries_aluguel_com_dados?: number | null;
          rating_medio_concorrentes?: number | null;
          relatorio_id?: string;
          resumo_executivo?: string | null;
          score_bairro?: number | null;
          score_concorrencia?: number | null;
          score_demografico?: number | null;
          score_top1_candidato?: number | null;
          score_viabilidade?: number | null;
          total_concorrentes_analisados?: number | null;
          veredito?: string;
          zoneamento?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'relatorio_outputs_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: true;
            referencedRelation: 'relatorios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'relatorio_outputs_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: true;
            referencedRelation: 'v_relatorios_resumo';
            referencedColumns: ['id'];
          },
        ];
      };
      relatorio_state_checkpoint: {
        Row: {
          agente: string;
          created_at: string;
          relatorio_id: string;
          state: Json | null;
          state_keys: string[] | null;
        };
        Insert: {
          agente: string;
          created_at?: string;
          relatorio_id: string;
          state?: Json | null;
          state_keys?: string[] | null;
        };
        Update: {
          agente?: string;
          created_at?: string;
          relatorio_id?: string;
          state?: Json | null;
          state_keys?: string[] | null;
        };
        Relationships: [];
      };
      relatorios: {
        Row: {
          adk_run_id: string | null;
          created_at: string | null;
          custo_brl: number | null;
          data_execucao: string | null;
          deleted_at: string | null;
          erro_mensagem: string | null;
          etapa_atual: string | null;
          etapas_concluidas: Json | null;
          id: string;
          markdown_completo: string | null;
          market_tier_qwen: string | null;
          market_wave: string | null;
          notas_usuario: string | null;
          org_id: string;
          schema_version: string;
          status: Database['public']['Enums']['relatorio_status'];
          tempo_execucao_segundos: number | null;
          tipo_relatorio: Database['public']['Enums']['relatorio_tipo'];
          tokens_total: number | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          adk_run_id?: string | null;
          created_at?: string | null;
          custo_brl?: number | null;
          data_execucao?: string | null;
          deleted_at?: string | null;
          erro_mensagem?: string | null;
          etapa_atual?: string | null;
          etapas_concluidas?: Json | null;
          id?: string;
          markdown_completo?: string | null;
          market_tier_qwen?: string | null;
          market_wave?: string | null;
          notas_usuario?: string | null;
          org_id: string;
          schema_version?: string;
          status?: Database['public']['Enums']['relatorio_status'];
          tempo_execucao_segundos?: number | null;
          tipo_relatorio?: Database['public']['Enums']['relatorio_tipo'];
          tokens_total?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          adk_run_id?: string | null;
          created_at?: string | null;
          custo_brl?: number | null;
          data_execucao?: string | null;
          deleted_at?: string | null;
          erro_mensagem?: string | null;
          etapa_atual?: string | null;
          etapas_concluidas?: Json | null;
          id?: string;
          markdown_completo?: string | null;
          market_tier_qwen?: string | null;
          market_wave?: string | null;
          notas_usuario?: string | null;
          org_id?: string;
          schema_version?: string;
          status?: Database['public']['Enums']['relatorio_status'];
          tempo_execucao_segundos?: number | null;
          tipo_relatorio?: Database['public']['Enums']['relatorio_tipo'];
          tokens_total?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'relatorios_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'relatorios_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      renda_bairro: {
        Row: {
          ano: number;
          bairro: string;
          bairro_norm: string;
          cidade: string | null;
          domicilios: number | null;
          fonte: string;
          id: number;
          moradores_domicilio: number | null;
          municipio_cod: string;
          percentil_municipio: number | null;
          pessoas: number | null;
          ranking_municipio: number | null;
          renda_media: number | null;
          renda_mediana: number | null;
          renda_pc: number | null;
          uf: string | null;
          updated_at: string;
        };
        Insert: {
          ano?: number;
          bairro: string;
          bairro_norm: string;
          cidade?: string | null;
          domicilios?: number | null;
          fonte?: string;
          id?: never;
          moradores_domicilio?: number | null;
          municipio_cod: string;
          percentil_municipio?: number | null;
          pessoas?: number | null;
          ranking_municipio?: number | null;
          renda_media?: number | null;
          renda_mediana?: number | null;
          renda_pc?: number | null;
          uf?: string | null;
          updated_at?: string;
        };
        Update: {
          ano?: number;
          bairro?: string;
          bairro_norm?: string;
          cidade?: string | null;
          domicilios?: number | null;
          fonte?: string;
          id?: never;
          moradores_domicilio?: number | null;
          municipio_cod?: string;
          percentil_municipio?: number | null;
          pessoas?: number | null;
          ranking_municipio?: number | null;
          renda_media?: number | null;
          renda_mediana?: number | null;
          renda_pc?: number | null;
          uf?: string | null;
          updated_at?: string;
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
      scout_cadencia: {
        Row: {
          canal: Database['public']['Enums']['scout_canal'];
          condition: string | null;
          created_at: string;
          depends_on_message_id: string | null;
          id: string;
          prospect_id: string;
          regra_key: string;
          scheduled_at: string;
          status: string;
          stop_on_reply: boolean;
          toque_numero: number;
          updated_at: string;
        };
        Insert: {
          canal: Database['public']['Enums']['scout_canal'];
          condition?: string | null;
          created_at?: string;
          depends_on_message_id?: string | null;
          id?: string;
          prospect_id: string;
          regra_key: string;
          scheduled_at: string;
          status?: string;
          stop_on_reply?: boolean;
          toque_numero: number;
          updated_at?: string;
        };
        Update: {
          canal?: Database['public']['Enums']['scout_canal'];
          condition?: string | null;
          created_at?: string;
          depends_on_message_id?: string | null;
          id?: string;
          prospect_id?: string;
          regra_key?: string;
          scheduled_at?: string;
          status?: string;
          stop_on_reply?: boolean;
          toque_numero?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'scout_cadencia_depends_on_message_id_fkey';
            columns: ['depends_on_message_id'];
            isOneToOne: false;
            referencedRelation: 'scout_messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'scout_cadencia_prospect_id_fkey';
            columns: ['prospect_id'];
            isOneToOne: false;
            referencedRelation: 'prospects';
            referencedColumns: ['id'];
          },
        ];
      };
      scout_eventos: {
        Row: {
          actor: string | null;
          created_at: string;
          id: string;
          payload: Json;
          prospect_id: string | null;
          tipo: string;
        };
        Insert: {
          actor?: string | null;
          created_at?: string;
          id?: string;
          payload?: Json;
          prospect_id?: string | null;
          tipo: string;
        };
        Update: {
          actor?: string | null;
          created_at?: string;
          id?: string;
          payload?: Json;
          prospect_id?: string | null;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'scout_eventos_prospect_id_fkey';
            columns: ['prospect_id'];
            isOneToOne: false;
            referencedRelation: 'prospects';
            referencedColumns: ['id'];
          },
        ];
      };
      scout_jobs: {
        Row: {
          attempts: number;
          completed_at: string | null;
          created_at: string;
          error_message: string | null;
          id: string;
          input: Json;
          kind: Database['public']['Enums']['scout_job_kind'];
          max_attempts: number;
          output: Json | null;
          priority: number;
          prospect_id: string | null;
          scheduled_at: string;
          started_at: string | null;
          status: Database['public']['Enums']['scout_job_status'];
          updated_at: string;
          worker_id: string | null;
        };
        Insert: {
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          input?: Json;
          kind: Database['public']['Enums']['scout_job_kind'];
          max_attempts?: number;
          output?: Json | null;
          priority?: number;
          prospect_id?: string | null;
          scheduled_at?: string;
          started_at?: string | null;
          status?: Database['public']['Enums']['scout_job_status'];
          updated_at?: string;
          worker_id?: string | null;
        };
        Update: {
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          input?: Json;
          kind?: Database['public']['Enums']['scout_job_kind'];
          max_attempts?: number;
          output?: Json | null;
          priority?: number;
          prospect_id?: string | null;
          scheduled_at?: string;
          started_at?: string | null;
          status?: Database['public']['Enums']['scout_job_status'];
          updated_at?: string;
          worker_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'scout_jobs_prospect_id_fkey';
            columns: ['prospect_id'];
            isOneToOne: false;
            referencedRelation: 'prospects';
            referencedColumns: ['id'];
          },
        ];
      };
      scout_messages: {
        Row: {
          cadencia_id: string | null;
          canal: Database['public']['Enums']['scout_canal'];
          conteudo: string;
          created_at: string;
          delivered_at: string | null;
          destinatario: string;
          error_message: string | null;
          external_id: string | null;
          id: string;
          prospect_id: string;
          read_at: string | null;
          responded_at: string | null;
          resposta_texto: string | null;
          scheduled_at: string | null;
          sent_at: string | null;
          status: Database['public']['Enums']['scout_message_status'];
          template_key: string | null;
          updated_at: string;
          variables: Json;
        };
        Insert: {
          cadencia_id?: string | null;
          canal: Database['public']['Enums']['scout_canal'];
          conteudo: string;
          created_at?: string;
          delivered_at?: string | null;
          destinatario: string;
          error_message?: string | null;
          external_id?: string | null;
          id?: string;
          prospect_id: string;
          read_at?: string | null;
          responded_at?: string | null;
          resposta_texto?: string | null;
          scheduled_at?: string | null;
          sent_at?: string | null;
          status?: Database['public']['Enums']['scout_message_status'];
          template_key?: string | null;
          updated_at?: string;
          variables?: Json;
        };
        Update: {
          cadencia_id?: string | null;
          canal?: Database['public']['Enums']['scout_canal'];
          conteudo?: string;
          created_at?: string;
          delivered_at?: string | null;
          destinatario?: string;
          error_message?: string | null;
          external_id?: string | null;
          id?: string;
          prospect_id?: string;
          read_at?: string | null;
          responded_at?: string | null;
          resposta_texto?: string | null;
          scheduled_at?: string | null;
          sent_at?: string | null;
          status?: Database['public']['Enums']['scout_message_status'];
          template_key?: string | null;
          updated_at?: string;
          variables?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'scout_messages_cadencia_fk';
            columns: ['cadencia_id'];
            isOneToOne: false;
            referencedRelation: 'scout_cadencia';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'scout_messages_prospect_id_fkey';
            columns: ['prospect_id'];
            isOneToOne: false;
            referencedRelation: 'prospects';
            referencedColumns: ['id'];
          },
        ];
      };
      sensibilidade_cenarios: {
        Row: {
          cenario_id: string;
          id: string;
          lucro_mensal: number | null;
          margem_percentual: number | null;
          modelo: Database['public']['Enums']['cenario_modelo'];
          payback_meses: number | null;
          relatorio_id: string;
          stress_id: Database['public']['Enums']['sensibilidade_stress'];
          stress_label: string;
          viabilidade: Database['public']['Enums']['viabilidade_status'] | null;
        };
        Insert: {
          cenario_id: string;
          id?: string;
          lucro_mensal?: number | null;
          margem_percentual?: number | null;
          modelo: Database['public']['Enums']['cenario_modelo'];
          payback_meses?: number | null;
          relatorio_id: string;
          stress_id: Database['public']['Enums']['sensibilidade_stress'];
          stress_label: string;
          viabilidade?: Database['public']['Enums']['viabilidade_status'] | null;
        };
        Update: {
          cenario_id?: string;
          id?: string;
          lucro_mensal?: number | null;
          margem_percentual?: number | null;
          modelo?: Database['public']['Enums']['cenario_modelo'];
          payback_meses?: number | null;
          relatorio_id?: string;
          stress_id?: Database['public']['Enums']['sensibilidade_stress'];
          stress_label?: string;
          viabilidade?: Database['public']['Enums']['viabilidade_status'] | null;
        };
        Relationships: [
          {
            foreignKeyName: 'sensibilidade_cenarios_cenario_id_fkey';
            columns: ['cenario_id'];
            isOneToOne: false;
            referencedRelation: 'cenarios_financeiros';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sensibilidade_cenarios_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'relatorios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sensibilidade_cenarios_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'v_relatorios_resumo';
            referencedColumns: ['id'];
          },
        ];
      };
      sessions: {
        Row: {
          created_at: string | null;
          id: string;
          intencao: string | null;
          messages: Json | null;
          relatorio_id: string | null;
          slots: Json | null;
          status: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          intencao?: string | null;
          messages?: Json | null;
          relatorio_id?: string | null;
          slots?: Json | null;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          intencao?: string | null;
          messages?: Json | null;
          relatorio_id?: string | null;
          slots?: Json | null;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'sessions_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'relatorios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sessions_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'v_relatorios_resumo';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sessions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      settings: {
        Row: {
          created_at: string | null;
          description: string | null;
          key: string;
          updated_at: string | null;
          value: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          key: string;
          updated_at?: string | null;
          value: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          key?: string;
          updated_at?: string | null;
          value?: string;
        };
        Relationships: [];
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
      sipoc_customers: {
        Row: {
          descricao: string | null;
          id: string;
          nome: string;
          ordem: number | null;
          referencia: string | null;
          sipoc_map_id: string;
          tipo: string;
        };
        Insert: {
          descricao?: string | null;
          id?: string;
          nome: string;
          ordem?: number | null;
          referencia?: string | null;
          sipoc_map_id: string;
          tipo: string;
        };
        Update: {
          descricao?: string | null;
          id?: string;
          nome?: string;
          ordem?: number | null;
          referencia?: string | null;
          sipoc_map_id?: string;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sipoc_customers_sipoc_map_id_fkey';
            columns: ['sipoc_map_id'];
            isOneToOne: false;
            referencedRelation: 'sipoc_maps';
            referencedColumns: ['id'];
          },
        ];
      };
      sipoc_decisions: {
        Row: {
          acao: string;
          condicao: string;
          id: string;
          prioridade: number | null;
          proximo_step_id: string | null;
          sipoc_map_id: string;
        };
        Insert: {
          acao: string;
          condicao: string;
          id?: string;
          prioridade?: number | null;
          proximo_step_id?: string | null;
          sipoc_map_id: string;
        };
        Update: {
          acao?: string;
          condicao?: string;
          id?: string;
          prioridade?: number | null;
          proximo_step_id?: string | null;
          sipoc_map_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sipoc_decisions_sipoc_map_id_fkey';
            columns: ['sipoc_map_id'];
            isOneToOne: false;
            referencedRelation: 'sipoc_maps';
            referencedColumns: ['id'];
          },
        ];
      };
      sipoc_inputs: {
        Row: {
          formato: string | null;
          id: string;
          nome: string;
          obrigatorio: boolean | null;
          ordem: number | null;
          sipoc_map_id: string;
          supplier_id: string | null;
          tipo: string;
          validacao: string | null;
        };
        Insert: {
          formato?: string | null;
          id?: string;
          nome: string;
          obrigatorio?: boolean | null;
          ordem?: number | null;
          sipoc_map_id: string;
          supplier_id?: string | null;
          tipo: string;
          validacao?: string | null;
        };
        Update: {
          formato?: string | null;
          id?: string;
          nome?: string;
          obrigatorio?: boolean | null;
          ordem?: number | null;
          sipoc_map_id?: string;
          supplier_id?: string | null;
          tipo?: string;
          validacao?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'sipoc_inputs_sipoc_map_id_fkey';
            columns: ['sipoc_map_id'];
            isOneToOne: false;
            referencedRelation: 'sipoc_maps';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sipoc_inputs_supplier_id_fkey';
            columns: ['supplier_id'];
            isOneToOne: false;
            referencedRelation: 'sipoc_suppliers';
            referencedColumns: ['id'];
          },
        ];
      };
      sipoc_maps: {
        Row: {
          alertas: Json | null;
          atualizado_em: string | null;
          criado_em: string | null;
          criado_por: string | null;
          ferramentas: Json | null;
          id: string;
          process_id: string;
          proximo_steps: Json | null;
          responsavel: string;
          sla_horas: number | null;
          status: string | null;
          step_descricao: string | null;
          step_id: string;
          step_nome: string;
          version: number | null;
        };
        Insert: {
          alertas?: Json | null;
          atualizado_em?: string | null;
          criado_em?: string | null;
          criado_por?: string | null;
          ferramentas?: Json | null;
          id?: string;
          process_id: string;
          proximo_steps?: Json | null;
          responsavel: string;
          sla_horas?: number | null;
          status?: string | null;
          step_descricao?: string | null;
          step_id: string;
          step_nome: string;
          version?: number | null;
        };
        Update: {
          alertas?: Json | null;
          atualizado_em?: string | null;
          criado_em?: string | null;
          criado_por?: string | null;
          ferramentas?: Json | null;
          id?: string;
          process_id?: string;
          proximo_steps?: Json | null;
          responsavel?: string;
          sla_horas?: number | null;
          status?: string | null;
          step_descricao?: string | null;
          step_id?: string;
          step_nome?: string;
          version?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'sipoc_maps_process_id_fkey';
            columns: ['process_id'];
            isOneToOne: false;
            referencedRelation: 'processes';
            referencedColumns: ['id'];
          },
        ];
      };
      sipoc_outputs: {
        Row: {
          condicao: string | null;
          destino: string | null;
          formato: string | null;
          id: string;
          nome: string;
          ordem: number | null;
          sipoc_map_id: string;
          tipo: string;
        };
        Insert: {
          condicao?: string | null;
          destino?: string | null;
          formato?: string | null;
          id?: string;
          nome: string;
          ordem?: number | null;
          sipoc_map_id: string;
          tipo: string;
        };
        Update: {
          condicao?: string | null;
          destino?: string | null;
          formato?: string | null;
          id?: string;
          nome?: string;
          ordem?: number | null;
          sipoc_map_id?: string;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sipoc_outputs_sipoc_map_id_fkey';
            columns: ['sipoc_map_id'];
            isOneToOne: false;
            referencedRelation: 'sipoc_maps';
            referencedColumns: ['id'];
          },
        ];
      };
      sipoc_suppliers: {
        Row: {
          descricao: string | null;
          id: string;
          nome: string;
          ordem: number | null;
          referencia: string | null;
          sipoc_map_id: string;
          tipo: string;
        };
        Insert: {
          descricao?: string | null;
          id?: string;
          nome: string;
          ordem?: number | null;
          referencia?: string | null;
          sipoc_map_id: string;
          tipo: string;
        };
        Update: {
          descricao?: string | null;
          id?: string;
          nome?: string;
          ordem?: number | null;
          referencia?: string | null;
          sipoc_map_id?: string;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sipoc_suppliers_sipoc_map_id_fkey';
            columns: ['sipoc_map_id'];
            isOneToOne: false;
            referencedRelation: 'sipoc_maps';
            referencedColumns: ['id'];
          },
        ];
      };
      skill_executions: {
        Row: {
          agent_id: string | null;
          avisos: Json | null;
          duracao_ms: number | null;
          erros: Json | null;
          executado_em: string | null;
          id: string;
          payload_entrada: Json | null;
          resultado: Json | null;
          sipoc_map_id: string | null;
          skill_id: string;
          skill_version: string | null;
          sucesso: boolean | null;
        };
        Insert: {
          agent_id?: string | null;
          avisos?: Json | null;
          duracao_ms?: number | null;
          erros?: Json | null;
          executado_em?: string | null;
          id?: string;
          payload_entrada?: Json | null;
          resultado?: Json | null;
          sipoc_map_id?: string | null;
          skill_id?: string;
          skill_version?: string | null;
          sucesso?: boolean | null;
        };
        Update: {
          agent_id?: string | null;
          avisos?: Json | null;
          duracao_ms?: number | null;
          erros?: Json | null;
          executado_em?: string | null;
          id?: string;
          payload_entrada?: Json | null;
          resultado?: Json | null;
          sipoc_map_id?: string | null;
          skill_id?: string;
          skill_version?: string | null;
          sucesso?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: 'skill_executions_sipoc_map_id_fkey';
            columns: ['sipoc_map_id'];
            isOneToOne: false;
            referencedRelation: 'sipoc_maps';
            referencedColumns: ['id'];
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
      tarefa_anexos: {
        Row: {
          content_type: string | null;
          criado_em: string;
          deleted_at: string | null;
          id: string;
          nome_arquivo: string;
          nota_id: string | null;
          storage_path: string;
          tamanho_bytes: number | null;
          tarefa_id: string;
        };
        Insert: {
          content_type?: string | null;
          criado_em?: string;
          deleted_at?: string | null;
          id?: string;
          nome_arquivo: string;
          nota_id?: string | null;
          storage_path: string;
          tamanho_bytes?: number | null;
          tarefa_id: string;
        };
        Update: {
          content_type?: string | null;
          criado_em?: string;
          deleted_at?: string | null;
          id?: string;
          nome_arquivo?: string;
          nota_id?: string | null;
          storage_path?: string;
          tamanho_bytes?: number | null;
          tarefa_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tarefa_anexos_nota_id_fkey';
            columns: ['nota_id'];
            isOneToOne: false;
            referencedRelation: 'tarefa_notas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tarefa_anexos_tarefa_id_fkey';
            columns: ['tarefa_id'];
            isOneToOne: false;
            referencedRelation: 'tarefas';
            referencedColumns: ['id'];
          },
        ];
      };
      tarefa_checklist: {
        Row: {
          concluido: boolean | null;
          criterio_aceite: string | null;
          deleted_at: string | null;
          descricao: string;
          id: string;
          ordem: number | null;
          responsavel_pessoa_id: string | null;
          tarefa_id: string;
        };
        Insert: {
          concluido?: boolean | null;
          criterio_aceite?: string | null;
          deleted_at?: string | null;
          descricao: string;
          id?: string;
          ordem?: number | null;
          responsavel_pessoa_id?: string | null;
          tarefa_id: string;
        };
        Update: {
          concluido?: boolean | null;
          criterio_aceite?: string | null;
          deleted_at?: string | null;
          descricao?: string;
          id?: string;
          ordem?: number | null;
          responsavel_pessoa_id?: string | null;
          tarefa_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tarefa_checklist_responsavel_pessoa_id_fkey';
            columns: ['responsavel_pessoa_id'];
            isOneToOne: false;
            referencedRelation: 'projeto_pessoas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tarefa_checklist_tarefa_id_fkey';
            columns: ['tarefa_id'];
            isOneToOne: false;
            referencedRelation: 'tarefas';
            referencedColumns: ['id'];
          },
        ];
      };
      tarefa_comentarios: {
        Row: {
          conteudo: string;
          created_at: string | null;
          deleted_at: string | null;
          id: string;
          tarefa_id: string;
          user_id: string;
        };
        Insert: {
          conteudo: string;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          tarefa_id: string;
          user_id: string;
        };
        Update: {
          conteudo?: string;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          tarefa_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tarefa_comentarios_tarefa_id_fkey';
            columns: ['tarefa_id'];
            isOneToOne: false;
            referencedRelation: 'tarefas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tarefa_comentarios_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      tarefa_dependencias: {
        Row: {
          depende_de_tarefa_id: string;
          id: string;
          tarefa_id: string;
          tipo: string;
        };
        Insert: {
          depende_de_tarefa_id: string;
          id?: string;
          tarefa_id: string;
          tipo?: string;
        };
        Update: {
          depende_de_tarefa_id?: string;
          id?: string;
          tarefa_id?: string;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tarefa_dependencias_depende_de_tarefa_id_fkey';
            columns: ['depende_de_tarefa_id'];
            isOneToOne: false;
            referencedRelation: 'tarefas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tarefa_dependencias_tarefa_id_fkey';
            columns: ['tarefa_id'];
            isOneToOne: false;
            referencedRelation: 'tarefas';
            referencedColumns: ['id'];
          },
        ];
      };
      tarefa_notas: {
        Row: {
          autor_nome: string;
          autor_user_id: string | null;
          checklist_item_id: string | null;
          criado_em: string;
          deleted_at: string | null;
          id: string;
          origem: string;
          tarefa_id: string;
          texto: string;
          tipo: string;
        };
        Insert: {
          autor_nome: string;
          autor_user_id?: string | null;
          checklist_item_id?: string | null;
          criado_em?: string;
          deleted_at?: string | null;
          id?: string;
          origem?: string;
          tarefa_id: string;
          texto: string;
          tipo?: string;
        };
        Update: {
          autor_nome?: string;
          autor_user_id?: string | null;
          checklist_item_id?: string | null;
          criado_em?: string;
          deleted_at?: string | null;
          id?: string;
          origem?: string;
          tarefa_id?: string;
          texto?: string;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tarefa_notas_checklist_item_id_fkey';
            columns: ['checklist_item_id'];
            isOneToOne: false;
            referencedRelation: 'tarefa_checklist';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tarefa_notas_tarefa_id_fkey';
            columns: ['tarefa_id'];
            isOneToOne: false;
            referencedRelation: 'tarefas';
            referencedColumns: ['id'];
          },
        ];
      };
      tarefa_okrs: {
        Row: {
          okr_id: string;
          tarefa_id: string;
        };
        Insert: {
          okr_id: string;
          tarefa_id: string;
        };
        Update: {
          okr_id?: string;
          tarefa_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tarefa_okrs_okr_id_fkey';
            columns: ['okr_id'];
            isOneToOne: false;
            referencedRelation: 'okrs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tarefa_okrs_tarefa_id_fkey';
            columns: ['tarefa_id'];
            isOneToOne: false;
            referencedRelation: 'tarefas';
            referencedColumns: ['id'];
          },
        ];
      };
      tarefa_participantes: {
        Row: {
          criado_em: string;
          deleted_at: string | null;
          id: string;
          papel: string;
          pessoa_id: string;
          tarefa_id: string;
        };
        Insert: {
          criado_em?: string;
          deleted_at?: string | null;
          id?: string;
          papel?: string;
          pessoa_id: string;
          tarefa_id: string;
        };
        Update: {
          criado_em?: string;
          deleted_at?: string | null;
          id?: string;
          papel?: string;
          pessoa_id?: string;
          tarefa_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tarefa_participantes_pessoa_id_fkey';
            columns: ['pessoa_id'];
            isOneToOne: false;
            referencedRelation: 'projeto_pessoas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tarefa_participantes_tarefa_id_fkey';
            columns: ['tarefa_id'];
            isOneToOne: false;
            referencedRelation: 'tarefas';
            referencedColumns: ['id'];
          },
        ];
      };
      tarefas: {
        Row: {
          aceita_pelo_usuario: boolean | null;
          categoria: string;
          created_at: string | null;
          criterio_verificacao: string | null;
          custo_planejado: number | null;
          custo_real: number | null;
          data_conclusao: string | null;
          data_inicio: string | null;
          data_prevista_conclusao: string | null;
          deleted_at: string | null;
          descricao: string | null;
          id: string;
          okr_id: string | null;
          ordem: number | null;
          origem_relatorio_insight: string | null;
          origem_relatorio_secao: string | null;
          playbook_id: string;
          prioridade: string;
          projeto_id: string;
          responsavel_email: string | null;
          responsavel_nome: string | null;
          responsavel_pessoa_id: string | null;
          responsavel_telefone: string | null;
          status: string;
          sugerida_pela_ia: boolean | null;
          tarefa_pai_id: string | null;
          titulo: string;
          updated_at: string | null;
        };
        Insert: {
          aceita_pelo_usuario?: boolean | null;
          categoria: string;
          created_at?: string | null;
          criterio_verificacao?: string | null;
          custo_planejado?: number | null;
          custo_real?: number | null;
          data_conclusao?: string | null;
          data_inicio?: string | null;
          data_prevista_conclusao?: string | null;
          deleted_at?: string | null;
          descricao?: string | null;
          id?: string;
          okr_id?: string | null;
          ordem?: number | null;
          origem_relatorio_insight?: string | null;
          origem_relatorio_secao?: string | null;
          playbook_id: string;
          prioridade?: string;
          projeto_id: string;
          responsavel_email?: string | null;
          responsavel_nome?: string | null;
          responsavel_pessoa_id?: string | null;
          responsavel_telefone?: string | null;
          status?: string;
          sugerida_pela_ia?: boolean | null;
          tarefa_pai_id?: string | null;
          titulo: string;
          updated_at?: string | null;
        };
        Update: {
          aceita_pelo_usuario?: boolean | null;
          categoria?: string;
          created_at?: string | null;
          criterio_verificacao?: string | null;
          custo_planejado?: number | null;
          custo_real?: number | null;
          data_conclusao?: string | null;
          data_inicio?: string | null;
          data_prevista_conclusao?: string | null;
          deleted_at?: string | null;
          descricao?: string | null;
          id?: string;
          okr_id?: string | null;
          ordem?: number | null;
          origem_relatorio_insight?: string | null;
          origem_relatorio_secao?: string | null;
          playbook_id?: string;
          prioridade?: string;
          projeto_id?: string;
          responsavel_email?: string | null;
          responsavel_nome?: string | null;
          responsavel_pessoa_id?: string | null;
          responsavel_telefone?: string | null;
          status?: string;
          sugerida_pela_ia?: boolean | null;
          tarefa_pai_id?: string | null;
          titulo?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_tarefas_okr';
            columns: ['okr_id'];
            isOneToOne: false;
            referencedRelation: 'okrs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tarefas_playbook_id_fkey';
            columns: ['playbook_id'];
            isOneToOne: false;
            referencedRelation: 'playbooks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tarefas_projeto_id_fkey';
            columns: ['projeto_id'];
            isOneToOne: false;
            referencedRelation: 'user_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tarefas_responsavel_pessoa_id_fkey';
            columns: ['responsavel_pessoa_id'];
            isOneToOne: false;
            referencedRelation: 'projeto_pessoas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tarefas_tarefa_pai_id_fkey';
            columns: ['tarefa_pai_id'];
            isOneToOne: false;
            referencedRelation: 'tarefas';
            referencedColumns: ['id'];
          },
        ];
      };
      tasks: {
        Row: {
          active: boolean | null;
          created_at: string | null;
          cron_expr: string | null;
          id: string;
          last_run_at: string | null;
          meta: Json;
          name: string;
        };
        Insert: {
          active?: boolean | null;
          created_at?: string | null;
          cron_expr?: string | null;
          id?: string;
          last_run_at?: string | null;
          meta: Json;
          name: string;
        };
        Update: {
          active?: boolean | null;
          created_at?: string | null;
          cron_expr?: string | null;
          id?: string;
          last_run_at?: string | null;
          meta?: Json;
          name?: string;
        };
        Relationships: [];
      };
      timeline_eventos: {
        Row: {
          cor: string | null;
          created_at: string | null;
          data: string;
          deleted_at: string | null;
          descricao: string | null;
          id: string;
          playbook_id: string;
          tipo: string;
          titulo: string;
        };
        Insert: {
          cor?: string | null;
          created_at?: string | null;
          data: string;
          deleted_at?: string | null;
          descricao?: string | null;
          id?: string;
          playbook_id: string;
          tipo?: string;
          titulo: string;
        };
        Update: {
          cor?: string | null;
          created_at?: string | null;
          data?: string;
          deleted_at?: string | null;
          descricao?: string | null;
          id?: string;
          playbook_id?: string;
          tipo?: string;
          titulo?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'timeline_eventos_playbook_id_fkey';
            columns: ['playbook_id'];
            isOneToOne: false;
            referencedRelation: 'playbooks';
            referencedColumns: ['id'];
          },
        ];
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
          driver_id: string | null;
          financial_status: string;
          id: string;
          notes: string | null;
          status_operational: string;
          trip_number: string;
          updated_at: string;
          vehicle_plate: string | null;
          vehicle_type_id: string | null;
        };
        Insert: {
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          departure_at?: string | null;
          driver_id?: string | null;
          financial_status?: string;
          id?: string;
          notes?: string | null;
          status_operational?: string;
          trip_number: string;
          updated_at?: string;
          vehicle_plate?: string | null;
          vehicle_type_id?: string | null;
        };
        Update: {
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          departure_at?: string | null;
          driver_id?: string | null;
          financial_status?: string;
          id?: string;
          notes?: string | null;
          status_operational?: string;
          trip_number?: string;
          updated_at?: string;
          vehicle_plate?: string | null;
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
      user_projects: {
        Row: {
          anexos: Json | null;
          candidatos: Json | null;
          concorrencia: Json | null;
          created_at: string | null;
          deleted_at: string | null;
          financeiro: Json | null;
          id: string;
          intencao_principal: string | null;
          localizacao: Json | null;
          mercado: Json | null;
          modelo_negocio: Json | null;
          nome: string | null;
          org_id: string | null;
          posicionamento: Json | null;
          relatorio_id: string | null;
          status: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          anexos?: Json | null;
          candidatos?: Json | null;
          concorrencia?: Json | null;
          created_at?: string | null;
          deleted_at?: string | null;
          financeiro?: Json | null;
          id?: string;
          intencao_principal?: string | null;
          localizacao?: Json | null;
          mercado?: Json | null;
          modelo_negocio?: Json | null;
          nome?: string | null;
          org_id?: string | null;
          posicionamento?: Json | null;
          relatorio_id?: string | null;
          status?: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          anexos?: Json | null;
          candidatos?: Json | null;
          concorrencia?: Json | null;
          created_at?: string | null;
          deleted_at?: string | null;
          financeiro?: Json | null;
          id?: string;
          intencao_principal?: string | null;
          localizacao?: Json | null;
          mercado?: Json | null;
          modelo_negocio?: Json | null;
          nome?: string | null;
          org_id?: string | null;
          posicionamento?: Json | null;
          relatorio_id?: string | null;
          status?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_projects_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_projects_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'relatorios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_projects_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'v_relatorios_resumo';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_projects_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
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
      validacoes: {
        Row: {
          alertas: Json;
          claims_com_alertas: number;
          claims_verificadas: number;
          created_at: string;
          fontes_independentes: string[];
          id: string;
          org_id: string;
          payload: Json;
          relatorio_id: string;
          resumo_executivo_validacao: string;
          revisar_manual: boolean;
          score_validacao: number;
          status_validacao: string;
          validacao_id: string;
        };
        Insert: {
          alertas?: Json;
          claims_com_alertas?: number;
          claims_verificadas?: number;
          created_at?: string;
          fontes_independentes?: string[];
          id?: string;
          org_id: string;
          payload?: Json;
          relatorio_id: string;
          resumo_executivo_validacao?: string;
          revisar_manual?: boolean;
          score_validacao?: number;
          status_validacao: string;
          validacao_id: string;
        };
        Update: {
          alertas?: Json;
          claims_com_alertas?: number;
          claims_verificadas?: number;
          created_at?: string;
          fontes_independentes?: string[];
          id?: string;
          org_id?: string;
          payload?: Json;
          relatorio_id?: string;
          resumo_executivo_validacao?: string;
          revisar_manual?: boolean;
          score_validacao?: number;
          status_validacao?: string;
          validacao_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'validacoes_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'validacoes_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'relatorios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'validacoes_relatorio_id_fkey';
            columns: ['relatorio_id'];
            isOneToOne: false;
            referencedRelation: 'v_relatorios_resumo';
            referencedColumns: ['id'];
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
          renavam: string | null;
          rntrc_proprietario: string | null;
          tipo_proprietario: number | null;
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
          renavam?: string | null;
          rntrc_proprietario?: string | null;
          tipo_proprietario?: number | null;
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
          renavam?: string | null;
          rntrc_proprietario?: string | null;
          tipo_proprietario?: number | null;
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
      webhook_claw_log: {
        Row: {
          created_at: string;
          duracao_ms: number | null;
          evento: string;
          http_status: number | null;
          id: string;
          oportunidade_id: string | null;
          payload: Json;
          resposta: string | null;
        };
        Insert: {
          created_at?: string;
          duracao_ms?: number | null;
          evento: string;
          http_status?: number | null;
          id?: string;
          oportunidade_id?: string | null;
          payload?: Json;
          resposta?: string | null;
        };
        Update: {
          created_at?: string;
          duracao_ms?: number | null;
          evento?: string;
          http_status?: number | null;
          id?: string;
          oportunidade_id?: string | null;
          payload?: Json;
          resposta?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'webhook_claw_log_oportunidade_id_fkey';
            columns: ['oportunidade_id'];
            isOneToOne: false;
            referencedRelation: 'oportunidades_prospeccao';
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
      insurance_metrics_error_breakdown: {
        Row: {
          bucket_1h: string | null;
          count: number | null;
          environment: string | null;
          error_code: string | null;
          status: string | null;
        };
        Relationships: [];
      };
      insurance_metrics_latency: {
        Row: {
          bucket_5m: string | null;
          environment: string | null;
          p50_ms: number | null;
          p95_ms: number | null;
          p99_ms: number | null;
        };
        Relationships: [];
      };
      insurance_metrics_volume: {
        Row: {
          bucket_5m: string | null;
          environment: string | null;
          error_count: number | null;
          error_rate: number | null;
          fallback_count: number | null;
          fallback_ratio: number | null;
          rate_limit_count: number | null;
          requests_total: number | null;
          success_count: number | null;
          timeout_count: number | null;
        };
        Relationships: [];
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
      v_bairros_aggregate: {
        Row: {
          aluguel_mediana_m2_medio: number | null;
          bairro: string | null;
          cidade: string | null;
          score_bairro_medio: number | null;
          score_top1_medio: number | null;
          total_relatorios: number | null;
          uf: string | null;
          ultima_execucao: string | null;
          veredito_mais_comum: string | null;
        };
        Relationships: [];
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
      v_relatorios_resumo: {
        Row: {
          aluguel_mediana_m2: number | null;
          area_m2_max: number | null;
          area_m2_min: number | null;
          bairro: string | null;
          cidade: string | null;
          created_at: string | null;
          custo_brl: number | null;
          data_execucao: string | null;
          gaps_count: number | null;
          id: string | null;
          market_tier_qwen: string | null;
          market_wave: string | null;
          modelo_recomendado: string | null;
          nivel_saturacao: string | null;
          org_id: string | null;
          publico_alvo: string | null;
          score_bairro: number | null;
          score_top1_candidato: number | null;
          status: Database['public']['Enums']['relatorio_status'] | null;
          tempo_execucao_segundos: number | null;
          ticket_recomendado: number | null;
          tipo_negocio: Database['public']['Enums']['negocio_tipo'] | null;
          tipo_relatorio: Database['public']['Enums']['relatorio_tipo'] | null;
          uf: string | null;
          user_id: string | null;
          veredito: string | null;
          veredito_posicionamento: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'relatorios_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'relatorios_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
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
      vw_ntc_publish_pattern: {
        Row: {
          dia_nome: string | null;
          dia_semana: number | null;
          hit_rate_pct: number | null;
          hora_brt: number | null;
          publicacoes_novas: number | null;
          scrapes_com_dados: number | null;
          total_tentativas: number | null;
        };
        Relationships: [];
      };
      vw_ntc_scrape_history: {
        Row: {
          duration_ms: number | null;
          error_message: string | null;
          is_new_period: boolean | null;
          periodo_referencia: string | null;
          scraped_at_brt: string | null;
          status: string | null;
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
          driver_id: string | null;
          financial_status: string;
          id: string;
          notes: string | null;
          status_operational: string;
          trip_number: string;
          updated_at: string;
          vehicle_plate: string | null;
          vehicle_type_id: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'trips';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_trip_from_composition: {
        Args: {
          p_composition_id: string;
          p_notes?: string;
          p_total_cost_pag: number;
          p_total_value_fat: number;
          p_user_id: string;
        };
        Returns: string;
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
      get_vault_secret: { Args: { p_name: string }; Returns: string };
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
      is_org_admin: { Args: { org_uuid: string }; Returns: boolean };
      link_order_to_target_trip: {
        Args: { p_order_id: string; p_trip_id: string };
        Returns: string;
      };
      link_order_to_trip: { Args: { p_order_id: string }; Returns: string };
      mask_cep: { Args: { input: string }; Returns: string };
      mask_cnpj: { Args: { input: string }; Returns: string };
      mask_cpf: { Args: { input: string }; Returns: string };
      mask_plate: { Args: { input: string }; Returns: string };
      match_kb_chunks: {
        Args: {
          match_count?: number;
          min_similarity?: number;
          query_embedding: string;
        };
        Returns: {
          ano_referencia: number;
          conteudo: string;
          fonte: string;
          id: string;
          similarity: number;
          titulo: string;
          url: string;
        }[];
      };
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
      norm_plate: { Args: { input: string }; Returns: string };
      only_digits: { Args: { input: string }; Returns: string };
      rank_drivers_for_quote: {
        Args: {
          p_dest_city?: string;
          p_dest_state?: string;
          p_exclude_driver_ids?: string[];
          p_max_results?: number;
          p_min_quality_score?: number;
          p_origin_city?: string;
          p_origin_state?: string;
          p_vehicle_type_id: string;
          p_w_history?: number;
          p_w_price?: number;
          p_w_proximity?: number;
          p_w_quality?: number;
        };
        Returns: {
          driver_cpf: string;
          driver_id: string;
          driver_name: string;
          driver_phone: string;
          history_pts: number;
          owner_city: string;
          owner_id: string;
          owner_state: string;
          proximity_pts: number;
          quality_pts: number;
          quality_score: number;
          route_count: number;
          score_details: Json;
          total_score: number;
          vehicle_id: string;
          vehicle_plate: string;
          vehicle_type_id: string;
        }[];
      };
      recover_stale_running_reports: {
        Args: { p_orphan_minutes?: number; p_relatorio_id?: string };
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
      user_org_ids: { Args: never; Returns: string[] };
      validate_api_key: {
        Args: { p_key: string; p_scope: string };
        Returns: boolean;
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
      app_role: 'admin' | 'comercial' | 'operacao' | 'financeiro' | 'leitura';
      cenario_modelo: 'low' | 'mid' | 'premium';
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
        | 'a_vista_pag'
        | 'ciot'
        | 'xml';
      driver_contract_type: 'proprio' | 'agregado' | 'terceiro';
      driver_offer_status: 'pending' | 'sent' | 'accepted' | 'declined' | 'timeout' | 'skipped';
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
      negocio_tipo: 'academia' | 'crossfit_box' | 'studio_pilates' | 'studio_funcional' | 'outro';
      occurrence_severity: 'baixa' | 'media' | 'alta' | 'critica';
      offer_sequence_status:
        | 'ranking'
        | 'in_progress'
        | 'completed'
        | 'exhausted'
        | 'escalated'
        | 'cancelled';
      order_stage:
        | 'ordem_criada'
        | 'busca_motorista'
        | 'documentacao'
        | 'coleta_realizada'
        | 'em_transito'
        | 'entregue';
      otimizacao_status: 'pendente' | 'aprovada' | 'rejeitada' | 'implementada' | 'cancelada';
      otimizacao_tipo:
        | 'MODELO_OVERPRICED'
        | 'FLASH_PARA_LITE'
        | 'AGENTE_VORAZ'
        | 'ERRO_REPETIDO'
        | 'CACHE_GEOCODING'
        | 'OUTRO';
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
        | 'taxas_adicionais'
        | 'conteiner'
        | 'pedagio'
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
      relatorio_status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
      relatorio_tipo: 'prospeccao_academia' | 'prospeccao_crossfit' | 'prospeccao_studio';
      risk_criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      risk_evaluation_status: 'pending' | 'evaluated' | 'approved' | 'rejected' | 'expired';
      rntrc_registry_type: 'TAC' | 'ETC';
      route_stop_type: 'origin' | 'stop' | 'destination';
      scout_canal: 'whatsapp' | 'instagram_dm' | 'email' | 'telefone';
      scout_job_kind:
        | 'descobrir_perfil'
        | 'triar_temperatura'
        | 'comite_360'
        | 'compor_mensagem'
        | 'agendar_cadencia';
      scout_job_status: 'pending' | 'processing' | 'done' | 'failed' | 'skipped';
      scout_message_status:
        | 'draft'
        | 'scheduled'
        | 'sent'
        | 'delivered'
        | 'read'
        | 'responded'
        | 'failed'
        | 'cancelled';
      scout_prospect_status:
        | 'descoberta'
        | 'triada'
        | 'comite_360'
        | 'aprovada'
        | 'em_cadencia'
        | 'respondida'
        | 'convertida'
        | 'descartada';
      scout_temperatura: 'desconhecida' | 'quente' | 'morno' | 'frio';
      sensibilidade_stress: 'aluguel_mais_20pct' | 'matriculas_menos_30pct' | 'ticket_menos_15pct';
      user_profile: 'admin' | 'operacional' | 'financeiro' | 'comercial';
      viabilidade_status: 'ALTO' | 'MEDIO' | 'BAIXO' | 'INVIAVEL';
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
      app_role: ['admin', 'comercial', 'operacao', 'financeiro', 'leitura'],
      cenario_modelo: ['low', 'mid', 'premium'],
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
        'ciot',
        'xml',
      ],
      driver_contract_type: ['proprio', 'agregado', 'terceiro'],
      driver_offer_status: ['pending', 'sent', 'accepted', 'declined', 'timeout', 'skipped'],
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
      negocio_tipo: ['academia', 'crossfit_box', 'studio_pilates', 'studio_funcional', 'outro'],
      occurrence_severity: ['baixa', 'media', 'alta', 'critica'],
      offer_sequence_status: [
        'ranking',
        'in_progress',
        'completed',
        'exhausted',
        'escalated',
        'cancelled',
      ],
      order_stage: [
        'ordem_criada',
        'busca_motorista',
        'documentacao',
        'coleta_realizada',
        'em_transito',
        'entregue',
      ],
      otimizacao_status: ['pendente', 'aprovada', 'rejeitada', 'implementada', 'cancelada'],
      otimizacao_tipo: [
        'MODELO_OVERPRICED',
        'FLASH_PARA_LITE',
        'AGENTE_VORAZ',
        'ERRO_REPETIDO',
        'CACHE_GEOCODING',
        'OUTRO',
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
        'taxas_adicionais',
        'conteiner',
        'pedagio',
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
      relatorio_status: ['queued', 'running', 'done', 'failed', 'cancelled'],
      relatorio_tipo: ['prospeccao_academia', 'prospeccao_crossfit', 'prospeccao_studio'],
      risk_criticality: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      risk_evaluation_status: ['pending', 'evaluated', 'approved', 'rejected', 'expired'],
      rntrc_registry_type: ['TAC', 'ETC'],
      route_stop_type: ['origin', 'stop', 'destination'],
      scout_canal: ['whatsapp', 'instagram_dm', 'email', 'telefone'],
      scout_job_kind: [
        'descobrir_perfil',
        'triar_temperatura',
        'comite_360',
        'compor_mensagem',
        'agendar_cadencia',
      ],
      scout_job_status: ['pending', 'processing', 'done', 'failed', 'skipped'],
      scout_message_status: [
        'draft',
        'scheduled',
        'sent',
        'delivered',
        'read',
        'responded',
        'failed',
        'cancelled',
      ],
      scout_prospect_status: [
        'descoberta',
        'triada',
        'comite_360',
        'aprovada',
        'em_cadencia',
        'respondida',
        'convertida',
        'descartada',
      ],
      scout_temperatura: ['desconhecida', 'quente', 'morno', 'frio'],
      sensibilidade_stress: ['aluguel_mais_20pct', 'matriculas_menos_30pct', 'ticket_menos_15pct'],
      user_profile: ['admin', 'operacional', 'financeiro', 'comercial'],
      viabilidade_status: ['ALTO', 'MEDIO', 'BAIXO', 'INVIAVEL'],
    },
  },
} as const;
