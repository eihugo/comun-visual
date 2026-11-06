import { query } from '../config/db.js';

export async function notificar(db, { empresaId, usuarioId = null, tipo, mensagem, link = null }) {
  await (db || { query }).query(
    'INSERT INTO notificacoes (empresa_id, usuario_id, tipo, mensagem, link) VALUES ($1,$2,$3,$4,$5)',
    [empresaId, usuarioId, tipo, mensagem, link],
  );
}
