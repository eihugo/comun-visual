const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Calcula um item de orçamento.
 * m2: área = largura × altura × quantidade | metro_linear: largura × quantidade | demais: quantidade
 * custo = material × (1 + perda%) + (mão de obra + máquina + acabamento) × base + adicional
 * preço = custo × (1 + margem%) × (1 + imposto%)   (ou preço fixo × base, se o produto tiver)
 */
export function calcularItem({ produto, material, largura, altura, quantidade, impostoPercentual }) {
  const q = Number(quantidade);
  let base;
  if (produto.unidade_medida === 'm2') base = Number(largura) * Number(altura) * q;
  else if (produto.unidade_medida === 'metro_linear') base = Number(largura) * q;
  else base = q;

  const custoMaterial = material
    ? base * (1 + Number(produto.perda_percentual) / 100) * Number(material.custo_unitario)
    : 0;
  const custoProducao =
    (Number(produto.custo_mao_obra) + Number(produto.custo_maquina) + Number(produto.custo_acabamento)) * base +
    Number(produto.custo_adicional);
  const custoTotal = custoMaterial + custoProducao;

  const precoTotal =
    produto.preco_venda_fixo != null
      ? Number(produto.preco_venda_fixo) * base
      : custoTotal * (1 + Number(produto.margem_percentual) / 100) * (1 + Number(impostoPercentual) / 100);

  return {
    area_total: Math.round(base * 1000) / 1000,
    custo_material: r2(custoMaterial),
    custo_producao: r2(custoProducao),
    custo_total: r2(custoTotal),
    preco_total: r2(precoTotal),
    preco_unitario: r2(precoTotal / q),
  };
}

export const arredondar = r2;
