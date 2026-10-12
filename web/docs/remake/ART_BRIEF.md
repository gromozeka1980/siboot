# Ремейк: ТЗ на графику

Референсы оригинала (увеличенные без сглаживания) — `remake_art/refs/` (пересоздать: `python tools/remake_refs.py`).
Готовые файлы класть в `web/assets/remake/` под именами из таблиц ниже — игра подхватит их сама,
а для отсутствующих покажет оригинал. Формат: PNG (или WebP), sRGB.

## 1. Стиль (решить первым)

Генерировать **сначала одну Ветвел** в 3–4 вариантах стиля, выбрать один — и дальше все картинки делать
с ней как со стилевым референсом (в Midjourney `--sref`, в ChatGPT/Flux — «в том же стиле, что приложенная»).

Предлагаемый стиль (мой выбор по умолчанию):

> **Painterly sci‑fi folk illustration**: гуашь/масло поверх чёткого рисунка, как обложки фантастики
> 70–80‑х (Moebius, Jean Giraud, Ian Miller), насыщенные, но не кислотные цвета, сильный силуэт,
> мягкий направленный свет, фон — однотонный цветной, как в оригинале.

Почему: персонажи у Кроуфорда — странные, «рукотворные» инопланетяне; гладкий 3D‑рендер или аниме
убьют их. Важно сохранить **узнаваемость**: форму головы, глаза, цветовую гамму каждого персонажа
и цвет фона портрета — по ним игрок их различает.

Альтернативы, если не понравится: (б) HD pixel art 128×128 в духе современных инди;
(в) плоский векторный стиль с толстым контуром.

## 2. Портреты — главное (8 файлов)

Размер: **1024×1024**, квадрат, персонаж по грудь, смотрит на зрителя (кроме Кендры — в профиль, как
в оригинале), однотонный фон цвета оригинала. Файл: `web/assets/remake/portraits/<имя>.png`.
Загружать в модель вместе с референсом `remake_art/refs/portraits/<имя>.png` (img2img / «перерисуй»).

Общий хвост промпта (добавлять ко всем):
`… head and shoulders portrait, facing the viewer, plain flat background in <цвет>, painterly sci-fi
folk illustration, gouache over crisp ink drawing, 1980s science-fiction paperback cover style,
soft directional light, rich but not garish colours, strong readable silhouette, no text, no frame`

| файл | кто | промпт (начало) |
|------|-----|-----------------|
| `vetvel.png` | Ветвел, джомкар, женщина — **игрок** | `An alien woman of the Jomkar species: covered in long tan-golden fur that falls in layered shaggy tiers like a mantle, two curved horns, large octagonal pale eyes ringed like goggles, small dark nose, calm kind expression.` фон: `deep cobalt blue` |
| `kendra.png` | Кендра, класт, женщина, 22 | `An alien young woman of the Klast species, in profile: smooth pink-violet skin marbled with sky-blue patterns, a long backswept crest, a bony horn above a yellow duck-like bill, one big round curious eye, flighty and impulsive look.` фон: `grass green` |
| `gardbore.png` | Гардбор, фрем, мужчина, 43 | `An alien man of the Frem species: jackal-like head with huge pointed ears with orange inner markings, green scaly skin, large dark glossy eyes, a long snout ending in a round tubular mouth, aloof cynical expression.` фон: `deep wine red` |
| `wiki.png` | Вики, рипи, мужчина, 33 | `An alien man of the Ripi species: a black furry cat-like face, white whiskers, pale grey eyes, white muzzle, a wry humorous half-smile.` фон: `dark forest green` |
| `locksher.png` | Локшер, локвил, мужчина, 28 | `An alien man of the Lokweel species: a long horse-like crimson head with a mane of curly purple clouds of hair, a large calm eye, a charismatic confident look.` фон: `warm sand yellow` |
| `zubi.png` | Зуби, срол, женщина, 27 | `An alien woman of the Srol species: bald, a large dome-shaped head with bright blue skin, a fine dotted skin texture, wide-set white eyes, a nervous eager-to-please smile showing small teeth.` фон: `olive brown` |
| `skord.png` | Скордокотт, тайран, мужчина, 34 | `An alien man of the Tayran species: a long skeletal white beak-like skull full of sharp teeth, black skin markings, one piercing red eye, proud stern disciplined bearing.` фон: `turquoise` |
| `chris.png` | Крис Кроуфорд | **не генерировать** — это реальный человек (фото автора). Оставляем оригинал. |

