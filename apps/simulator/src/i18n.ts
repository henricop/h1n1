/** Brazilian Portuguese is the default. English is an explicit, shareable choice. */
export type AppLocale = 'en' | 'pt';

export const LOCALE_STORAGE_KEY = 'h1n1.lang';

export function normalizeLocale(value: string | null | undefined): AppLocale | null {
  if (!value) return null;
  const token = value.trim().toLowerCase();
  if (token === 'en' || token.startsWith('en-')) return 'en';
  if (token === 'pt' || token.startsWith('pt-')) return 'pt';
  return null;
}

/**
 * A shared `?lang=` link wins, then a saved choice, then the browser language
 * on a first visit. Every other case stays in Brazilian Portuguese.
 */
export function resolveLocale(input: { languages?: readonly string[]; query?: string | null; stored?: string | null } = {}): AppLocale {
  const fromQuery = normalizeLocale(input.query);
  if (fromQuery) return fromQuery;
  const fromStore = normalizeLocale(input.stored);
  if (fromStore) return fromStore;
  const primary = input.languages?.[0]?.toLowerCase() ?? '';
  if (primary.startsWith('en')) return 'en';
  if (primary.startsWith('pt')) return 'pt';
  return 'pt';
}

function readQuery(): string | null {
  if (typeof location === 'undefined') return null;
  try { return new URLSearchParams(location.search).get('lang'); } catch { return null; }
}

function readStored(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try { return localStorage.getItem(LOCALE_STORAGE_KEY); } catch { return null; }
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  if (navigator.languages?.length) return navigator.languages;
  return navigator.language ? [navigator.language] : [];
}

export const locale: AppLocale = resolveLocale({ languages: browserLanguages(), query: readQuery(), stored: readStored() });
export const localeTag = locale === 'pt' ? 'pt-BR' : 'en-US';
export const htmlLang = locale === 'pt' ? 'pt-BR' : 'en';

/** Chrome copy. Both languages are required, so a missing translation is a type error. */
const chrome = {
  language: { pt: 'Idioma', en: 'Language' },
  portuguese: { pt: 'Português (Brasil)', en: 'Portuguese (Brazil)' },
  english: { pt: 'Inglês', en: 'English' },
  documentTitle: { pt: 'H1N1 · Jornada da Infecção', en: 'H1N1 · Infection Journey' },
  documentDescription: {
    pt: 'Explore a jornada de uma infecção simulada, do corpo humano à célula, em um atlas 3D interativo.',
    en: 'Explore a simulated infection from the human body to a cell in an interactive 3D anatomy atlas.',
  },
} as const satisfies Record<string, { readonly pt: string; readonly en: string }>;

export type ChromeKey = keyof typeof chrome;
export function t(key: ChromeKey, language: AppLocale = locale): string {
  return chrome[key][language];
}

export function localeHref(next: AppLocale, href: string): string {
  const url = new URL(href, 'http://localhost');
  url.searchParams.set('lang', next);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function persistLocale(next: AppLocale = locale): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(LOCALE_STORAGE_KEY, next); } catch { /* private browsing */ }
}

/** Saves the choice and reloads so module-level copy picks up the new language. */
export function selectLocale(next: AppLocale): void {
  if (typeof location === 'undefined') return;
  persistLocale(next);
  const nextHref = localeHref(next, location.href);
  if (next === locale && normalizeLocale(readQuery()) === next) return;
  location.assign(nextHref);
}

export const formatNumber = (value: number, maximumFractionDigits = 0) => new Intl.NumberFormat(localeTag, { maximumFractionDigits, minimumFractionDigits: maximumFractionDigits }).format(value);
export const localized = (english: string, portuguese: string) => locale === 'pt' ? portuguese : english;

