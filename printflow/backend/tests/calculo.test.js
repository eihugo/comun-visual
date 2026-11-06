import { describe, expect, it } from 'vitest';
import { calcularItem } from '../src/shared/calculo.js';

describe('cálculo de orçamento', () => {
  const produto = {
    unidade_medida: 'm2', perda_percentual: 10, custo_mao_obra: 8, custo_maquina: 4,
    custo_acabamento: 0, custo_adicional: 20, margem_percentual: 60, preco_venda_fixo: null,
  };
  const material = { custo_unitario: 12 };

  it('banner 3,00 x 1,50 x 2 = 9 m² → R$ 418,57', () => {
    const r = calcularItem({ produto, material, largura: 3, altura: 1.5, quantidade: 2, impostoPercentual: 6 });
    expect(r.area_total).toBe(9);
    expect(r.custo_material).toBe(118.8);
    expect(r.custo_producao).toBe(128);
    expect(r.custo_total).toBe(246.8);
    expect(r.preco_total).toBe(418.57);
  });

  it('produto por unidade ignora medidas', () => {
    const r = calcularItem({
      produto: { ...produto, unidade_medida: 'unidade', custo_adicional: 0, custo_mao_obra: 10, custo_maquina: 0, perda_percentual: 0, margem_percentual: 100 },
      material: null, quantidade: 3, impostoPercentual: 0,
    });
    expect(r.custo_total).toBe(30);
    expect(r.preco_total).toBe(60);
  });
});