## 3. Эмоции собеседника (этап 2, можно позже)

В оригинале настроение собеседника показывают 34 абстрактных лица (`refs/expressions/`).
В ремейке — сам портрет собеседника с выражением. Для каждого из 7 персонажей **10 вариантов**
(сделать с портретом как референсом персонажа, тот же ракурс и фон):
`web/assets/remake/expressions/<имя>/<эмоция>.png`, 1024×1024.

| эмоция (файл) | промпт‑добавка |
|---|---|
| `neutral` | `neutral expression` |
| `warm` | `warm friendly smile` |
| `love` | `affectionate, adoring look` |
| `trust` | `open, sincere, trusting look` |
| `suspicious` | `narrowed eyes, suspicious, distrustful` |
| `afraid` | `frightened, wide eyes` |
| `angry` | `furious, shouting` |
| `contempt` | `haughty, contemptuous sneer` |
| `sorry` | `apologetic, pleading, sad` |
| `curious` | `curious, asking, head slightly tilted` |

## 4. Места (7 домов + 3 сцены)

Размер **1920×1080**, без персонажей, без текста. Файл: `web/assets/remake/places/<файл>.png`.
Колония на луне Кира: глинобитные и каменные постройки, общая архитектура колонии, интерьер каждого
дома отражает вид и характер хозяина. Хвост промпта: `… interior, empty room, no people, painterly
sci-fi folk illustration (same style as reference), warm lantern light, 16:9`.

| файл | промпт (начало) |
|---|---|
| `home_vetvel.png` | `A cozy modest home of a kind, thrifty furry alien on a desert moon colony: woven rugs, shelves with jars, a low round table` |
| `home_kendra.png` | `A cluttered, colourful room of an impulsive young alien woman: scattered fabrics, half-finished crafts, bright paint` |
| `home_gardbore.png` | `An austere, dim study of a proud cynical old scholar alien: stacks of scrolls, locked chests, a single cold lamp` |
| `home_wiki.png` | `A cheerful messy den of a joking cat-like alien: pun-covered notes pinned to walls, cushions, tea pot` |
| `home_locksher.png` | `A spacious welcoming hall of a respected charismatic leader: long table, banners of the colony, many seats` |
| `home_zubi.png` | `A neat bright laboratory-like room of a brilliant insecure alien woman: instruments, star charts, careful order` |
| `home_skord.png` | `A spartan disciplined quarters of a stern bird-skulled warrior alien: weapon rack, bare stone, a single banner` |
| `road.png` | `A dusty path between adobe domes of a small alien colony on a desert moon, daytime, a giant ringed planet in the sky` |
| `night.png` | `The same colony at night under a huge planet and stars, glowing windows, mystical atmosphere` (фон ночного поединка) |
| `title.png` | `Key art: seven alien acolytes in silhouette facing a glowing figure of a shepherd under a giant planet, epic, mysterious` (место сверху под логотип) |

## 5. Иконки языка ияла — пока НЕ трогаем

127 иконок — это язык игры, игрок их учит. В первой версии ремейка оставляем оригинальные пиксельные
иконки (крупно и чётко) с подписями. Перерисовка — отдельный этап, когда будет утверждён стиль:
генерировать сетками по 16 с единым промптом, референсы — `refs/icons/`.

## 6. Ауры — сделаю сам (SVG)

Танага, кацин, шиал — геометрические символы, их лучше нарисовать вектором в коде.

## Права

Оригинальные персонажи и мир принадлежат правообладателю (Chris Crawford). Перерисовка по мотивам —
для личного проекта; для публичного распространения нужно разрешение.
