export class AppError extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

export function naoEncontrado(req, res) {
  res.status(404).json({ erro: 'Rota não encontrada' });
}

export function tratarErros(err, req, res, next) {
  if (err instanceof AppError) return res.status(err.status).json({ erro: err.message });

  // violação de UNIQUE no Postgres
  if (err.code === '23505') {
    const c = err.constraint || '';
    const msg = c.includes('email') ? 'E-mail já cadastrado'
      : c.includes('cnpj') ? 'CNPJ já cadastrado'
      : c.includes('doc') ? 'Documento já cadastrado'
      : 'Registro já existe';
    return res.status(409).json({ erro: msg });
  }

  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
}
