-- =====================================================
-- PRINTFLOW - Schema do MVP (PostgreSQL)
-- Regra de ouro: TODA tabela de negócio tem empresa_id
-- e TODA query no backend filtra por ele (multi-tenant)
-- =====================================================

-- ---------- EMPRESAS E USUÁRIOS ----------

CREATE TABLE empresas (
    id                   BIGSERIAL PRIMARY KEY,
    nome                 VARCHAR(150) NOT NULL,
    cnpj                 VARCHAR(18) UNIQUE,
    email                VARCHAR(150),
    telefone             VARCHAR(20),
    logo_url             TEXT,
    endereco             TEXT,
    imposto_percentual   NUMERIC(5,2) NOT NULL DEFAULT 0,   -- impostos/taxas configuráveis
    validade_proposta_dias INT NOT NULL DEFAULT 15,
    ativo                BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usuarios (
    id                    BIGSERIAL PRIMARY KEY,
    empresa_id            BIGINT NOT NULL REFERENCES empresas(id),
    nome                  VARCHAR(150) NOT NULL,
    email                 VARCHAR(150) NOT NULL UNIQUE,
    senha_hash            TEXT NOT NULL,
    perfil                VARCHAR(20) NOT NULL
        CHECK (perfil IN ('admin','gerente','vendedor','designer','producao','financeiro')),
    limite_desconto_percentual NUMERIC(5,2) NOT NULL DEFAULT 0,  -- RN09
    token_versao          INT NOT NULL DEFAULT 1,                -- invalidação de sessão na troca de senha
    ativo                 BOOLEAN NOT NULL DEFAULT TRUE,         -- bloquear/reativar
    ultimo_login          TIMESTAMPTZ,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_usuarios_empresa ON usuarios(empresa_id);

-- Contadores para numeração automática por empresa (orçamento, O.S.)
CREATE TABLE sequencias (
    empresa_id     BIGINT NOT NULL REFERENCES empresas(id),
    tipo           VARCHAR(20) NOT NULL CHECK (tipo IN ('orcamento','os')),
    ultimo_numero  INT NOT NULL DEFAULT 0,
    PRIMARY KEY (empresa_id, tipo)
);

-- ---------- CLIENTES ----------

CREATE TABLE clientes (
    id            BIGSERIAL PRIMARY KEY,
    empresa_id    BIGINT NOT NULL REFERENCES empresas(id),
    tipo          CHAR(2) NOT NULL CHECK (tipo IN ('PF','PJ')),
    nome          VARCHAR(150) NOT NULL,
    documento     VARCHAR(18),                -- CPF ou CNPJ
    telefone      VARCHAR(20),
    email         VARCHAR(150),
    endereco      TEXT,
    observacoes   TEXT,
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,
    deletado_em   TIMESTAMPTZ,                -- exclusão lógica
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_clientes_empresa ON clientes(empresa_id);
CREATE INDEX idx_clientes_busca   ON clientes(empresa_id, nome);
CREATE UNIQUE INDEX uq_clientes_doc ON clientes(empresa_id, documento)
    WHERE documento IS NOT NULL AND deletado_em IS NULL;

CREATE TABLE cliente_historico (
    id          BIGSERIAL PRIMARY KEY,
    empresa_id  BIGINT NOT NULL REFERENCES empresas(id),
    cliente_id  BIGINT NOT NULL REFERENCES clientes(id),
    usuario_id  BIGINT REFERENCES usuarios(id),
    descricao   TEXT NOT NULL,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cli_hist ON cliente_historico(cliente_id);

-- ---------- MATERIAIS E PRODUTOS ----------

CREATE TABLE materiais (
    id              BIGSERIAL PRIMARY KEY,
    empresa_id      BIGINT NOT NULL REFERENCES empresas(id),
    nome            VARCHAR(150) NOT NULL,
    unidade         VARCHAR(10) NOT NULL,                 -- m2, m, un, kg, l
    custo_unitario  NUMERIC(12,4) NOT NULL DEFAULT 0,     -- custo por unidade (ex: R$/m²)
    estoque_minimo  NUMERIC(12,3) NOT NULL DEFAULT 0,
    estoque_atual   NUMERIC(12,3) NOT NULL DEFAULT 0,     -- cache; fonte da verdade = movimentacoes_estoque
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_materiais_empresa ON materiais(empresa_id);

CREATE TABLE produtos (
    id                  BIGSERIAL PRIMARY KEY,
    empresa_id          BIGINT NOT NULL REFERENCES empresas(id),
    nome                VARCHAR(150) NOT NULL,
    categoria           VARCHAR(80),
    descricao           TEXT,
    unidade_medida      VARCHAR(15) NOT NULL
        CHECK (unidade_medida IN ('m2','metro_linear','unidade','hora_maquina','personalizado')),
    material_id         BIGINT REFERENCES materiais(id),
    -- parâmetros do cálculo (RF05)
    perda_percentual    NUMERIC(5,2) NOT NULL DEFAULT 0,
    custo_mao_obra      NUMERIC(12,2) NOT NULL DEFAULT 0,   -- por unidade de medida
    custo_maquina       NUMERIC(12,2) NOT NULL DEFAULT 0,   -- por unidade de medida
    custo_acabamento    NUMERIC(12,2) NOT NULL DEFAULT 0,
    custo_adicional     NUMERIC(12,2) NOT NULL DEFAULT 0,
    margem_percentual   NUMERIC(5,2) NOT NULL DEFAULT 0,
    preco_venda_fixo    NUMERIC(12,2),                      -- opcional: sobrepõe o cálculo
    tempo_producao_min  INT,
    ativo               BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_produtos_empresa ON produtos(empresa_id);

-- ---------- ORÇAMENTOS ----------

CREATE TABLE orcamentos (
    id                   BIGSERIAL PRIMARY KEY,
    empresa_id           BIGINT NOT NULL REFERENCES empresas(id),
    numero               INT NOT NULL,                      -- sequencial por empresa
    versao               INT NOT NULL DEFAULT 1,            -- RN04: alteração = nova versão
    cliente_id           BIGINT NOT NULL REFERENCES clientes(id),   -- RN02
    vendedor_id          BIGINT NOT NULL REFERENCES usuarios(id),
    status               VARCHAR(25) NOT NULL DEFAULT 'rascunho'
        CHECK (status IN ('rascunho','enviado','aprovado','recusado',
                          'alteracao_solicitada','substituido','expirado')),
    prazo_dias           INT,
    desconto_percentual  NUMERIC(5,2) NOT NULL DEFAULT 0,
    desconto_autorizado_por BIGINT REFERENCES usuarios(id), -- RN09
    subtotal             NUMERIC(12,2) NOT NULL DEFAULT 0,
    total                NUMERIC(12,2) NOT NULL DEFAULT 0,
    observacoes          TEXT,
    token_publico        VARCHAR(64) NOT NULL UNIQUE,       -- link seguro do cliente (aleatório)
    valido_ate           DATE,
    criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (empresa_id, numero, versao)
);
CREATE INDEX idx_orc_empresa_status ON orcamentos(empresa_id, status);
CREATE INDEX idx_orc_cliente        ON orcamentos(cliente_id);

CREATE TABLE orcamento_itens (
    id               BIGSERIAL PRIMARY KEY,
    empresa_id       BIGINT NOT NULL REFERENCES empresas(id),
    orcamento_id     BIGINT NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
    produto_id       BIGINT NOT NULL REFERENCES produtos(id),
    material_id      BIGINT REFERENCES materiais(id),
    descricao        TEXT,
    largura          NUMERIC(10,3),                         -- metros
    altura           NUMERIC(10,3),
    quantidade       NUMERIC(10,3) NOT NULL DEFAULT 1,
    area_total       NUMERIC(12,3),                         -- largura x altura x quantidade
    acabamento       VARCHAR(100),
    -- snapshot do cálculo (não muda se o produto mudar depois)
    custo_material   NUMERIC(12,2) NOT NULL DEFAULT 0,
    custo_producao   NUMERIC(12,2) NOT NULL DEFAULT 0,
    custo_total      NUMERIC(12,2) NOT NULL DEFAULT 0,
    preco_unitario   NUMERIC(12,2) NOT NULL DEFAULT 0,
    preco_total      NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_orc_itens ON orcamento_itens(orcamento_id);

CREATE TABLE orcamento_aprovacoes (
    id            BIGSERIAL PRIMARY KEY,
    empresa_id    BIGINT NOT NULL REFERENCES empresas(id),
    orcamento_id  BIGINT NOT NULL REFERENCES orcamentos(id),
    decisao       VARCHAR(25) NOT NULL
        CHECK (decisao IN ('aprovado','recusado','alteracao_solicitada')),
    comentario    TEXT,
    ip            VARCHAR(45),
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()      -- data/hora da aprovação
);
CREATE INDEX idx_orc_aprov ON orcamento_aprovacoes(orcamento_id);

-- ---------- PRODUÇÃO / ORDENS DE SERVIÇO ----------

-- Etapas configuráveis por empresa (RF07: fluxo configurável)
CREATE TABLE etapas_producao (
    id          BIGSERIAL PRIMARY KEY,
    empresa_id  BIGINT NOT NULL REFERENCES empresas(id),
    nome        VARCHAR(80) NOT NULL,                      -- 'Em Criação', 'Em Impressão'...
    ordem       INT NOT NULL,
    final       BOOLEAN NOT NULL DEFAULT FALSE,            -- marca 'Concluído'
    ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (empresa_id, ordem)
);

CREATE TABLE ordens_servico (
    id                    BIGSERIAL PRIMARY KEY,
    empresa_id            BIGINT NOT NULL REFERENCES empresas(id),
    numero                INT NOT NULL,
    orcamento_id          BIGINT NOT NULL UNIQUE REFERENCES orcamentos(id),  -- 1 orçamento aprovado -> 1 O.S.
    cliente_id            BIGINT NOT NULL REFERENCES clientes(id),
    responsavel_id        BIGINT REFERENCES usuarios(id),                    -- RN05
    etapa_id              BIGINT REFERENCES etapas_producao(id),
    situacao              VARCHAR(15) NOT NULL DEFAULT 'ativa'
        CHECK (situacao IN ('ativa','pausada','retrabalho','cancelada','concluida')),
    prioridade            VARCHAR(10) NOT NULL DEFAULT 'normal'
        CHECK (prioridade IN ('baixa','normal','alta','urgente')),
    prazo_entrega         DATE,
    motivo_cancelamento   TEXT,                                              -- RN11
    observacoes           TEXT,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    concluido_em          TIMESTAMPTZ,
    UNIQUE (empresa_id, numero)
);
CREATE INDEX idx_os_empresa_situacao ON ordens_servico(empresa_id, situacao);
CREATE INDEX idx_os_prazo            ON ordens_servico(empresa_id, prazo_entrega);

CREATE TABLE os_historico (
    id                BIGSERIAL PRIMARY KEY,
    empresa_id        BIGINT NOT NULL REFERENCES empresas(id),
    os_id             BIGINT NOT NULL REFERENCES ordens_servico(id),
    usuario_id        BIGINT REFERENCES usuarios(id),
    etapa_anterior_id BIGINT REFERENCES etapas_producao(id),
    etapa_nova_id     BIGINT REFERENCES etapas_producao(id),
    observacao        TEXT,                                  -- ocorrências, retrabalho
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_os_hist ON os_historico(os_id);

-- ---------- ESTOQUE ----------

CREATE TABLE movimentacoes_estoque (
    id             BIGSERIAL PRIMARY KEY,
    empresa_id     BIGINT NOT NULL REFERENCES empresas(id),
    material_id    BIGINT NOT NULL REFERENCES materiais(id),
    tipo           VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada','saida','ajuste')),
    quantidade     NUMERIC(12,3) NOT NULL CHECK (quantidade > 0),
    custo_unitario NUMERIC(12,4),
    os_id          BIGINT REFERENCES ordens_servico(id),     -- consumo vinculado à O.S.
    usuario_id     BIGINT REFERENCES usuarios(id),
    observacao     TEXT,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_mov_material ON movimentacoes_estoque(material_id, criado_em);
CREATE INDEX idx_mov_os       ON movimentacoes_estoque(os_id);

-- ---------- ARQUIVOS ----------

CREATE TABLE arquivos (
    id              BIGSERIAL PRIMARY KEY,
    empresa_id      BIGINT NOT NULL REFERENCES empresas(id),
    cliente_id      BIGINT REFERENCES clientes(id),
    orcamento_id    BIGINT REFERENCES orcamentos(id),
    os_id           BIGINT REFERENCES ordens_servico(id),
    nome_original   VARCHAR(255) NOT NULL,
    url             TEXT NOT NULL,                           -- caminho no storage
    mime_type       VARCHAR(100),
    tamanho_bytes   BIGINT,
    versao          INT NOT NULL DEFAULT 1,
    enviado_por     BIGINT REFERENCES usuarios(id),
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_arquivos_os  ON arquivos(os_id);
CREATE INDEX idx_arquivos_orc ON arquivos(orcamento_id);

-- ---------- NOTIFICAÇÕES E AUDITORIA ----------

CREATE TABLE notificacoes (
    id          BIGSERIAL PRIMARY KEY,
    empresa_id  BIGINT NOT NULL REFERENCES empresas(id),
    usuario_id  BIGINT REFERENCES usuarios(id),              -- NULL = para a empresa toda
    tipo        VARCHAR(40) NOT NULL,                        -- 'estoque_baixo', 'orcamento_aprovado'...
    mensagem    TEXT NOT NULL,
    link        TEXT,
    lida        BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notif_usuario ON notificacoes(usuario_id, lida);

CREATE TABLE auditoria (
    id             BIGSERIAL PRIMARY KEY,
    empresa_id     BIGINT NOT NULL REFERENCES empresas(id),
    usuario_id     BIGINT REFERENCES usuarios(id),
    entidade       VARCHAR(50) NOT NULL,                     -- 'orcamentos', 'ordens_servico'...
    entidade_id    BIGINT NOT NULL,
    acao           VARCHAR(30) NOT NULL,                     -- 'criou','editou','aprovou','cancelou'
    dados_antes    JSONB,
    dados_depois   JSONB,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_entidade ON auditoria(empresa_id, entidade, entidade_id);
