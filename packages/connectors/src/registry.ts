import type { Connector } from './types.js';
import { flunetConnector } from './connectors/flunet.js';
import { sivepConnector } from './connectors/sivep.js';
import { ibgeConnector } from './connectors/ibge.js';
import { worldbankConnector } from './connectors/worldbank.js';
import { ukhsaConnector } from './connectors/ukhsa.js';

export const CONNECTORS: readonly Connector[] = [flunetConnector, sivepConnector, ibgeConnector, worldbankConnector, ukhsaConnector];

export function getConnector(id: string): Connector {
  const c = CONNECTORS.find((x) => x.id === id);
  if (!c) throw new Error(`Conector desconhecido: ${id}. Disponíveis: ${CONNECTORS.map((x) => x.id).join(', ')}`);
  return c;
}
