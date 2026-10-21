-- Leitura de matrizes (globo, mapa, séries): a consulta filtra por indicador + snapshot vigente + nível + estrato,
-- restringe geo_code a uma lista e período a um intervalo, e ordena por (geo_code, period). O índice antigo
-- (observations_lookup_idx) não contém snapshot_id: com várias snapshots do mesmo indicador a leitura descia
-- a cada país e descartava ~2/3 das entradas no heap (Rows Removed by Filter). Este índice cobre o predicado
-- inteiro na ordem exigida e inclui as colunas lidas (value, update_status) para permitir index-only scan.
create index if not exists observations_matrix_idx
  on observations (indicator_id, snapshot_id, geo_level, stratum_key, geo_code, period)
  include (value, update_status);
