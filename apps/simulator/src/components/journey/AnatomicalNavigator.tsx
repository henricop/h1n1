import { ANATOMY, LEVELS } from '../../journey/anatomy';
import type { AnatomyLevel, RegionId } from '../../journey/types';

export function AnatomicalNavigator({ level, regionId, onNavigate, onRegion }: { level: AnatomyLevel; regionId: RegionId; onNavigate: (level: AnatomyLevel) => void; onRegion: (id: RegionId) => void }) {
  return <aside className="atlas-navigation" aria-label="Navegação anatômica">
    <span className="atlas-kicker">Um corpo, cinco escalas</span>
    <nav aria-label="Escalas de exploração">{LEVELS.map((item, i) => <button key={item.id} className={level === item.id ? 'is-current' : ''} aria-current={level === item.id ? 'step' : undefined} onClick={() => onNavigate(item.id)}><span className="scale-number">0{i + 1}</span><span><strong>{item.name}</strong><small>{item.caption}</small></span><span className="scale-chevron" aria-hidden="true">›</span></button>)}</nav>
    <div className="anatomical-context"><label htmlFor="region">Região em foco</label><select id="region" aria-label="Região em foco" value={regionId} onChange={(event) => onRegion(event.target.value as RegionId)}>{ANATOMY.map((item) => <option key={item.regionId} value={item.regionId}>{item.shortName}</option>)}</select><p>{ANATOMY.find((entry) => entry.regionId === regionId)?.description}</p></div>
    <div className="atlas-scale-note"><span aria-hidden="true">↗</span><p>Explore por aproximação ou escolha uma escala. A região e o instante acompanham você.</p></div>
  </aside>;
}