/** The existing Portuguese copy remains the source for the Portuguese edition. */
const EN: Record<string, string> = {
  // Anatomy and scales
  'Corpo': 'Body', 'Respiratório': 'Respiratory', 'Pulmão': 'Lung', 'Tecido': 'Tissue', 'Célula': 'Cell',
  'Mucosa nasal e nasofaringe': 'Nasal mucosa and nasopharynx', 'Mucosa nasal': 'Nasal mucosa', 'Traqueia': 'Trachea', 'Brônquios': 'Bronchi', 'Bronquíolos': 'Bronchioles', 'Região alveolar': 'Alveolar region', 'Alvéolos': 'Alveoli',
  'O organismo inteiro': 'The whole body', 'As vias de entrada': 'The entry airways', 'Brônquios e alvéolos': 'Bronchi and alveoli', 'A superfície respiratória': 'The respiratory surface', 'Por dentro da infecção': 'Inside the infection',
  'A superfície respiratória que recebe o primeiro contato neste modelo.': 'The respiratory surface where contact first occurs in this model.',
  'Uma via revestida por tecido epitelial, conectando a entrada aos brônquios.': 'An epithelial lined airway connecting the entry point to the bronchi.',
  'Ramificações que distribuem a atividade entre as regiões respiratórias.': 'Branches that carry activity between respiratory regions.',
  'Ramos finos que levam às regiões alveolares representativas.': 'Fine branches leading to representative alveolar regions.',
  'Unidades pulmonares ilustrativas; o envolvimento depende da trajetória calculada.': 'Illustrative lung units; involvement follows the calculated trajectory.',
  'Navegação anatômica': 'Anatomical navigation', 'Um corpo, cinco escalas': 'One body, five scales', 'Escalas de exploração': 'Exploration scales', 'Região em foco': 'Focused region',
  'Explore por aproximação ou escolha uma escala. A região e o instante acompanham você.': 'Zoom in or choose a scale. Your region and moment stay with you.',
  // Patient monitor and regional guide
  'Estado da pessoa simulada': 'Simulated person status', 'PESSOA SIMULADA': 'SIMULATED PERSON', 'CENÁRIO': 'SCENARIO', 'SINTOMAS NESTA ILUSTRAÇÃO': 'SYMPTOMS IN THIS ILLUSTRATION',
  'Sintomas ilustrativos possíveis': 'Possible illustrative symptoms', 'Hipóteses narrativas, não sintomas calculados ou previstos.': 'Narrative possibilities, not calculated or predicted symptoms.',
  'Índices do modelo': 'Model indices', 'Atividade viral': 'Viral activity', 'Tecido íntegro': 'Intact tissue', 'RITMO VIRAL DO CENÁRIO': 'SCENARIO VIRAL PACE',
  'Diminuir ritmo viral': 'Decrease viral pace', 'Aumentar ritmo viral': 'Increase viral pace', 'Altera contato e replicação no cenário B a partir da próxima hora.': 'Changes cell contact and replication in scenario B from the next hour.',
  'Contato inicial': 'Initial contact', 'Infecção localizada': 'Localized infection', 'Defesa em ação': 'Defense at work', 'Maior comprometimento': 'More tissue involvement', 'Em recuperação': 'Recovering', 'Atividade controlada': 'Activity controlled',
  'A mucosa entrou em contato com o vírus. A pessoa simulada ainda pode não sentir nada.': 'The virus has reached the mucosa. The simulated person may not feel anything yet.',
  'A atividade alcançou células das vias respiratórias. O corpo começa a reagir.': 'Activity has reached airway cells. The body is beginning to respond.',
  'A resposta do corpo está ativa enquanto a infecção continua em algumas regiões.': 'The body is responding while infection continues in some regions.',
  'A ilustração mostra mais inflamação e perda de integridade do tecido.': 'The illustration shows more inflammation and a loss of tissue integrity.',
  'A atividade viral diminui e o tecido começa a ser recomposto.': 'Viral activity is falling as the tissue begins to rebuild.',
  'A defesa conteve a atividade viral neste cenário. O reparo pode continuar.': 'Defense contained viral activity in this scenario. Repair may continue.',
  'Sem sintomas aparentes': 'No apparent symptoms', 'Irritação nasal possível': 'Possible nasal irritation', 'Coriza possível': 'Possible runny nose', 'Garganta irritada': 'Irritated throat', 'Tosse possível': 'Possible cough',
  'Tosse': 'Cough', 'Cansaço possível': 'Possible fatigue', 'Febre ou dores possíveis': 'Possible fever or aches', 'Tosse mais intensa': 'Stronger cough', 'Cansaço': 'Fatigue', 'Tosse residual possível': 'Possible lingering cough', 'Sintomas em redução': 'Symptoms easing',
  'Há tecido afetado no modelo.': 'The model shows affected tissue.', 'Há células novas em recuperação.': 'New cells are recovering.', 'A barreira do tecido segue preservada.': 'The tissue barrier remains intact.',
  'O que acontece neste instante': 'What is happening now', 'Sem atividade': 'No activity', 'Contato': 'Contact', 'Infecção': 'Infection', 'Replicação': 'Replication', 'Dano ao tecido': 'Tissue damage', 'Reposição celular': 'Cell replacement', 'Controlada': 'Controlled',
  'Estados das células nesta região': 'Cell states in this region', 'Contagem de células': 'Cell count', 'Defesa local': 'Local defense', 'Por que mudou?': 'Why did it change?', 'Legenda da animação': 'Animation legend', 'Vírus': 'Virus', 'Defesa': 'Defense', 'Dano': 'Damage', 'Reparo': 'Repair',
  'saudáveis': 'healthy', 'expostas': 'exposed', 'infectadas': 'infected', 'controladas': 'controlled', 'danificadas': 'damaged', 'removidas': 'removed', 'novas em reparo': 'new, repairing',
  'Ver o que acontece no tecido': 'See what happens in the tissue', 'Observar uma célula': 'Observe a cell', 'Animação esquemática. Estados e contagens vêm da simulação.': 'Schematic animation. States and counts come from the simulation.',
  'Esta região está preservada.': 'This region is intact.', 'Há atividade viral nesta região.': 'This region has viral activity.', 'Células infectadas estão replicando.': 'Infected cells are replicating.', 'A infecção entrou nas células.': 'Infection has entered the cells.', 'A defesa já controla parte das células.': 'Defense is controlling some cells.',
  'O vírus está em contato com o tecido.': 'The virus is contacting the tissue.', 'A infecção foi controlada nestas células.': 'Infection was controlled in these cells.', 'O tecido apresenta dano celular.': 'The tissue shows cell damage.', 'Novas células estão repondo o tecido.': 'New cells are replacing damaged tissue.', 'O tecido está recomposto.': 'The tissue has rebuilt.',
  'Contato com a membrana.': 'Contact with the membrane.', 'Replicação na célula infectada.': 'Replication in the infected cell.', 'A célula foi infectada.': 'The cell became infected.', 'A defesa controlou esta célula.': 'Defense controlled this cell.', 'Esta célula sofreu dano.': 'This cell was damaged.', 'A célula foi removida.': 'The cell was removed.', 'Uma nova célula está crescendo.': 'A new cell is growing.', 'A nova célula está íntegra.': 'The new cell is intact.', 'Esta célula está saudável.': 'This cell is healthy.',
  // Milestones and time
  'Novo marco da simulação': 'New simulation milestone', 'ACONTECEU NA SIMULAÇÃO': 'HAPPENED IN THE SIMULATION', 'Fechar marco': 'Dismiss milestone', 'Ver este instante no 3D': 'See this moment in 3D',
  'Dia': 'Day', 'dia': 'day', 'dias': 'days', '− dia': '− day', '+ dia': '+ day', '−1 dia': '−1 day', '+1 dia': '+1 day', '0,5×': '0.5×',
  'Último marco:': 'Latest milestone:', 'Último marco: dia': 'Latest milestone: day', 'nenhuma infectada': 'none infected',
  'O primeiro contato foi registrado na mucosa nasal.': 'First contact was recorded in the nasal mucosa.', 'Este cenário começou sem contato viral.': 'This scenario started without viral contact.', 'As primeiras células desta região passaram ao estado infectado.': 'The first cells in this region became infected.',
  'A resposta local elevou o índice de inflamação do tecido.': 'The local response raised the tissue inflammation index.', 'O tecido perdeu integridade nesta região.': 'Tissue integrity fell in this region.', 'Células novas começaram a ocupar posições antes removidas.': 'New cells began filling positions left by removed cells.',
  'A atividade viral ultrapassou um novo patamar nesta região.': 'Viral activity crossed a new threshold in this region.', 'A atividade viral local caiu abaixo do patamar anterior.': 'Local viral activity fell below its previous threshold.',
  'Uma condição do cenário começou a alterar a evolução ilustrada.': 'A scenario condition began to change the illustrated course.', 'A condição configurada terminou; os efeitos anteriores ainda podem aparecer.': 'The configured condition ended; earlier effects may remain visible.', 'O estado geral da pessoa simulada mudou com os índices do modelo.': 'The simulated person’s overall state changed with the model indices.',
  'Tempo da jornada': 'Journey timeline', 'Tempo e reprodução': 'Time and playback', 'Tempo simulado': 'Simulated time', 'Voltar um dia': 'Go back one day', 'Pausar': 'Pause', 'Iniciar jornada': 'Start journey', 'Iniciar': 'Start', 'Continuar': 'Continue', 'Avançar uma hora': 'Advance one hour', 'Avançar um dia': 'Advance one day', 'Replay': 'Replay', 'Velocidade': 'Speed', 'Horizonte': 'Horizon', 'Horizonte da simulação': 'Simulation horizon', 'Mais controles de tempo': 'More time controls', 'Linha do tempo': 'Timeline',
  'Eventos na linha do tempo': 'Events on the timeline', 'Acontecimentos da simulação': 'Simulation milestones', 'O que mudou': 'What changed', 'Aguardando o primeiro marco calculado.': 'Waiting for the first calculated milestone.', 'Rever este instante': 'Revisit this moment', 'Próximo acontecimento': 'Next milestone',
  'Marcos calculados pela simulação': 'Milestones calculated by the simulation', 'Eventos do cenário': 'Scenario events', 'Arraste para revisar; o estado é reconstruído pela mesma seed.': 'Drag to review; the same seed rebuilds the state.', 'Marcos recentes': 'Recent milestones', 'Mostrar o que aconteceu': 'See what happened',
  'Privação de sono': 'Sleep loss', 'Estresse': 'Stress', 'Exposição à fumaça': 'Smoke exposure', 'Hidratação insuficiente': 'Insufficient hydration', 'Defesa reduzida': 'Reduced defense', 'Vulnerabilidade respiratória': 'Respiratory vulnerability', 'Proteção prévia': 'Prior protection', 'Suporte e repouso': 'Rest and support', 'Ritmo viral': 'Viral pace',
  // Main journey
  'Ir para o tempo da simulação': 'Skip to simulation timeline', 'H1N1 Jornada da Infecção, início': 'H1N1 Infection Journey, home', 'Jornada da Infecção': 'Infection Journey', 'Explore por dentro.': 'Explore from within.', 'Como explorar': 'How to explore', 'Configurar simulação': 'Simulation settings', 'Reiniciar jornada': 'Restart journey', 'Reiniciar': 'Restart',
  'Exploração 3D': '3D exploration', 'O corpo inteiro': 'The whole body', 'Tudo começa com uma respiração.': 'It starts with a breath.', 'Siga o caminho do vírus. Do primeiro contato até o que acontece dentro de uma célula.': 'Follow the virus from first contact to what happens inside a cell.', 'Seguir a respiração': 'Follow the breath',
  'Sistema respiratório': 'Respiratory system', 'Um caminho para dentro.': 'A path inward.', 'Do nariz aos pulmões: as vias respiratórias são revestidas por uma barreira viva.': 'From nose to lungs, the airways are lined by a living barrier.', 'Explorar os pulmões': 'Explore the lungs',
  'Dentro do pulmão': 'Inside the lung', 'Cada ramo leva mais longe.': 'Every branch leads deeper.', 'Aproxime uma região para ver o tecido que reveste suas vias.': 'Zoom into a region to see the tissue lining its airways.', 'Aproximar o tecido': 'Zoom into the tissue',
  'Tecido respiratório': 'Respiratory tissue', 'Uma barreira feita de células.': 'A barrier made of cells.', 'Aqui, células e defesas interagem. Clique em uma célula para descobrir o que está acontecendo.': 'Here, cells and defenses interact. Select a cell to see what is happening.', 'Entrar em uma célula': 'Enter a cell',
  'Escala celular': 'Cell scale', 'Um mundo dentro de outro.': 'A world within a world.', 'Observe a membrana, o núcleo e a atividade viral. Este estado acompanha o mesmo instante do corpo.': 'Explore the membrane, nucleus and viral activity at the same moment as the whole body.', 'Voltar ao tecido': 'Back to tissue', 'Voltar um nível': 'Back one level',
  'Cenário': 'Scenario', 'Preparando o corpo humano.': 'Preparing the human body.', 'Carregando a anatomia 3D no seu dispositivo.': 'Loading 3D anatomy on your device.', 'A cena 3D não pôde iniciar.': 'The 3D scene could not start.', 'Tentar novamente': 'Try again',
  'Região': 'Region', 'Girar à esquerda': 'Rotate left', 'Girar à direita': 'Rotate right', 'Aproximar': 'Zoom in', 'Afastar': 'Zoom out', 'Enquadrar': 'Frame view', 'Controles da câmera': 'Camera controls', 'Arraste para girar · aproxime para explorar': 'Drag to rotate · zoom to explore', 'Representação ilustrativa · fora de escala': 'Illustrative view · not to scale',
  '＋ E se algo mudar? Adicionar evento': '＋ What if something changes? Add an event', 'E se algo mudar?': 'What if something changes?', 'Adicionar evento': 'Add event', 'Comparar cenários': 'Compare scenarios', 'Ver o que mudou': 'See what changed', 'Simulação educacional. Não é uma previsão clínica.': 'Educational simulation. Not a clinical prediction.', 'Trajetória': 'Trajectory', 'Marcos': 'Milestones', 'Créditos 3D': '3D credits', 'Desempenho': 'Performance', 'Preparando 3D': 'Preparing 3D', 'Geometrias': 'Geometries', 'Texturas': 'Textures', 'Desenhos': 'Draw calls', 'Triângulos': 'Triangles', 'Qualidade': 'Quality',
  'Uma jornada, passo a passo': 'A journey, step by step', 'Comece pelo que você vê': 'Start with what you see', 'Gire. Aproxime.': 'Rotate. Zoom in.', 'Descubra por dentro.': 'Discover what is inside.', 'Explore o corpo.': 'Explore the body.', 'Siga até uma célula.': 'Follow the path to a cell.', 'Avance e experimente.': 'Advance and experiment.', 'Vamos explorar': 'Let’s explore',
  'Seu experimento': 'Your experiment', 'Escolha um ponto de partida.': 'Choose a starting point.', 'São condições ilustrativas. Nenhum dado pessoal é necessário.': 'These are illustrative conditions. No personal data is needed.', 'Condições iniciais': 'Initial conditions', 'Reduzir movimento': 'Reduce motion', 'Transições imediatas e movimentos decorativos desligados.': 'Immediate transitions; decorative movement is off.', 'Câmera automática': 'Automatic camera', 'Uma órbita suave, que respeita sua navegação manual.': 'A gentle orbit that respects manual navigation.', 'Sair da apresentação': 'Exit presentation', 'Modo apresentação': 'Presentation mode', 'Repetir a mesma jornada': 'Repeat the same journey', 'A mesma seed e os mesmos eventos reproduzem o mesmo resultado.': 'The same seed and events reproduce the same result.', 'Seed': 'Seed', 'Aplicar e reiniciar': 'Apply and restart',
  'Estado da jornada': 'Journey status', 'O que está acontecendo?': 'What is happening?', 'E se algo mudar na jornada?': 'What if the journey changes?', 'Mesmo começo. Uma condição diferente.': 'Same start. Different condition.', 'Explorar cenário': 'Explore scenario', 'Como a jornada mudou.': 'How the journey changed.', 'Quatro índices internos, de 0 a 100. Não são exames.': 'Four internal indices from 0 to 100. They are not test results.', 'Uma história de mudanças.': 'A story of change.', 'Selecione um momento para encontrá-lo no corpo.': 'Select a moment to find it in the body.', 'Mudanças que a simulação calculou': 'Changes calculated by the simulation',
  // Atlas
  'Atlas anatômico': 'Anatomical atlas', 'DO ORGANISMO À CÉLULA': 'FROM BODY TO CELL', 'O caminho da infecção': 'The path of infection', 'Buscar anatomia': 'Search anatomy', 'Encontrar estrutura': 'Find a structure', 'Percurso do H1N1': 'H1N1 journey', 'Fechar percurso': 'Close journey', 'Em evolução': 'Running', 'Em pausa': 'Paused', 'Via respiratória.': 'The respiratory route.', 'Escolha uma região para observar.': 'Choose a region to explore.', 'Explorar anatomia completa': 'Explore full anatomy',
  'Camadas anatômicas': 'Anatomical layers', 'Sistemas': 'Systems', 'Fechar sistemas': 'Close systems', 'Todos': 'All', 'Esqueleto': 'Skeleton', 'Órgãos': 'Organs', 'Músculos': 'Muscles', 'Coração': 'Heart', 'Órgãos sensoriais': 'Sensory organs', 'Artérias': 'Arteries', 'Veias': 'Veins', 'Sistema nervoso': 'Nervous system', 'Digestório': 'Digestive', 'Urinário': 'Urinary', 'Linfático': 'Lymphatic', 'Endócrino': 'Endocrine', 'Reprodutor': 'Reproductive', 'Superfície corporal': 'Body surface', 'Tecido conjuntivo': 'Connective tissue',
  'peças visíveis': 'visible parts', 'Ocultar tudo': 'Hide all', 'Buscar estruturas': 'Search structures', 'Encontrar uma estrutura': 'Find a structure', 'Fechar busca': 'Close search', 'Buscar estruturas anatômicas': 'Search anatomical structures', 'Pulmão, coração, trachea…': 'Lung, heart, trachea…', 'peça': 'part', 'peças': 'parts', 'Nenhuma estrutura encontrada. Tente também o nome em inglês ou o identificador FMA.': 'No structure found. Try another name or the FMA identifier.',
  'Estrutura selecionada': 'Selected structure', 'Fechar estrutura': 'Close structure', 'Referência anatômica': 'Anatomical reference', 'Peças selecionadas': 'Selected parts', 'Estruturas incluídas': 'Included structures', 'Entender este momento': 'Understand this moment', 'Mostrar no corpo': 'Show in body', 'Isolar estrutura': 'Isolate structure', 'Focar estrutura': 'Focus structure', 'Explorar o tecido respiratório': 'Explore respiratory tissue', 'Abrir percurso H1N1': 'Open H1N1 journey', 'Regiões': 'Regions',
  'Movimentar câmera': 'Move camera', 'Orbitar livremente': 'Orbit freely', 'Orbitar': 'Orbit', 'Deslocar câmera': 'Pan camera', 'Mover': 'Pan', 'Aproximar anatomia': 'Zoom into anatomy', 'Afastar anatomia': 'Zoom out of anatomy', 'Enquadrar região': 'Frame region', 'Vistas anatômicas': 'Anatomical views', 'Parar rotação': 'Stop rotation', 'Girar anatomia': 'Rotate anatomy', 'Restaurar anatomia': 'Reset anatomy', 'Abrir sistemas': 'Open systems', 'Separar anatomia': 'Explode anatomy', 'Corpo montado': 'Assembled body', 'Peça por peça': 'Part by part', 'Montar anatomia': 'Assemble anatomy', 'Montar': 'Assemble', 'Explorar sistema respiratório': 'Explore respiratory system', 'Entrar no tecido': 'Enter the tissue', 'Arraste para deslocar': 'Drag to pan', 'Arraste para girar': 'Drag to rotate', 'roda/pinça para aproximar': 'scroll/pinch to zoom', 'partículas ilustrativas': 'illustrative particles',
  'Preparando a anatomia completa': 'Preparing full anatomy', 'A anatomia não pôde iniciar.': 'Anatomy could not start.', 'Carregando 2.234 peças': 'Loading 2,234 parts',
  // Explanations, comparison, charts, events
  'Saudável': 'Healthy', 'Exposta': 'Exposed', 'Infectada': 'Infected', 'Danificada': 'Damaged', 'Controlada pela defesa': 'Controlled by defense', 'Removida · tecido em reparo': 'Removed · tissue repairing', 'Nova célula · em recuperação': 'New cell · recovering',
  'Exposição': 'Exposure', 'Resposta imunológica': 'Immune response', 'Tecido em recuperação': 'Tissue recovering', 'Agravamento ilustrativo': 'Illustrative worsening', 'Resposta imune': 'Immune response', 'Reparo do tecido': 'Tissue repair', 'Atividade local': 'Local activity',
  'Estado atual do organismo': 'Current body status', 'Estado calculado': 'Calculated status', 'O organismo agora.': 'The body now.', 'Índices internos · 0 a 100': 'Internal indices · 0 to 100', 'Resposta de defesa': 'Defense response', 'Inflamação': 'Inflammation', 'O que mudou?': 'What changed?', 'O contato começa na mucosa.': 'Contact begins in the mucosa.', 'Explicação causal': 'Causal explanation', 'Fatores usados pela engine': 'Factors used by the model', 'Célula epitelial selecionada': 'Selected epithelial cell', 'Célula epitelial': 'Epithelial cell', 'Neste estado': 'In this state', 'Identidade': 'Identity', 'geração': 'generation', 'h simuladas': 'simulated h',
  'Uma célula danificada é removida. A recuperação do tecido envolve reposição com uma nova identidade.': 'A damaged cell is removed. Tissue recovery involves replacement with a new cell identity.', 'Representação educacional. Estes índices não são exames, saturação de oxigênio ou previsão individual.': 'Educational illustration. These indices are not tests, oxygen saturation or individual predictions.',
  'O que mudou com o evento?': 'What changed with the event?', 'Configuração compartilhada': 'Shared setup', 'Evolução original': 'Original course', 'Cenário modificado': 'Modified scenario', 'Condições iniciais preservadas': 'Initial conditions preserved', 'Ver cenário': 'View scenario', 'Momentos da trajetória': 'Journey moments', 'Recuperação ilustrativa:': 'Illustrative recovery:', 'Agravamento ilustrativo:': 'Illustrative worsening:', 'ainda não observada': 'not observed yet', 'ainda não observado': 'not observed yet', 'Diferenças entre cenários': 'Scenario differences', 'Sem diferença': 'No difference', 'no horário selecionado': 'at the selected time', 'pontos internos · B menos A': 'internal points · B minus A', 'Por quê?': 'Why?', 'Fatores registrados:': 'Recorded factors:', 'estado local da região': 'local regional state',
  'Integridade tecidual': 'Tissue integrity', 'Como a jornada evolui': 'How the journey evolves', 'Escala ilustrativa · 0 a 100': 'Illustrative scale · 0 to 100', 'Quatro índices ao longo do tempo: atividade viral, defesa, integridade tecidual e inflamação. Cenário A tracejado; cenário B contínuo.': 'Four indices over time: viral activity, defense, tissue integrity and inflammation. Scenario A is dashed; scenario B is solid.', 'Ver valores na tabela': 'View values in a table', 'Valores no horário selecionado': 'Values at the selected time', 'Índice interno': 'Internal index',
  'Editar evento': 'Edit event', 'E se alguma coisa mudar?': 'What if something changes?', 'Fechar editor de adversidades': 'Close event editor', 'Fechar': 'Close', 'Tipo de evento': 'Event type', 'Escolha uma condição para configurar o evento.': 'Choose a condition to configure the event.', 'Como esta condição atua?': 'How does this condition work?', 'Parâmetro do modelo:': 'Model parameter:', 'Dia de início': 'Start day', 'Hora de início': 'Start hour', 'Duração em horas': 'Duration in hours', 'Intensidade': 'Intensity', 'Leve': 'Mild', 'Moderada': 'Moderate', 'Intensa': 'High', 'Região afetada': 'Affected region', 'Todo o sistema respiratório': 'Entire respiratory system', 'Uma experiência educativa, sem previsão individual.': 'An educational experiment, without individual predictions.', 'Aplicar ao cenário': 'Apply to scenario', 'Cancelar edição': 'Cancel editing', 'Eventos do cenário B': 'Scenario B events', 'Nenhum evento adicional. A e B compartilham a mesma seed e as mesmas condições iniciais.': 'No additional events. A and B share the same seed and initial conditions.', 'Desativado': 'Disabled', 'Agendado': 'Scheduled', 'Concluído': 'Completed', 'Em curso': 'In progress', 'Ativo': 'Active', 'Editar': 'Edit', 'Ativar': 'Enable', 'Remover': 'Remove', 'horas': 'hours', 'leve': 'mild', 'moderada': 'moderate', 'intensa': 'high',
  'Defesa típica': 'Typical defense', 'Um ponto de partida equilibrado para explorar a jornada.': 'A balanced starting point for the journey.', 'Menor capacidade inicial de conter a atividade e reparar o tecido neste modelo.': 'Less initial ability to contain activity and repair tissue in this model.', 'O modelo começa com maior proteção e memória de resposta ilustrativas.': 'The model starts with higher illustrative protection and immune memory.',
  'Dormiu mal por 2 noites': 'Poor sleep for two nights', 'Reduz temporariamente a capacidade de resposta e o reparo ilustrativos.': 'Temporarily reduces the illustrative response and repair capacity.', 'eficiência da defesa e velocidade de reparo': 'defense efficiency and repair speed',
  'Período de estresse intenso': 'Period of intense stress', 'Altera a resiliência do tecido e a resposta de defesa deste cenário.': 'Changes tissue resilience and defense response in this scenario.', 'resiliência tecidual e eficiência da resposta': 'tissue resilience and response efficiency',
  'Irritação das vias respiratórias': 'Airway irritation', 'Adiciona irritação local e reduz a barreira epitelial no modelo.': 'Adds local irritation and reduces the epithelial barrier in the model.', 'barreira epitelial e irritação local': 'epithelial barrier and local irritation',
  'Dificulta o reparo e eleva o índice interno de desconforto.': 'Slows repair and raises the internal discomfort index.', 'velocidade de reparo e desconforto': 'repair speed and discomfort',
  'Defesa inicialmente reduzida': 'Initially reduced defense', 'Configura uma capacidade basal de resposta menor, antes da exposição.': 'Sets a lower baseline response before exposure.', 'capacidade basal de defesa': 'baseline defense capacity',
  'Maior vulnerabilidade respiratória': 'Greater respiratory vulnerability', 'O tecido começa menos resiliente, sem representar uma doença específica.': 'Tissue starts less resilient, without representing a specific disease.', 'vulnerabilidade e resiliência do tecido': 'tissue vulnerability and resilience',
  'Aumenta a proteção inicial e a memória de resposta ilustrativa.': 'Raises initial protection and illustrative immune memory.', 'proteção inicial e memória de defesa': 'initial protection and immune memory',
  'Condições favoráveis de recuperação': 'Favorable recovery conditions', 'Favorece o reparo e o suporte geral da resposta neste cenário.': 'Supports repair and the overall response in this scenario.', 'reparo tecidual, resiliência e suporte de defesa': 'tissue repair, resilience and defense support',
  'Ritmo viral aumentado': 'Increased viral pace', 'Acelera o contato com células e a replicação ilustrativa a partir deste instante.': 'Accelerates cell contact and illustrative replication from this moment.', 'multiplicador do ritmo viral': 'viral pace multiplier',
  // Short log titles and model factors
  'Contato inicial na mucosa': 'Initial contact in the mucosa', 'Sem contato inicial': 'No initial contact', 'Infecção local': 'Local infection', 'Reparo em andamento': 'Repair in progress', 'Maior comprometimento ilustrativo': 'More illustrative tissue involvement',
  'contato inicial com a mucosa': 'initial mucosal contact', 'proteção prévia do cenário': 'scenario prior protection', 'defesa basal reduzida': 'reduced baseline defense', 'vulnerabilidade respiratória inicial': 'initial respiratory vulnerability', 'replicação de células infectadas': 'replication by infected cells', 'atividade recebida de uma região conectada': 'activity from a connected region', 'controle pela resposta de defesa local': 'control by local defense', 'inflamação local altera a integridade': 'local inflammation affects integrity', 'células danificadas ou removidas reduzem a barreira': 'damaged or removed cells weaken the barrier', 'reparo com reposição de células': 'repair through cell replacement', 'ausência de contato viral inicial': 'no initial viral contact',
};

