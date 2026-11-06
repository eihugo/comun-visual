import { query } from '../config/db.js';

// db pode ser o pool (query) ou um client de transação
export async function registrarAuditoria(
  { empresaId, usuarioId = null, entidade, entidadeId, acao, antes = null, depois = null },
  db = { query },
) {
  await db.query(
    `INSERT INTO auditoria (empresa_id, usuario_id, entidade, entidade_id, acao, dados_antes, dados_depois)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [empresaId, usuarioId, entidade, entidadeId, acao, antes, depois],
  );
}
