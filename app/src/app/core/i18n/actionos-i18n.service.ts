import { Injectable, signal } from '@angular/core';

export type ActionosLanguage = 'en' | 'he';
type TranslationValue = string | TranslationDictionary;

interface TranslationDictionary {
  [key: string]: TranslationValue;
}

@Injectable({ providedIn: 'root' })
export class ActionosI18nService {
  private readonly storageKey = 'actionos.language';
  private readonly languageState = signal<ActionosLanguage>('en');
  private readonly dictionaryState = signal<TranslationDictionary>({});

  readonly languages: { code: ActionosLanguage; label: string; nativeLabel: string }[] = [
    { code: 'en', label: 'English', nativeLabel: 'English' },
    { code: 'he', label: 'Hebrew', nativeLabel: 'עברית' }
  ];

  get language(): ActionosLanguage {
    return this.languageState();
  }

  get direction(): 'ltr' | 'rtl' {
    return this.language === 'he' ? 'rtl' : 'ltr';
  }

  async init(): Promise<void> {
    const savedLanguage = this.readSavedLanguage();
    await this.setLanguage(savedLanguage, false);
  }

  async setLanguage(language: ActionosLanguage, persist = true): Promise<void> {
    const dictionary = await this.loadDictionary(language);

    this.dictionaryState.set(dictionary);
    this.languageState.set(language);
    this.applyDocumentDirection(language);

    if (persist) {
      localStorage.setItem(this.storageKey, language);
    }
  }

  translate(key: string, params: Record<string, string | number> = {}): string {
    const dictionary = this.dictionaryState();
    const value = this.lookup(dictionary, key);
    const text = typeof value === 'string' ? value : key;

    return Object.entries(params).reduce(
      (result, [paramKey, paramValue]) => result.replaceAll(`{{${paramKey}}}`, String(paramValue)),
      text
    );
  }

  private async loadDictionary(language: ActionosLanguage): Promise<TranslationDictionary> {
    try {
      const response = await fetch(`i18n/${language}.json`, { cache: 'no-cache' });

      if (!response.ok) {
        throw new Error(`Missing translation file for ${language}`);
      }

      return await response.json() as TranslationDictionary;
    } catch {
      if (language !== 'en') {
        return this.loadDictionary('en');
      }

      return {};
    }
  }

  private lookup(dictionary: TranslationDictionary, key: string): TranslationValue | undefined {
    return key.split('.').reduce<TranslationValue | undefined>((current, segment) => {
      if (!current || typeof current === 'string') {
        return undefined;
      }

      return current[segment];
    }, dictionary);
  }

  private readSavedLanguage(): ActionosLanguage {
    const saved = localStorage.getItem(this.storageKey);

    return saved === 'he' ? 'he' : 'en';
  }

  private applyDocumentDirection(language: ActionosLanguage): void {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
    document.body.classList.toggle('rtl', language === 'he');
  }
}
