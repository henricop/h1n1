import { describe, expect, it } from 'vitest';
import { resolveLocale, translateText } from '../src/i18n';

describe('browser language presentation', () => {
  it('uses Portuguese only when it is the browser primary language', () => {
    expect(resolveLocale(['pt-BR', 'en-US'])).toBe('pt');
    expect(resolveLocale(['pt-PT'])).toBe('pt');
    expect(resolveLocale(['en-US', 'pt-BR'])).toBe('en');
    expect(resolveLocale(['es-ES'])).toBe('en');
    expect(resolveLocale([])).toBe('en');
    expect(resolveLocale(['en-US'], 'pt')).toBe('pt');
  });
  it('translates static, composed and model-generated text without changing the source', () => {
    expect(translateText('Corpo', 'en')).toBe('Body');
    expect(translateText('Corpo', 'pt')).toBe('Corpo');
    expect(translateText(' · roda/pinça para aproximar · partículas ilustrativas', 'en')).toBe(' · scroll/pinch to zoom · illustrative particles');
    expect(translateText('Último marco: dia 2, 5h · Atividade viral aumentou: Mucosa nasal', 'en')).toBe('Latest milestone: day 2, 5h · Viral activity increased: Nasal mucosa');
    expect(translateText('Mostrar o que aconteceu: Contato inicial na mucosa, Dia 0 · 00h', 'en')).toBe('See what happened: Initial contact in the mucosa, Day 0 · 00h');
    expect(translateText('Nesta região, a engine utilizou replicação de células infectadas; controle pela resposta de defesa local. Os índices são internos à simulação e não representam exames ou previsão individual.', 'en')).toBe('In this region, the model used replication by infected cells; control by local defense. These are internal simulation indices, not tests or individual predictions.');
  });
});
