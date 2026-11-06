export const validar = (schema) => (req, res, next) => {
  const r = schema.safeParse(req.body);
  if (!r.success) {
    return res.status(400).json({
      erro: 'Dados inválidos',
      detalhes: r.error.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
    });
  }
  req.body = r.data;
  next();
};