const EXTRA_EN: Record<string, string> = {
  'O contato inicial acontece na mucosa. A defesa ainda está reconhecendo essa atividade.': 'Initial contact occurs at the mucosa. Defense is still recognizing this activity.',
  'Há células infectadas nas vias respiratórias. A atividade continua localizada nas regiões calculadas.': 'There are infected cells in the airways. Activity remains local to the calculated regions.',
  'A defesa está mais ativa. Algumas células controlam a infecção; outras regiões ainda precisam de reparo.': 'Defense is more active. Some cells control infection while other regions still need repair.',
  'A atividade viral está caindo. O tecido está sendo reparado e células removidas dão lugar a novas células.': 'Viral activity is falling. Tissue is being repaired as new cells replace removed ones.',
  'Neste cenário, a inflamação e o dano ao tecido estão elevados. Explore a região para entender os fatores.': 'In this scenario, inflammation and tissue damage are elevated. Explore the region to understand why.',
  'A atividade foi controlada neste cenário. O tecido pode continuar se reparando.': 'Activity was controlled in this scenario. Tissue may keep repairing.',
  'Jornada reiniciada no corpo inteiro.': 'Journey restarted at the whole-body view.',
  'Não há novos marcos até o fim deste cenário.': 'There are no further milestones in this scenario.',
  'Explore o corpo.': 'Explore the body.',
  'Arraste o modelo e selecione uma região. Você também pode usar os nomes das escalas e os botões de câmera.': 'Drag the model and select a region. You can also use the scale names and camera controls.',
  'Siga até uma célula.': 'Follow the path to a cell.',
  'Corpo, pulmão, tecido e célula mostram o mesmo instante da mesma jornada.': 'Body, lung, tissue and cell show the same moment in the same journey.',
  'Avance e experimente.': 'Advance and experiment.',
  'Mude o dia. Adicione uma condição ao cenário B e compare com o original. Nada aqui prevê o que acontecerá com uma pessoa.': 'Change the day. Add a condition to scenario B and compare it with the original. Nothing here predicts what will happen to a person.',
  'O modelo parte de uma exposição representativa nas vias de entrada. A evolução depende das células, da defesa e das condições escolhidas.': 'The model starts with representative exposure in the entry airways. Its course depends on cells, defense and selected conditions.',
  'O contato inicial adicionou atividade viral à mucosa nasal neste modelo. As outras regiões começam sem atividade viral; sua evolução dependerá das conexões e da defesa calculada.': 'Initial contact added viral activity to the nasal mucosa in this model. Other regions begin without viral activity; their course depends on connections and calculated defense.',
  'Este cenário começou sem contato viral. Nenhuma infecção é introduzida por uma data programada.': 'This scenario began without viral contact. Infection is never introduced on a scheduled date.',
  'A comparação não prevê o futuro de uma pessoa.': 'The comparison does not predict a person’s future.',
  'O evento modifica': 'The event modifies', 'nas regiões do modelo': 'in the model regions', 'A intensidade': 'The intensity',
  'Limite de 40 eventos no cenário. Edite ou remova um evento para continuar.': 'This scenario has reached its 40-event limit. Edit or remove an event to continue.',
  'Evento atualizado': 'Event updated', 'Evento aplicado': 'Event applied', 'Compare as trajetórias para observar a mudança.': 'Compare trajectories to see the change.',
  'Condição inicial: aplicada antes da exposição, no dia 0. Não representa uma intervenção durante a infecção.': 'Initial condition: applied before exposure, on day 0. It does not represent an intervention during infection.',
  'Escolha uma condição e veja seu efeito no cenário B.': 'Choose a condition and see its effect in scenario B.',
  'Mesmo início, duas trajetórias simuladas.': 'Same start, two simulated trajectories.',
  'Mesmas condições iniciais e seed': 'Same initial conditions and seed',
  'Contato inicial na mucosa nasal': 'Initial contact in the nasal mucosa',
  'a atividade celular e a defesa basal': 'cell activity and baseline defense', 'o estado das células e a defesa basal': 'cell state and baseline defense',
  'ativo': 'active', 'desativado': 'disabled',
  'Atlas 3D interativo do corpo humano': 'Interactive 3D human anatomy atlas',
  'Célula em foco': 'Focused cell', 'comparar cenários': 'compare scenarios',
  'índices ilustrativos': 'illustrative indices',
  'condição ativa': 'active condition', 'condições ativas': 'active conditions',
  'horas': 'hours', 'leve': 'mild', 'moderada': 'moderate', 'intensa': 'high',
  'Editar': 'Edit', 'Ativar': 'Enable', 'Remover': 'Remove',
  'aplicado ao cenário B.': 'applied to scenario B.',
  'no cenário B.': 'to scenario B.',
  'em 3D': 'in 3D',
  // Anatomy aliases shown from the atlas catalog
  'Cérebro': 'Brain', 'Fígado': 'Liver', 'Estômago': 'Stomach', 'Baço': 'Spleen', 'Pâncreas': 'Pancreas', 'Laringe': 'Larynx', 'Faringe': 'Pharynx', 'Diafragma': 'Diaphragm',
  'Pulmão': 'Lung', 'Pulmões': 'Lungs', 'Pulmão direito': 'Right lung', 'Pulmão esquerdo': 'Left lung', 'Sistema respiratório': 'Respiratory system', 'Bexiga': 'Bladder',
  'Brônquio principal direito': 'Right main bronchus', 'Brônquio principal esquerdo': 'Left main bronchus',
  'Célula': 'Cell', '+1 hora': '+1 hour', 'Contato com a mucosa': 'Contact with the mucosa',
  'Alta': 'High', 'Equilibrada': 'Balanced', 'Compacta': 'Compact', 'Atlas completo': 'Full atlas',
  'Preparando a escala microscópica…': 'Preparing the microscopic scale…',
  'O catálogo anatômico não pôde ser carregado.': 'The anatomy catalog could not be loaded.',
  'Não foi possível carregar um arquivo de anatomia.': 'An anatomy file could not be loaded.',
  'Um arquivo de anatomia chegou incompleto. Recarregue o visualizador.': 'An anatomy file was incomplete. Reload the viewer.',
  'Não foi possível construir a geometria das partículas virais.': 'The viral particle geometry could not be built.',
  'Não foi possível montar a anatomia.': 'The anatomy could not be assembled.',
  'Não foi possível iniciar a cena 3D.': 'The 3D scene could not start.',
  'Não foi possível iniciar o atlas 3D.': 'The 3D atlas could not start.',
  'Tipo de evento desconhecido.': 'Unknown event type.',
  'Limite de 40 eventos por cenário.': 'This scenario has reached its 40-event limit.',
  'Nenhum backend gráfico disponível': 'No graphics backend is available',
  'WebGL 2 não pôde iniciar. Verifique a aceleração gráfica.': 'WebGL 2 could not start. Check graphics acceleration.',
  'WebGPU e WebGL 2 não puderam iniciar.': 'WebGPU and WebGL 2 could not start.',
  'O modelo anatômico local não contém uma superfície humana.': 'The local anatomical model does not include a human surface.',
  'O atlas pulmonar local não contém estruturas.': 'The local lung atlas does not include any structures.',
  'Este navegador não conseguiu inicializar WebGL 2.': 'This browser could not start WebGL 2.',
  'Não foi possível iniciar a cena 3D. Ative a aceleração gráfica ou use um navegador com WebGL 2.': 'The 3D scene could not start. Turn on graphics acceleration or use a browser with WebGL 2.',
  'WebGPU e WebGL 2 não estão disponíveis. Ative a aceleração gráfica para abrir o simulador.': 'WebGPU and WebGL 2 are unavailable. Turn on graphics acceleration to open the simulator.',
  'O navegador não conseguiu compilar a cena 3D. Tente o modo WebGL 2 ou atualize o navegador.': 'The browser could not compile the 3D scene. Try WebGL 2 mode or update the browser.',
  'Idioma': 'Language',
  'Estruturas de sustentação e proteção. Oculte os músculos para observar os ossos e suas relações.': 'Supporting and protective structures. Hide the muscles to see the bones and how they relate.',
  'Músculos e seus pontos de inserção. Sua visibilidade ajuda a revelar as camadas mais profundas.': 'Muscles and where they attach. Showing them helps reveal the deeper layers.',
  'O coração ocupa o tórax entre os pulmões. Neste experimento, o modelo de infecção acompanha as vias respiratórias.': 'The heart sits in the chest between the lungs. In this experiment, the infection model follows the airways.',
  'Estruturas relacionadas aos sentidos, identificadas pela anatomia de origem.': 'Structures related to the senses, identified from the source anatomy.',
  'Vasos que conduzem sangue para fora do coração. As cores são convenções desta visualização.': 'Vessels that carry blood away from the heart. The colors are conventions of this view.',
  'Vasos de retorno ao coração. Ative e oculte camadas para acompanhar seus trajetos.': 'Vessels that return blood to the heart. Show and hide layers to follow their paths.',
  'Cérebro, medula e nervos representados nesta anatomia de referência.': 'Brain, spinal cord, and nerves included in this reference anatomy.',
  'Selecione uma via ou um segmento pulmonar, isole a estrutura e entre no tecido para observar a infecção no mesmo instante da simulação.': 'Select an airway or a lung segment, isolate it, and enter the tissue to see the infection at the same moment in the simulation.',
  'Órgãos e estruturas do aparelho digestório, no contexto das demais estruturas do tronco.': 'Organs of the digestive tract, shown among the other structures of the torso.',
  'Rins e vias urinárias representados na anatomia de referência.': 'Kidneys and urinary tract from the reference anatomy.',
  'Estruturas linfáticas disponíveis neste conjunto. A quantidade de peças não representa a complexidade biológica do sistema.': 'Lymphatic structures available in this set. The number of parts does not represent the biological complexity of the system.',
  'Órgãos endócrinos identificados no conjunto de referência.': 'Endocrine organs identified in the reference set.',
  'Estruturas do aparelho reprodutor da referência masculina adulta.': 'Structures of the reproductive system from the adult male reference.',
  'Superfície externa usada como referência de posição. Desative esta camada para explorar os sistemas internos.': 'Outer surface used as a position reference. Hide this layer to explore the internal systems.',
  'Cartilagens, ligamentos e outros tecidos de sustentação disponíveis no atlas.': 'Cartilage, ligaments, and other supportive tissues available in the atlas.',
  'Não foi possível iniciar o atlas em WebGL 2. Verifique a aceleração gráfica.': 'The atlas could not start in WebGL 2. Check graphics acceleration.',
  'Não foi possível carregar a anatomia.': 'The anatomy could not be loaded.',
  'O contexto gráfico foi interrompido. Recarregue para continuar.': 'The graphics context was interrupted. Reload to continue.',
  'O contexto gráfico foi perdido. Recarregue a cena para continuar a partir dos controles.': 'The graphics context was lost. Reload the scene to continue from the controls.',
  'A renderização foi interrompida. Reinicie a cena ou tente o modo WebGL 2.': 'Rendering stopped. Restart the scene or try WebGL 2 mode.',
  'A cena não pôde continuar.': 'The scene could not continue.',
  'Ambiente microscópico 3D interativo': 'Interactive 3D microscopic environment',
  'Partícula neutralizada pela defesa.': 'Particle neutralized by defense.',
  'Janela de observação concluída.': 'Observation window complete.',
  'Nenhuma partícula ativa ou célula infectada restante.': 'No active particles or infected cells remain.',
  'Equilíbrio': 'Balance',
  'Observe infecção e defesa disputando o mesmo ambiente.': 'Watch infection and defense share the same environment.',
  'Propagação': 'Spread',
  'Mais partículas e uma defesa inicial reduzida.': 'More particles and a lower initial defense.',
  'Defesa ativa': 'Active defense',
  'Uma resposta mais intensa encontra as partículas cedo.': 'A stronger response meets the particles early.',
  'A JORNADA ATÉ AQUI': 'THE JOURNEY SO FAR',
  'Escolha um card para voltar àquele instante no 3D.': 'Choose a card to revisit that moment in 3D.',
  'Próximo marco': 'Next milestone',
  'Não há exposição ou infecção calculada nesta célula.': 'No exposure or infection has been calculated for this cell.',
};
const DICTIONARY = { ...EN, ...EXTRA_EN };
const PHRASES = Object.entries(DICTIONARY).filter(([key]) => key.length >= 8).sort((a, b) => b[0].length - a[0].length);

