/** All Russian text and voice lines. Voice files are generated from VOICE by `pnpm voice`. */

export const TEXT = {
  title: 'Осман, Сафия и Умар',
  osman: 'Осман',
  safia: 'Сафия',
  umar: 'Умар',
  rotateTitle: 'Поверните экран',
  rotateSub: 'Игра работает только горизонтально',
  garage: 'Гараж',
  finish: 'Финиш!',
  go: ['На старт!', 'Внимание!', 'Марш!'],
  tracks: { city: 'Город', forest: 'Лес', desert: 'Пустыня' },
  // parent panel in Умар's tractor mode (adults read these, not the kids)
  parentSong: 'Песня',
  parentNoSong: 'Убрать песню',
  parentSongOn: 'Песня есть',
  parentSongOff: 'Песни нет',
} as const;

export const ANIMALS = {
  cow: { name: 'Коровка', sound: 'Му-у-у!' },
  chick: { name: 'Цыплёнок', sound: 'Пи-пи-пи!' },
  cat: { name: 'Котик', sound: 'Мяу!' },
  dog: { name: 'Собачка', sound: 'Гав-гав!' },
  bunny: { name: 'Зайчик', sound: 'Хрум-хрум!' },
  monkey: { name: 'Обезьянка', sound: 'У-у-а-а!' },
  panda: { name: 'Панда', sound: 'Ням-ням!' },
  elephant: { name: 'Слоник', sound: 'Ту-ру-ру!' },
  giraffe: { name: 'Жираф', sound: 'Ммм, вкусно!' },
} as const;

/** nom = "Это …", acc = "… хочет …" */
export const FRUITS = {
  apple: { nom: 'Яблоко', acc: 'яблоко' },
  banana: { nom: 'Банан', acc: 'банан' },
  strawberry: { nom: 'Клубника', acc: 'клубнику' },
  orange: { nom: 'Апельсин', acc: 'апельсин' },
  grapes: { nom: 'Виноград', acc: 'виноград' },
  pear: { nom: 'Груша', acc: 'грушу' },
  watermelon: { nom: 'Арбуз', acc: 'арбуз' },
  cherries: { nom: 'Вишня', acc: 'вишню' },
  carrot: { nom: 'Морковка', acc: 'морковку' },
} as const;

export const CAR_MODELS = {
  race: 'Гоночная машина!',
  police: 'Полиция! Виу-виу!',
  firetruck: 'Пожарная машина!',
  ambulance: 'Скорая помощь!',
  taxi: 'Такси!',
} as const;

export const TRACKS = {
  city: 'Городская трасса!',
  forest: 'Лесная трасса!',
  desert: 'Пустыня!',
} as const;

export type AnimalId = keyof typeof ANIMALS;
export type FruitId = keyof typeof FRUITS;
export type CarModel = keyof typeof CAR_MODELS;
export type TrackId = keyof typeof TRACKS;

const UNITS = ['', 'одну', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const TEENS = [
  'десять',
  'одиннадцать',
  'двенадцать',
  'тринадцать',
  'четырнадцать',
  'пятнадцать',
  'шестнадцать',
  'семнадцать',
  'восемнадцать',
  'девятнадцать',
];
const TENS = ['', '', 'двадцать', 'тридцать'];

/** "Ты собрал семь звёзд!" with the right number words and noun form (звезду / звезды / звёзд). */
export function starsSentence(n: number): string {
  const words =
    n < 10
      ? UNITS[n]
      : n < 20
        ? TEENS[n - 10]
        : [TENS[Math.floor(n / 10)], UNITS[n % 10]].filter(Boolean).join(' ');
  const last = n % 10;
  const teen = n % 100 >= 11 && n % 100 <= 14;
  const noun =
    !teen && last === 1 ? 'звезду' : !teen && last >= 2 && last <= 4 ? 'звезды' : 'звёзд';
  return `Ты собрал ${words} ${noun}!`;
}

/** Star counts with their own spoken sentence; more stars are announced as this many. */
export const MAX_SPOKEN_NUMBER = 30;

function build(): Record<string, string> {
  const v: Record<string, string> = {
    who_plays: 'Кто играет? Осман, Сафия или Умар?',
    hi_osman: 'Осман, поехали на гонки!',
    hi_safia: 'Сафия, давай покормим зверят!',
    hi_umar: 'Умар, поехали на тракторе!',
    // Сафия
    yum: 'Ням-ням! Спасибо!',
    yum_safia: 'Вкусно! Спасибо, Сафия!',
    want_other: 'Хм... Я хочу другое!',
    hint: 'Вот это! Посмотри!',
    all_fed: 'Ура! Все зверята сыты! Молодец, Сафия!',
    // Осман
    garage: 'Выбери машину!',
    pick_track: 'Выбери трассу!',
    ready: 'На старт! Внимание! Марш!',
    boost: 'Турбо!',
    oops: 'Ой! Осторожно!',
    overtake: 'Обогнал!',
    finish: 'Финиш! Ты первый!',
    cup: 'Кубок твой! Молодец, Осман!',
    // Умар
    bibi: 'Би-би!',
    peek: 'Кто там прячется?',
    kuku: 'Ку-ку!',
  };
  for (let n = 1; n <= MAX_SPOKEN_NUMBER; n++) v[`stars_${n}`] = starsSentence(n);
  for (const [id, a] of Object.entries(ANIMALS)) {
    v[`snd_${id}`] = a.sound;
    v[`name_${id}`] = `${a.name}!`;
    for (const [fid, f] of Object.entries(FRUITS))
      v[`want_${id}_${fid}`] = `${a.name} хочет ${f.acc}!`;
  }
  for (const [id, f] of Object.entries(FRUITS)) v[`fruit_${id}`] = `${f.nom}!`;
  for (const [id, t] of Object.entries(CAR_MODELS)) v[`car_${id}`] = t;
  for (const [id, t] of Object.entries(TRACKS)) v[`track_${id}`] = t;
  return v;
}

export const VOICE = build();
