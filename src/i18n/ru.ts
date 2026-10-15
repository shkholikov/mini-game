/** All Russian text and voice lines. Voice files are generated from VOICE by `pnpm voice`. */

export const TEXT = {
  title: 'Осман и Сафия',
  osman: 'Осман',
  safia: 'Сафия',
} as const;

export const ANIMALS = {
  rabbit: { name: 'Зайчик', sound: 'Хрум-хрум!' },
  monkey: { name: 'Обезьянка', sound: 'У-у-а-а!' },
  panda: { name: 'Панда', sound: 'Ням-ням!' },
  elephant: { name: 'Слоник', sound: 'Ту-ру-ру!' },
  giraffe: { name: 'Жираф', sound: 'Ммм, вкусно!' },
  parrot: { name: 'Попугай', sound: 'Привет! Привет!' },
  penguin: { name: 'Пингвин', sound: 'Буль-буль!' },
  pig: { name: 'Хрюшка', sound: 'Хрю-хрю!' },
  hippo: { name: 'Бегемотик', sound: 'Ам-ам!' },
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

export const CAR_COLORS = {
  red: 'Красная машина!',
  blue: 'Синяя машина!',
  green: 'Зелёная машина!',
  yellow: 'Жёлтая машина!',
  black: 'Чёрная машина!',
} as const;

export const TRACKS = {
  city: 'Городская трасса!',
  forest: 'Лесная трасса!',
  desert: 'Пустыня!',
} as const;

export type AnimalId = keyof typeof ANIMALS;
export type FruitId = keyof typeof FRUITS;
export type CarColor = keyof typeof CAR_COLORS;
export type TrackId = keyof typeof TRACKS;

const NUMBERS = [
  'Один',
  'Два',
  'Три',
  'Четыре',
  'Пять',
  'Шесть',
  'Семь',
  'Восемь',
  'Девять',
  'Десять',
  'Одиннадцать',
  'Двенадцать',
  'Тринадцать',
  'Четырнадцать',
  'Пятнадцать',
  'Шестнадцать',
  'Семнадцать',
  'Восемнадцать',
  'Девятнадцать',
  'Двадцать',
  'Двадцать один',
  'Двадцать два',
  'Двадцать три',
  'Двадцать четыре',
  'Двадцать пять',
  'Двадцать шесть',
  'Двадцать семь',
  'Двадцать восемь',
  'Двадцать девять',
  'Тридцать',
];
export const MAX_SPOKEN_NUMBER = NUMBERS.length;

function build(): Record<string, string> {
  const v: Record<string, string> = {
    who_plays: 'Кто играет? Осман или Сафия?',
    hi_osman: 'Осман, поехали на гонки!',
    hi_safia: 'Сафия, давай покормим зверят!',
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
    stars: 'Ты собрал звёзд:',
    cup: 'Кубок твой! Молодец, Осман!',
  };
  NUMBERS.forEach((n, i) => (v[`num_${i + 1}`] = `${n}!`));
  for (const [id, a] of Object.entries(ANIMALS)) {
    v[`snd_${id}`] = a.sound;
    for (const [fid, f] of Object.entries(FRUITS))
      v[`want_${id}_${fid}`] = `${a.name} хочет ${f.acc}!`;
  }
  for (const [id, f] of Object.entries(FRUITS)) v[`fruit_${id}`] = `${f.nom}!`;
  for (const [id, t] of Object.entries(CAR_COLORS)) v[`car_${id}`] = t;
  for (const [id, t] of Object.entries(TRACKS)) v[`track_${id}`] = t;
  return v;
}

export const VOICE = build();