const PREFIXES: readonly [RegExp, string][] = [
  [/^Mostrar o que aconteceu: (.+)$/, 'See what happened: $1'], [/^Explorar (.+)$/, 'Explore $1'], [/^Focar (.+)$/, 'Focus $1'], [/^Inspecionar (.+) no 3D: (.+)$/, 'Inspect $1 in 3D: $2'], [/^Mostrar (.+)$/, 'Show $1'], [/^Isolar sistema (.+)$/, 'Isolate $1 system'],
  [/^Vista três quartos$/, 'Three-quarter view'], [/^Vista frontal$/, 'Front view'], [/^Vista lateral$/, 'Side view'], [/^Vista posterior$/, 'Back view'],
  [/^Fechar (.+)$/, 'Close $1'],
  [/^Editar (.+)$/, 'Edit $1'], [/^Ativar (.+)$/, 'Enable $1'], [/^Remover (.+)$/, 'Remove $1'],
  [/^Primeiras células infectadas: (.+)$/, 'First infected cells: $1'], [/^Inflamação aumentou: (.+)$/, 'Inflammation increased: $1'], [/^Integridade do tecido diminuiu: (.+)$/, 'Tissue integrity decreased: $1'], [/^Reposição celular: (.+)$/, 'Cell replacement: $1'], [/^Atividade viral aumentou: (.+)$/, 'Viral activity increased: $1'], [/^Atividade local em queda: (.+)$/, 'Local activity falling: $1'],
  [/^Condição ativa: (.+)$/, 'Condition active: $1'], [/^Condição encerrada: (.+)$/, 'Condition ended: $1'],
];

