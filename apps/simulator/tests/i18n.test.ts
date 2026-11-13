import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { localeHref, normalizeLocale, resolveLocale, t, translateText } from '../src/i18n';

describe('language choice', () => {
  it('prefers a shared link, then a saved choice, then the browser, and otherwise Portuguese', () => {
    expect(resolveLocale({ languages: ['pt-BR', 'en-US'] })).toBe('pt');
    expect(resolveLocale({ languages: ['pt-PT'] })).toBe('pt');
    expect(resolveLocale({ languages: ['en-US', 'pt-BR'] })).toBe('en');
    expect(resolveLocale({ languages: ['en'] })).toBe('en');
    expect(resolveLocale({ languages: ['es-ES'] })).toBe('pt');
    expect(resolveLocale({})).toBe('pt');
    expect(resolveLocale({ languages: ['en-US'], stored: 'pt' })).toBe('pt');
    expect(resolveLocale({ languages: ['pt-BR'], query: 'en', stored: 'pt' })).toBe('en');
    expect(resolveLocale({ query: 'pt-BR' })).toBe('pt');
    expect(resolveLocale({ query: 'en-US' })).toBe('en');
    expect(normalizeLocale('fr')).toBeNull();
  });

  it('builds a shareable address without dropping the rest of the query', () => {
    expect(localeHref('en', '/')).toBe('/?lang=en');
    expect(localeHref('pt', '/explorar?renderer=webgl#lab-timeline')).toBe('/explorar?renderer=webgl&lang=pt#lab-timeline');
  });

  it('requires both languages for chrome copy', () => {
    expect(t('documentTitle', 'pt')).toBe('H1N1 · Jornada da Infecção');
    expect(t('documentTitle', 'en')).toBe('H1N1 · Infection Journey');
    expect(t('language', 'en')).toBe('Language');
  });
});

describe('english presentation', () => {
  it('translates static, composed and model-generated text without changing the source', () => {
    expect(translateText('Corpo', 'en')).toBe('Body');
    expect(translateText('Corpo', 'pt')).toBe('Corpo');
    expect(translateText(' · roda/pinça para aproximar · partículas ilustrativas', 'en')).toBe(' · scroll/pinch to zoom · illustrative particles');
    expect(translateText('Último marco: dia 2, 5h · Atividade viral aumentou: Mucosa nasal', 'en')).toBe('Latest milestone: day 2, 5h · Viral activity increased: Nasal mucosa');
    expect(translateText('Mostrar o que aconteceu: Contato inicial na mucosa, Dia 0 · 00h', 'en')).toBe('See what happened: Initial contact in the mucosa, Day 0 · 00h');
    expect(translateText('Nesta região, a engine utilizou replicação de células infectadas; controle pela resposta de defesa local. Os índices são internos à simulação e não representam exames ou previsão individual.', 'en')).toBe('In this region, the model used replication by infected cells; control by local defense. These are internal simulation indices, not tests or individual predictions.');
    expect(translateText('Ritmo viral do cenário B ajustado para 1.5 vezes a partir da próxima hora.', 'en')).toBe('Scenario B viral pace set to 1.5× from the next hour.');
    expect(translateText('Mucosa nasal · dia 3, 4 h', 'en')).toBe('Nasal mucosa · day 3, 4 h');
    expect(translateText('de 14 dias', 'en')).toBe('14 days');
    expect(translateText('geração 2', 'en')).toBe('generation 2');
    expect(translateText('event:viral-control-25', 'en')).toBe('Scenario event');
    expect(translateText('Pulmão direito', 'en')).toBe('Right lung');
    expect(translateText('Alta', 'en')).toBe('High');
    expect(translateText('Regiões', 'en')).toBe('Regions');
    expect(translateText('Preparando a escala microscópica…', 'en')).toBe('Preparing the microscopic scale…');
    expect(translateText('Estruturas de sustentação e proteção. Oculte os músculos para observar os ossos e suas relações.', 'en')).toBe('Supporting and protective structures. Hide the muscles to see the bones and how they relate.');
  });

  it('covers Portuguese copy that is rendered on the public site', () => {
    const root = join(import.meta.dirname, '../src');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(name) && !path.endsWith(`${join('src', 'i18n.ts')}`)) files.push(path);
      }
    };
    walk(root);
    const skip = new Set([
      'LegacyMicroApp.tsx',
    ]);
    const missing: string[] = [];
    const literal = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    for (const file of files) {
      if (skip.has(file.split('/').pop() ?? '')) continue;
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(literal)) {
        const value = match[2]?.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');
        if (!value || value.length < 3 || value.includes('${') || !/[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(value)) continue;
        if (value.startsWith('http') || value.includes('/') && !value.includes(' ')) continue;
        if (translateText(value, 'en') === value) missing.push(`${file.split('/src/')[1]}: ${value}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
