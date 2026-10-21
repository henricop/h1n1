# Pesquisa · proporções do vírion influenza A (base da geometria do explicador 3D)

Levantamento de 2026-10-21 (sub-agente de pesquisa; fontes abertas; citações literais). Fontes: Harris et al. 2006,
PNAS, crio-ET (PMC1748186) · Noda et al. 2012, Nat. Commun. (PMC3272569) · Noda & Kawaoka 2010, Rev. Med. Virol.
(PMC6029254) · Krammer et al. 2018 (PMC7097467) · PDB-101 motm/76 (HA) e motm/113 (NA). Não confirmados: número de
canais M2 por vírion; Noda 2006 Nature (sem versão aberta); o termo "cogumelo" para a NA (fontes dizem "square"/"box").

## Ficha de proporções

| Item | Dado | Citação |
|---|---|---|
| Diâmetro | esféricos 84–170 nm (média 120); alongados ≈100 nm de largura; faixa usual 80–120 nm | "The outer diameters of the spherical virions ranged from 84 to 170 nm (mean, 120 nm)." (Harris) / "ranging from 80 to 120 nm in diameter" (Noda 2012) |
| Pleomorfismo | 78/110 esféricos; 17 ovais/rim; 15 alongados (razão axial até 7,7) | "The majority of virions (n = 78) may be described as spherical (axial ratio <1.2), the remainder are oval or kidney-shaped…" (Harris) |
| Espinhos | ≈375 por vírion de 120 nm; 301 HA + 50 NA e 290 HA + 38 NA (≈6–8 HA por NA) | "yielding 351 (301 HA plus 50 NA) and 328 (290 HA plus 38 NA) spikes per virion." (Harris) |
| NA em ilhas | NA isolada entre HA ou em pequenos grupos | "congregations of the more abundant HA spikes are the pattern most frequently observed; then single NA spikes surrounded by HA, and local clusters of NA" (Harris) |
| Empacotamento | denso, irregular, ≈11 nm centro a centro; manchas vazias em ≈40% dos esféricos | "packed closely but irregularly, with an average center-to-center spacing of ≈11 nm" (Harris) |
| HA | trímero, seção triangular; topo a ≈14 nm da membrana, haste ≈2 nm; cabeça + haste | "its outer tip is ≈14 nm from the membrane surface (i.e., there is a 2-nm stem)" (Harris) |
| NA | tetrâmero quadrado ("caixa"), cabeça ≈6 nm sobre haste fina (≈3 nm) de ≈10 nm → topo a ≈16 nm (mais alta que HA) | "for NA spikes, this spacing is ≈16 nm (i.e., a 10-nm stem)"; "A 3-nm-wide stalk was added to the NA map." (Harris); "four identical subunits arranged in a square … attached to the virus surface through a long protein stalk" (PDB-101) |
| Envelope + M1 | bicamada ≈4 nm; monocamada de M1 logo abaixo, espessura semelhante, 5,5 nm centro a centro; lacunas em ≈20% | "We interpret the outer layer as the lipid bilayer … and the inner layer as a monolayer of matrix protein." (Harris) |
| RNPs | 8 bastonetes, ≈12–14 nm de espessura, 30–110 nm; 3 longos parecidos + 5 mais curtos; curvos; dupla hélice | "The rod-like RNPs vary in length from 30 to 110 nm, which correlates with the length of each vRNA segment" (Noda 2012) |
| Arranjo 7+1 | 7 periféricos ao redor de 1 central (sempre longo) | "with seven RNPs surrounding a central one in each budding virion" (Noda 2012) |
| Polimerase | alça numa ponta; na outra, duplex dos terminais com a polimerase | "with a loop at one end, whereas the other end has a duplex … to which the viral polymerase is bound" (Harris) |

## Consequências para o modelo 3D (escala da cena: raio do envelope = 1 ≈ 55 nm)

- HA: haste curta (≈0,04) + cabeça trimérica alongada; altura total ≈0,25–0,27. NA: haste fina longa (≈0,18) + cabeça
  quadrada achatada (≈0,1); topo ≈0,29 (acima da HA). Razão ≈7 HA : 1 NA; NA em ilhas de 2–4 + algumas isoladas.