function translateFactorList(value: string): string {
  return value.split('; ').map(item => translateText(item, 'en')).join('; ');
}

function translateEngineText(value: string): string | null {
  let match = value.match(/^(.+): (.+) \(evento (.+)\)$/);
  if (match) return `${translateText(match[1]!, 'en')}: ${translateText(match[2]!, 'en')} (event ${match[3]})`;
  match = value.match(/^Nesta região, a engine utilizou (.+)\. Os índices são internos à simulação e não representam exames ou previsão individual\.$/);
  if (match) return `In this region, the model used ${translateFactorList(match[1]!)}. These are internal simulation indices, not tests or individual predictions.`;
  match = value.match(/^O evento modifica (.+?)(?: em ([^.]+)| nas regiões do modelo)\. A intensidade (intensa|moderada|leve) controla somente os coeficientes demonstrativos, sem magnitude clínica individual\.$/);
  if (match) return `The event changes ${translateText(match[1]!, 'en')} ${match[2] ? `in ${translateText(match[2], 'en')}` : 'across the model regions'}. Its ${translateText(match[3]!, 'en')} setting affects only illustrative coefficients, not an individual's clinical course.`;
  match = value.match(/^A duração configurada terminou\. Os modificadores de (.+) não estão mais ativos; as alterações de tecido já ocorridas continuam seguindo as regras de reparo\.$/);
  if (match) return `The configured duration ended. The ${translateText(match[1]!, 'en')} modifiers are no longer active; earlier tissue changes still follow the repair rules.`;
  match = value.match(/^A classificação mudou porque os índices calculados de atividade viral, defesa, inflamação e integridade mudaram\. Em ([^,]+), os fatores utilizados foram (.+)\.$/);
  if (match) return `The overall state changed with the calculated viral, defense, inflammation and tissue indices. In ${translateText(match[1]!, 'en')}, the model used ${translateFactorList(match[2]!)}.`;
  return null;
}

