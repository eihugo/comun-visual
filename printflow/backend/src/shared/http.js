import { AppError } from '../middlewares/erro.js';

export function idParam(req, nome = 'id') {
  const n = Number(req.params[nome]);
  if (!Number.isInteger(n) || n <= 0) throw new AppError(400, 'ID inválido');
  return n;
}

export const somaDias = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

// Monta "col = $3, col2 = $4" só com colunas permitidas (nunca confia nas chaves do cliente)
export function setClause(dados, permitidas, inicio = 3) {
  const chaves = Object.keys(dados).filter((k) => permitidas.includes(k));
  return {
    chaves,
    sql: chaves.map((k, i) => `${k} = $${i + inicio}`).join(', '),
    valores: chaves.map((k) => dados[k]),
  };
}
