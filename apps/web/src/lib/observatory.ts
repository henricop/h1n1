/** Lista fixa de indicadores do observatório (sivep_* e flunet_* com série para BRA). */
export const OBSERVATORY_INDICATORS: ReadonlyArray<{ id: string; label: string; byState: boolean }> = [
  { id: 'sivep_srag_ah1n1pdm09_confirmed', label: 'SRAG por A(H1N1)pdm09 confirmada por RT-PCR', byState: true },
  { id: 'sivep_srag_ah1n1pdm09_deaths', label: 'Óbitos entre SRAG por A(H1N1)pdm09 confirmada', byState: true },
  { id: 'sivep_srag_influenza_confirmed', label: 'SRAG por influenza (qualquer tipo/subtipo)', byState: true },
  { id: 'sivep_srag_ah3n2_confirmed', label: 'SRAG por A(H3N2) confirmada por RT-PCR', byState: true },
  { id: 'sivep_srag_inf_a_not_subtyped', label: 'SRAG por influenza A sem subtipo definido (não é H1N1)', byState: true },
  { id: 'sivep_srag_influenza_deaths', label: 'Óbitos entre SRAG por influenza', byState: true },
  { id: 'sivep_srag_influenza_icu', label: 'SRAG por influenza com UTI', byState: true },
  { id: 'sivep_srag_notifications', label: 'Notificações de SRAG hospitalizada (todos os agentes)', byState: true },
  { id: 'flunet_ah1n1pdm09_detections', label: 'Detecções de A(H1N1)pdm09 (FluNet, Brasil)', byState: false },
  { id: 'flunet_inf_a_detections', label: 'Detecções de influenza A (FluNet, Brasil)', byState: false },
  { id: 'flunet_inf_a_not_subtyped', label: 'Influenza A não subtipada (FluNet, Brasil; não é H1N1)', byState: false },
  { id: 'flunet_inf_b_detections', label: 'Detecções de influenza B (FluNet, Brasil)', byState: false },
  { id: 'flunet_specimens_processed', label: 'Amostras processadas (FluNet, Brasil)', byState: false },
  { id: 'flunet_ah1n1pdm09_share_of_inf_a', label: 'Participação de A(H1N1)pdm09 entre influenza A (FluNet)', byState: false },
  { id: 'flunet_influenza_positivity', label: 'Positividade para influenza (FluNet, Brasil)', byState: false },
];

