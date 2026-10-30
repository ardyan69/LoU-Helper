// Store-listing texts of the extension (manifest name / description). The description is translated like any
// UI text (key = Indonesian source in lib/i18n/<lang>.js); tools/gen-docs.mjs writes _locales/<lang>/messages.json.
const mark = (s) => s; // marks a text for the translation check (tools/i18n.mjs)

export const APP_NAME = 'LoU Revival Helper';
export const APP_SHORT_NAME = 'LoU Helper';
export const APP_DESCRIPTION = mark('Ringkasan kota, perencana layout, pasukan, dungeon & minister untuk Lord of Ultima: Revival. Dibuat oleh ardhie.');
// browser stores show at most 132 characters
export const DESCRIPTION_MAX = 132;
