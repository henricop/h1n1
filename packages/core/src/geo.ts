/** UFs brasileiras com código IBGE (2 dígitos), sigla e região. Fonte: IBGE API de localidades. */
export interface BrState {
  ibge: string;
  uf: string;
  name: string;
  region: 'N' | 'NE' | 'SE' | 'S' | 'CO';
}

export const BR_STATES: readonly BrState[] = [
  { ibge: '11', uf: 'RO', name: 'Rondônia', region: 'N' },
  { ibge: '12', uf: 'AC', name: 'Acre', region: 'N' },
  { ibge: '13', uf: 'AM', name: 'Amazonas', region: 'N' },
  { ibge: '14', uf: 'RR', name: 'Roraima', region: 'N' },
  { ibge: '15', uf: 'PA', name: 'Pará', region: 'N' },
  { ibge: '16', uf: 'AP', name: 'Amapá', region: 'N' },
  { ibge: '17', uf: 'TO', name: 'Tocantins', region: 'N' },
  { ibge: '21', uf: 'MA', name: 'Maranhão', region: 'NE' },
  { ibge: '22', uf: 'PI', name: 'Piauí', region: 'NE' },
  { ibge: '23', uf: 'CE', name: 'Ceará', region: 'NE' },
  { ibge: '24', uf: 'RN', name: 'Rio Grande do Norte', region: 'NE' },
  { ibge: '25', uf: 'PB', name: 'Paraíba', region: 'NE' },
  { ibge: '26', uf: 'PE', name: 'Pernambuco', region: 'NE' },
  { ibge: '27', uf: 'AL', name: 'Alagoas', region: 'NE' },
  { ibge: '28', uf: 'SE', name: 'Sergipe', region: 'NE' },
  { ibge: '29', uf: 'BA', name: 'Bahia', region: 'NE' },
  { ibge: '31', uf: 'MG', name: 'Minas Gerais', region: 'SE' },
  { ibge: '32', uf: 'ES', name: 'Espírito Santo', region: 'SE' },
  { ibge: '33', uf: 'RJ', name: 'Rio de Janeiro', region: 'SE' },
  { ibge: '35', uf: 'SP', name: 'São Paulo', region: 'SE' },
  { ibge: '41', uf: 'PR', name: 'Paraná', region: 'S' },
  { ibge: '42', uf: 'SC', name: 'Santa Catarina', region: 'S' },
  { ibge: '43', uf: 'RS', name: 'Rio Grande do Sul', region: 'S' },
  { ibge: '50', uf: 'MS', name: 'Mato Grosso do Sul', region: 'CO' },
  { ibge: '51', uf: 'MT', name: 'Mato Grosso', region: 'CO' },
  { ibge: '52', uf: 'GO', name: 'Goiás', region: 'CO' },
  { ibge: '53', uf: 'DF', name: 'Distrito Federal', region: 'CO' },
];

export const BR_STATE_BY_UF: ReadonlyMap<string, BrState> = new Map(BR_STATES.map((s) => [s.uf, s]));
export const BR_STATE_BY_IBGE: ReadonlyMap<string, BrState> = new Map(BR_STATES.map((s) => [s.ibge, s]));

/** Código geográfico canônico: país = ISO3 (BRA), estado = 'BR-' + sigla (BR-SP). */
export function stateGeoCode(uf: string): string {
  return `BR-${uf}`;
}

export function ageGroupFromYears(years: number | null): string {
  if (years === null || !Number.isFinite(years) || years < 0) return 'NA';
  if (years < 5) return '0-4';
  if (years < 15) return '5-14';
  if (years < 30) return '15-29';
  if (years < 50) return '30-49';
  if (years < 65) return '50-64';
  return '65+';
}
