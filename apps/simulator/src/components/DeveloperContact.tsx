import { t } from '../i18n';

export function DeveloperContact() {
  return <span className="lab-developer-contact">
    <span>{t('developedBy')} Henrico Piubello.</span>{' '}
    <a href="https://github.com/henricop" target="_blank" rel="noopener noreferrer" aria-label={t('contactDeveloper')}>
      {t('contact')} <span aria-hidden="true">↗</span>
    </a>
  </span>;
}
