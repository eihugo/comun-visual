// Próximo número por empresa. Chamar DENTRO de uma transação (db = client).
export async function proximoNumero(db, empresaId, tipo) {
  const { rows } = await db.query(
    `UPDATE sequencias SET ultimo_numero = ultimo_numero + 1
      WHERE empresa_id = $1 AND tipo = $2 RETURNING ultimo_numero`,
    [empresaId, tipo],
  );
  return rows[0].ultimo_numero;
}