- Densidade alta e irregular (jitter nas direções); ≈2–3 manchas sem espinhos.
- Envelope levemente irregular (ruído de baixa frequência, ±3–5%); duas camadas visíveis (bicamada translúcida +
  M1 fosca logo abaixo, com lacunas).
- RNPs: 8 bastonetes helicoidais (NP em contas) de comprimentos distintos, levemente curvos, 7 ao redor de 1
  central longo, alça numa ponta e polimerase (nódulo) na outra.
- M2: poucos (≈6–8) canais pequenos e discretos.

## Erros de "vírus de desenho" a evitar
1. Espinhos iguais e igualmente espaçados. 2. Esfera perfeita de tamanho fixo. 3. RNA como fio solto/novelo.
4. Envelope como casca única. 5. HA e NA da mesma altura; M2 abundante.

## Fatos candidatos (schema de facts.json)

```json
[
{"id":"harris-2006-diametro-esferico-120nm","claim":"Por crio-tomografia, os vírions esféricos de influenza A mediram de 84 a 170 nm de diâmetro externo (média 120 nm).","source_title":"Harris A. et al. — Influenza virus pleiomorphy characterized by cryoelectron tomography. PNAS, 103(50) (2006); texto integral no PubMed Central (NIH/NLM)","source_url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC1748186/","quote":"The outer diameters of the spherical virions ranged from 84 to 170 nm (mean, 120 nm).","verified_by":"Redação H1N1 (apoio de IA); pendente de revisão","verified_at":"2026-10-21"},
{"id":"noda-2012-diametro-80-120nm-filamentoso","claim":"O vírus influenza A é envelopado, de forma elíptica ou filamentosa, com 80 a 120 nm de diâmetro.","source_title":"Noda T. et al. — Three-dimensional analysis of ribonucleoprotein complexes in influenza A virus. Nature Communications, 3:639 (2012); texto integral no PubMed Central (NIH/NLM)","source_url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC3272569/","quote":"Influenza A viruses are enveloped, with an elliptical or filamentous shape, ranging from 80 to 120 nm in diameter","verified_by":"Redação H1N1 (apoio de IA); pendente de revisão","verified_at":"2026-10-21"},
{"id":"harris-2006-contagem-ha-na","claim":"Um vírion típico tem cerca de 300 espinhos de HA para apenas 40 a 50 de NA: a HA é muitas vezes mais numerosa.","source_title":"Harris A. et al. — Influenza virus pleiomorphy characterized by cryoelectron tomography. PNAS, 103(50) (2006); texto integral no PubMed Central (NIH/NLM)","source_url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC1748186/","quote":"yielding 351 (301 HA plus 50 NA) and 328 (290 HA plus 38 NA) spikes per virion.","verified_by":"Redação H1N1 (apoio de IA); pendente de revisão","verified_at":"2026-10-21"},
{"id":"harris-2006-na-em-grupos","claim":"A NA não se espalha ao acaso: aparece isolada entre HAs ou em pequenos grupos locais.","source_title":"Harris A. et al. — Influenza virus pleiomorphy characterized by cryoelectron tomography. PNAS, 103(50) (2006); texto integral no PubMed Central (NIH/NLM)","source_url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC1748186/","quote":"congregations of the more abundant HA spikes are the pattern most frequently observed; then single NA spikes surrounded by HA, and local clusters of NA","verified_by":"Redação H1N1 (apoio de IA); pendente de revisão","verified_at":"2026-10-21"},
{"id":"harris-2006-ha-trimero-na-tetramero","claim":"A HA é um trímero (seção triangular) e a NA um tetrâmero (seção quadrada), distinguíveis nos tomogramas.","source_title":"Harris A. et al. — Influenza virus pleiomorphy characterized by cryoelectron tomography. PNAS, 103(50) (2006); texto integral no PubMed Central (NIH/NLM)","source_url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC1748186/","quote":"triangular HA spikes (e.g., white arrowhead in a) are distinguishable from square NA spikes","verified_by":"Redação H1N1 (apoio de IA); pendente de revisão","verified_at":"2026-10-21"},
{"id":"harris-2006-altura-ha-na-haste","claim":"A HA chega a cerca de 14 nm da membrana, com haste de cerca de 2 nm; a NA chega a cerca de 16 nm, apoiada numa haste de cerca de 10 nm.","source_title":"Harris A. et al. — Influenza virus pleiomorphy characterized by cryoelectron tomography. PNAS, 103(50) (2006); texto integral no PubMed Central (NIH/NLM)","source_url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC1748186/","quote":"its outer tip is ≈14 nm from the membrane surface (i.e., there is a 2-nm stem), whereas for NA spikes, this spacing is ≈16 nm (i.e., a 10-nm stem).","verified_by":"Redação H1N1 (apoio de IA); pendente de revisão","verified_at":"2026-10-21"},
{"id":"pdb101-na-tetramero-haste-longa","claim":"A neuraminidase é formada por quatro subunidades idênticas dispostas em quadrado e se prende ao vírus por uma haste proteica longa.","source_title":"Goodsell D. S. — Molecule of the Month: Influenza Neuraminidase. RCSB PDB-101 (2009)","source_url":"https://pdb101.rcsb.org/motm/113","quote":"is composed of four identical subunits arranged in a square. It is normally attached to the virus surface through a long protein stalk (not shown).","verified_by":"Redação H1N1 (apoio de IA); pendente de revisão","verified_at":"2026-10-21"},
{"id":"harris-2006-camada-m1-sob-envelope","claim":"Sob a bicamada lipídica há uma monocamada de proteína da matriz (M1), de espessura semelhante à da membrana.","source_title":"Harris A. et al. — Influenza virus pleiomorphy characterized by cryoelectron tomography. PNAS, 103(50) (2006); texto integral no PubMed Central (NIH/NLM)","source_url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC1748186/","quote":"We interpret the outer layer as the lipid bilayer in which the transmembrane segments of the glycoproteins are implanted and the inner layer as a monolayer of matrix protein.","verified_by":"Redação H1N1 (apoio de IA); pendente de revisão","verified_at":"2026-10-21"},
{"id":"noda-2012-rnp-bastonetes-comprimentos","claim":"Cada vírion carrega oito RNPs em forma de bastonete, de comprimentos diferentes (30 a 110 nm), proporcionais ao segmento de RNA.","source_title":"Noda T. et al. — Three-dimensional analysis of ribonucleoprotein complexes in influenza A virus. Nature Communications, 3:639 (2012); texto integral no PubMed Central (NIH/NLM)","source_url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC3272569/","quote":"The rod-like RNPs vary in length from 30 to 110 nm, which correlates with the length of each vRNA segment","verified_by":"Redação H1N1 (apoio de IA); pendente de revisão","verified_at":"2026-10-21"},
{"id":"noda-2012-arranjo-7-mais-1","claim":"Dentro do vírion, sete RNPs cercam um RNP central: o arranjo 7+1.","source_title":"Noda T. et al. — Three-dimensional analysis of ribonucleoprotein complexes in influenza A virus. Nature Communications, 3:639 (2012); texto integral no PubMed Central (NIH/NLM)","source_url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC3272569/","quote":"eight RNPs of different lengths are arranged in a specific pattern, with seven RNPs surrounding a central one in each budding virion","verified_by":"Redação H1N1 (apoio de IA); pendente de revisão","verified_at":"2026-10-21"},
{"id":"harris-2006-polimerase-na-ponta-da-rnp","claim":"Cada RNP tem uma alça numa ponta e, na outra, as extremidades pareadas do RNA, onde a polimerase viral fica presa.","source_title":"Harris A. et al. — Influenza virus pleiomorphy characterized by cryoelectron tomography. PNAS, 103(50) (2006); texto integral no PubMed Central (NIH/NLM)","source_url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC1748186/","quote":"with a loop at one end, whereas the other end has a duplex formed by base pairing of the termini to which the viral polymerase is bound","verified_by":"Redação H1N1 (apoio de IA); pendente de revisão","verified_at":"2026-10-21"}
]
```