function translateOne(value: string): string {
  if (DICTIONARY[value]) return DICTIONARY[value];
  const engine = translateEngineText(value);
  if (engine) return engine;
  if (value.startsWith('· ')) return `· ${translateOne(value.slice(2))}`;
  const arrow = value.match(/^(.*?)(\s*[↗→])$/);
  if (arrow) {
    const translated = translateOne(arrow[1]!.trim());
    if (translated !== arrow[1]!.trim()) return translated + arrow[2];
  }
  if (value.startsWith('＋ ')) {
    const translated = translateOne(value.slice(2));
    if (translated !== value.slice(2)) return `＋ ${translated}`;
  }
  if (value.includes(' · ')) {
    const parts = value.split(' · ');
    const mapped = parts.map(translateOne);
    if (mapped.some((part, index) => part !== parts[index])) return mapped.join(' · ');
  }
  for (const [pattern, replacement] of PREFIXES) {
    const match = value.match(pattern);
    if (match) return replacement.replace(/\$(\d)/g, (_, number: string) => translateText(match[Number(number)] ?? '', 'en'));
  }
  return value;
}

/** Translates a single visible string, including values built by the simulation. */
export function translateText(value: string, target: AppLocale = locale): string {
  if (target === 'pt' || !value.trim()) return value;
  const leading = value.match(/^\s*/)?.[0] ?? '';
  const trailing = value.match(/\s*$/)?.[0] ?? '';
  const core = value.trim();
  if (DICTIONARY[core]) return leading + DICTIONARY[core] + trailing;
  const engine = translateEngineText(core);
  if (engine) return leading + engine + trailing;
  let result = translateOne(core);
  result = result
    .replace(/Último marco: dia (\d+), (\d+)h/g, 'Latest milestone: day $1, $2h')
    .replace(/\bDia (\d+)/g, 'Day $1')
    .replace(/\bdia (\d+), (\d+) h\b/g, 'day $1, $2 h')
    .replace(/\bde (\d+) dias\b/g, '$1 days')
    .replace(/\b(\d+) dias\b/g, '$1 days')
    .replace(/\bgeração (\d+)\b/g, 'generation $1')
    .replace(/^Ritmo viral do cenário ([AB]) ajustado para ([0-9]+(?:[.,][0-9]+)?) vezes a partir da próxima hora\.$/g, 'Scenario $1 viral pace set to $2× from the next hour.')
    .replace(/^event:.+$/g, 'Scenario event')
    .replace(/\bCarregando ([\d.]+) peças\b/g, (_, n: string) => `Loading ${n.replace('.', ',')} parts`)
    .replace(/\bCenário ([AB])\b/g, 'Scenario $1')
    .replace(/\bcélula (\d+)\b/g, 'cell $1')
    .replace(/\bcenário ([AB])\b/g, 'scenario $1')
    .replace(/\b(\d+) (regiões em atividade|região em atividade)\b/g, (_, n: string) => `${n} active ${n === '1' ? 'region' : 'regions'}`)
    .replace(/\b(\d+) (marcos seguintes|marco seguinte)\b/g, (_, n: string) => `${n} more ${n === '1' ? 'milestone' : 'milestones'}`)
    .replace(/\b(\d+) (células|peças)\b/g, (_, n: string, what: string) => `${n} ${what === 'células' ? 'cells' : 'parts'}`)
    .replace(/\b(\d+) evento habilitado\b/g, '$1 enabled event')
    .replace(/\b(\d+) eventos habilitados\b/g, '$1 enabled events')
    .replace(/\b(\d+) condições ativas\b/g, '$1 active conditions')
    .replace(/\b(\d+) condição ativa\b/g, '$1 active condition')
    .replace(/\b(\d+) horas\b/g, '$1 hours')
    .replace(/\b(\d+) h simuladas\b/g, '$1 simulated h')
    .replace(/\b(\d+) (novas em reparo|saudáveis|expostas|infectadas|controladas|danificadas|removidas)\b/g, (_, n: string, state: string) => `${n} ${translateOne(state)}`);
  if (DICTIONARY[result]) result = DICTIONARY[result]!;
  for (const [portuguese, english] of PHRASES) {
    if (portuguese.length >= 8 && result.includes(portuguese)) result = result.replaceAll(portuguese, english);
  }
  return leading + result + trailing;
}

