import { z } from 'zod';
import type { Source } from './types.js';
import { mirrorGroupOf } from './indicators.js';

const RawSource = z.object({
  id: z.string(),
  name: z.string(),
  region: z.string(),
  agency: z.string(),
  category: z.string(),
  access: z.string(),
  h1n1_scope: z.string(),
  update_cadence: z.string(),
  priority: z.enum(['P0', 'P1', 'P2']),
  url: z.string().url(),
  notes: z.string(),
  access_type: z.enum(['api', 'open_data', 'portal']),
  country: z.string(),
  license: z.string(),
  api_tested_2026_10_20: z.boolean(),
});

export const CatalogFile = z.object({
  reference_date: z.string(),
  total: z.number(),
  sources: z.array(RawSource),
});

export const SOURCE_SLUGS: Readonly<Record<string, string>> = {
  'BR-01': 'br_sinan_srag_2009_2012',
  'BR-02': 'br_sinan_srag_2013_2018',
  'BR-03': 'br_sivep_gripe',
  'BR-04': 'br_painel_srag_scripts',
  'BR-05': 'br_pni_doses_2026',
  'BR-06': 'br_painel_vacinacao_influenza',
  'BR-07': 'br_sim',
  'BR-08': 'br_sih_sus',
  'BR-09': 'br_datasus_transferencia',
  'BR-10': 'br_cnes',
  'BR-11': 'br_ms_informes_influenza',
  'BR-12': 'br_infogripe',
  'BR-13': 'br_ibge_localidades',
  'BR-14': 'br_ibge_populacao',
  'INT-01': 'who_flunet',
  'INT-02': 'who_fluid',
  'INT-03': 'who_gho',
  'INT-04': 'who_vaccine_composition',
  'INT-05': 'who_icd_api',
  'INT-06': 'paho_respiratory_dashboard',
  'INT-07': 'ecdc_erviss',
  'INT-08': 'ecdc_atlas',
  'INT-09': 'ecdc_data_policy',
  'INT-10': 'woah_wahis',
  'INT-11': 'worldbank_population',
  'EU-01': 'ena_portal_api',
  'US-01': 'cdc_fluview_interactive',
  'US-02': 'cdc_flusurv_net',
  'US-03': 'cdc_fluview_reports',
  'US-04': 'cdc_fluvaxview',
  'US-05': 'cdc_nwss_influenza_a',
  'US-06': 'cdc_epidemic_trends_rt',
  'US-07': 'cdc_nchs_mortality',
  'US-08': 'cdc_pediatric_mortality',
  'US-09': 'cdc_novel_influenza_a',
  'US-10': 'us_vaers',
  'US-11': 'us_openfda',
  'US-12': 'ncbi_influenza_virus_db',
  'US-13': 'ncbi_virus_datasets',
  'US-14': 'ncbi_entrez_nucleotide',
  'US-15': 'ncbi_sra_bioproject',
  'US-16': 'us_clinicaltrials',
  'US-17': 'ncbi_pubmed',
  'US-18': 'usda_swine_influenza',
  'US-19': 'usda_nahln',
  'UK-01': 'ukhsa_dashboard',
  'UK-02': 'ukhsa_positivity_metric',
  'UK-03': 'ukhsa_national_reports',
  'CA-01': 'phac_fluwatch_plus',
  'CA-02': 'phac_fluwatch_historic',
  'CA-03': 'phac_respiratory_detections',
  'CA-04': 'phac_wastewater',
  'AU-01': 'au_nndss_datasets',
  'AU-02': 'au_nndss_dashboard',
  'AR-01': 'ar_boletin_epidemiologico',
  'AR-02': 'ar_snvs',
  'MX-01': 'mx_datos_abiertos_respiratorios',
  'ES-01': 'es_sivira',
  'JP-01': 'jp_jihs_idsc',
  'CN-01': 'cn_cnic_weekly',
  'KR-01': 'kr_kdca',
  'NZ-01': 'nz_phf_virology',
  'CL-01': 'cl_isp_virus_respiratorios',
  'CO-01': 'co_ins_boletin',
  'DE-01': 'de_rki_wochenberichte',
};

export function parseCatalog(json: unknown): Source[] {
  const file = CatalogFile.parse(json);
  if (file.sources.length !== file.total) {
    throw new Error(`Catálogo inconsistente: total=${file.total}, sources=${file.sources.length}`);
  }
  return file.sources.map((s) => {
    const slug = SOURCE_SLUGS[s.id];
    if (!slug) throw new Error(`Fonte sem slug: ${s.id}`);
    return {
      id: s.id,
      slug,
      name: s.name,
      agency: s.agency,
      country: s.country,
      region: s.region,
      category: s.category,
      access: s.access,
      access_type: s.access_type,
      h1n1_scope: s.h1n1_scope,
      update_cadence: s.update_cadence,
      priority: s.priority,
      url: s.url,
      notes: s.notes,
      license: s.license,
      mirror_group: mirrorGroupOf(s.id),
      api_tested_at: s.api_tested_2026_10_20 ? '2026-10-20' : null,
    };
  });
}
