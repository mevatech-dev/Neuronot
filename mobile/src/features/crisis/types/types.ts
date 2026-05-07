export type HotlineEntry = { label: string; tel: string };
export type HotlinesByLocale = Record<string, HotlineEntry[]>;

export const hotlines: HotlinesByLocale = {
  tr: [
    { label: 'İntihar ve Krize Müdahale Hattı (İBB)', tel: '182' },
    { label: 'Polis İmdat', tel: '155' },
    { label: 'Acil Yardım', tel: '112' },
  ],
  en: [
    { label: '988 Suicide & Crisis Lifeline (US)', tel: '988' },
    { label: 'Emergency Services', tel: '911' },
  ],
  de: [
    { label: 'Telefonseelsorge', tel: '08001110111' },
    { label: 'Notruf', tel: '112' },
  ],
  fr: [
    { label: 'Numéro national de prévention du suicide', tel: '3114' },
    { label: 'Urgences', tel: '112' },
  ],
  es: [
    { label: 'Teléfono de la Esperanza', tel: '717003717' },
    { label: 'Emergencias', tel: '112' },
  ],
  pt: [
    { label: 'SOS Voz Amiga', tel: '213544545' },
    { label: 'Emergência', tel: '112' },
  ],
  it: [
    { label: 'Telefono Amico', tel: '0223272328' },
    { label: 'Emergenze', tel: '112' },
  ],
  ar: [{ label: 'Emergency', tel: '112' }],
  ru: [
    { label: 'Психологическая помощь', tel: '88002000122' },
    { label: 'Скорая', tel: '112' },
  ],
  ja: [
    { label: 'いのちの電話', tel: '0570064556' },
    { label: '緊急', tel: '110' },
  ],
  zh: [
    { label: '心理援助热线', tel: '8008101117' },
    { label: '紧急', tel: '110' },
  ],
};
