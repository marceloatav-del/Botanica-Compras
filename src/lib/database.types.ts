export type PerfilUsuario = 'admin' | 'loja' | 'fornecedor';

export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: { id: string; nome: string; email: string; perfil: PerfilUsuario; ativo: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; nome: string; email: string; perfil: PerfilUsuario; ativo?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: never; nome?: string; email?: string; perfil?: PerfilUsuario; ativo?: boolean; updated_at?: string };
        Relationships: [];
      };
      produtos: {
        Row: { id: string; nome: string; unidade_medida: string; ativo: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; nome: string; unidade_medida: string; ativo?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: never; nome?: string; unidade_medida?: string; ativo?: boolean; updated_at?: string };
        Relationships: [];
      };
      lojas: {
        Row: { id: string; nome: string; cnpj: string | null; endereco: string | null; pedido_minimo: number | null; ativo: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; nome: string; cnpj?: string | null; endereco?: string | null; pedido_minimo?: number | null; ativo?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: never; nome?: string; cnpj?: string | null; endereco?: string | null; pedido_minimo?: number | null; ativo?: boolean; updated_at?: string };
        Relationships: [];
      };
      fornecedores: {
        Row: { id: string; nome: string; email: string; ativo: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; nome: string; email: string; ativo?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: never; nome?: string; email?: string; ativo?: boolean; updated_at?: string };
        Relationships: [];
      };
      cotacoes: {
        Row: { id: string; fornecedor_id: string; criado_por_id: string | null; created_at: string };
        Insert: { id?: string; fornecedor_id: string; criado_por_id?: string | null; created_at?: string };
        Update: { id?: never; fornecedor_id?: string; criado_por_id?: string | null };
        Relationships: [
          { foreignKeyName: 'cotacoes_fornecedor_id_fkey'; columns: ['fornecedor_id']; isOneToOne: false; referencedRelation: 'fornecedores'; referencedColumns: ['id'] },
          { foreignKeyName: 'cotacoes_criado_por_id_fkey'; columns: ['criado_por_id']; isOneToOne: false; referencedRelation: 'usuarios'; referencedColumns: ['id'] },
        ];
      };
      cotacao_itens: {
        Row: { id: string; cotacao_id: string; produto_id: string; loja_id: string; created_at: string };
        Insert: { id?: string; cotacao_id: string; produto_id: string; loja_id: string; created_at?: string };
        Update: { id?: never; cotacao_id?: string; produto_id?: string; loja_id?: string };
        Relationships: [
          { foreignKeyName: 'cotacao_itens_cotacao_id_fkey'; columns: ['cotacao_id']; isOneToOne: false; referencedRelation: 'cotacoes'; referencedColumns: ['id'] },
          { foreignKeyName: 'cotacao_itens_produto_id_fkey'; columns: ['produto_id']; isOneToOne: false; referencedRelation: 'produtos'; referencedColumns: ['id'] },
          { foreignKeyName: 'cotacao_itens_loja_id_fkey'; columns: ['loja_id']; isOneToOne: false; referencedRelation: 'lojas'; referencedColumns: ['id'] },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_user_email: { Args: Record<PropertyKey, never>; Returns: string };
      current_user_is_active: { Args: Record<PropertyKey, never>; Returns: boolean };
      current_user_is_active_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
    };
    Enums: { perfil_usuario: PerfilUsuario };
    CompositeTypes: Record<string, never>;
  };
}
