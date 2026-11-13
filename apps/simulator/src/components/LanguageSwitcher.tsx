import { locale, selectLocale, t } from '../i18n';

/** Compact PT-BR / EN control. The choice is saved and reflected in `?lang=`. */
export function LanguageSwitcher() {
  return <div className="lab-lang" role="group" aria-label={t('language')}>
    <button type="button" lang="pt-BR" aria-pressed={locale === 'pt'} aria-label={t('portuguese')} onClick={() => selectLocale('pt')}>PT-BR</button>
    <button type="button" lang="en" aria-pressed={locale === 'en'} aria-label={t('english')} onClick={() => selectLocale('en')}>EN</button>
  </div>;
}
