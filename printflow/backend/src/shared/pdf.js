import PDFDocument from 'pdfkit';

const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num4 = (n) => String(n).padStart(4, '0');

// Gera a proposta em PDF direto na resposta HTTP. NUNCA inclui custos nem margem.
export function gerarPropostaPdf(res, { empresa, orcamento, itens }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="proposta-${num4(orcamento.numero)}-v${orcamento.versao}.pdf"`);
  doc.pipe(res);

  doc.fillColor('#C62828').fontSize(22).text(empresa.nome);
  doc.fillColor('#555').fontSize(10);
  [empresa.telefone, empresa.email, empresa.endereco].filter(Boolean).forEach((l) => doc.text(l));

  doc.moveDown(1.5).fillColor('#000').fontSize(16)
    .text(`Proposta #${num4(orcamento.numero)} (versão ${orcamento.versao})`);
  doc.fontSize(11).fillColor('#333')
    .text(`Cliente: ${orcamento.cliente_nome}`)
    .text(`Data: ${new Date(orcamento.criado_em).toLocaleDateString('pt-BR')}`);
  if (orcamento.valido_ate) doc.text(`Válida até: ${new Date(orcamento.valido_ate).toLocaleDateString('pt-BR')}`);
  if (orcamento.prazo_dias) doc.text(`Prazo estimado: ${orcamento.prazo_dias} dias`);

  doc.moveDown(1);
  const x = [50, 270, 350, 450];
  let y = doc.y;
  doc.fontSize(10).fillColor('#C62828');
  ['Item', 'Medidas', 'Qtd', 'Total'].forEach((t, i) => doc.text(t, x[i], y, { width: i === 0 ? 210 : 90 }));
  doc.moveTo(50, y + 14).lineTo(545, y + 14).strokeColor('#ccc').stroke();
  y += 22;
  doc.fillColor('#000');
  for (const it of itens) {
    const medidas = it.largura && it.altura ? `${it.largura} × ${it.altura} m` : '—';
    doc.text(it.descricao || it.produto_nome, x[0], y, { width: 210 });
    const alturaLinha = doc.y - y;
    doc.text(medidas, x[1], y, { width: 80 });
    doc.text(String(Number(it.quantidade)), x[2], y, { width: 90 });
    doc.text(brl(it.preco_total), x[3], y, { width: 95 });
    y += Math.max(alturaLinha, 16) + 6;
    if (y > 740) { doc.addPage(); y = 50; }
  }

  doc.moveTo(50, y).lineTo(545, y).strokeColor('#ccc').stroke();
  y += 10;
  doc.fontSize(10).fillColor('#333');
  if (Number(orcamento.desconto_percentual) > 0) {
    doc.text(`Subtotal: ${brl(orcamento.subtotal)}   Desconto: ${Number(orcamento.desconto_percentual)}%`, 50, y, { width: 495, align: 'right' });
    y += 18;
  }
  doc.fontSize(14).fillColor('#C62828').text(`Total: ${brl(orcamento.total)}`, 50, y, { width: 495, align: 'right' });
  if (orcamento.observacoes) doc.moveDown(2).fontSize(10).fillColor('#333').text(`Observações: ${orcamento.observacoes}`, 50);
  doc.end();
}