const TRANSLATABLE_ATTRIBUTES = ['aria-label', 'aria-valuetext', 'title', 'placeholder', 'alt'];

/** Localize the existing React view without changing deterministic engine data. */
export function localizeRoot(root: HTMLElement): () => void {
  if (locale === 'pt') return () => {};
  const textState = new WeakMap<Text, string>();
  const attributeState = new WeakMap<Element, Map<string, string>>();
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text;
      const old = textState.get(text);
      if (old === text.data) return;
      const result = translateText(text.data);
      textState.set(text, result);
      if (result !== text.data) text.data = result;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const saved = attributeState.get(element) ?? new Map<string, string>();
      for (const name of TRANSLATABLE_ATTRIBUTES) {
        const current = element.getAttribute(name);
        if (current === null || saved.get(name) === current) continue;
        const result = translateText(current);
        saved.set(name, result);
        if (result !== current) element.setAttribute(name, result);
      }
      attributeState.set(element, saved);
    }
  };
  const scan = (node: Node) => {
    visit(node);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) visit(walker.currentNode);
  };
  scan(root);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') visit(record.target);
      else if (record.type === 'attributes') visit(record.target);
      else for (const node of record.addedNodes) scan(node);
    }
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: TRANSLATABLE_ATTRIBUTES });
  return () => observer.disconnect();
}

export function setDocumentLocale(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = htmlLang;
  document.title = t('documentTitle');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('documentDescription'));
  persistLocale(locale);
  if (typeof history === 'undefined' || typeof location === 'undefined') return;
  if (normalizeLocale(readQuery()) === locale) return;
  history.replaceState(history.state, '', localeHref(locale, location.href));
}
