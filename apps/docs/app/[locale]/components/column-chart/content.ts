import type { Locale } from "@/i18n/routing";
import type { Rich } from "@/lib/rich-text";

/**
 * Column Chart page content, both locales. TypeScript enforces structural
 * parity (drift-guard v1); the EN-hash manifest enforces freshness (v2).
 * RU: draft — awaiting founder proofread (см. docs/glossary-ru.md).
 *
 * Prop NAMES/types/defaults stay in page.tsx (technical, never translated);
 * only the human descriptions live here.
 */
export type ColumnChartPageContent = {
  kicker: string;
  title: string;
  intro: string;
  studio: { title: string; lead: string };
  installation: string;
  usage: string;
  props: { title: string; descriptions: Record<string, string> };
  table: { name: string; type: string; default: string; description: string };
  a11y: {
    title: string;
    intro: Rich;
    /**
     * Honest limitation note (RU only for now): the component auto-generates
     * its ARIA descriptions in English — Russian products must pass their own
     * `description` until the component grows a locale pack.
     */
    localeNote: string | null;
    keyboardTitle: string;
    keyboard: { key: string; action: string }[];
    srTitle: string;
    srItems: Rich[];
  };
  designMoves: { title: string; items: Rich[] };
  whenTo: { title: string; body: string };
  whenNot: { title: string; body: string };
  inspiredBy: { title: string; items: Rich[] };
};

const en: ColumnChartPageContent = {
  kicker: "Charts · Column Chart",
  title: "Column Chart",
  intro:
    "Vertical bars for ordered categories — time buckets or ranked categories. Data-ink discipline (Tufte) — one accent, no gridlines, monospace numerics, direct value labels by default. Built-in source attribution and ASCII empty state.",
  studio: {
    title: "Studio · Code, chart, settings",
    lead: "Three-panel workbench. Tweak any setting on the right — chart in the middle updates live and the code on the left regenerates ready to paste into your app.",
  },
  installation: "Installation",
  usage: "Usage",
  props: {
    title: "Props",
    descriptions: {
      data: "Bar values. Two forms: number[] (with labels prop) or { key?, label?, value, meta?, pattern?, color?, highlight?, note? }[] (object form). key = stable address for annotations/focusBar (defaults to label); meta = your payload, returned untouched in every callback; negatives render below the zero baseline. The synthetic 'Other' bar carries isOther + items[] (output-only)",
      sort: "Reorder bars by value (stable). 'none' preserves input order — the honest default for time buckets; asc/desc turns the chart into a ranking",
      topN: "Keep the N largest bars, roll the tail into one 'Other' aggregate (summed). Defaults: pinned last regardless of sort, muted --brock-other fill. Callbacks receive isOther + the collapsed items[]. Number shorthand = all defaults",
      labels:
        "X-axis labels (rendered in pixel font under bars + in hover tooltip). Only used when data is number[]",
      height: "Chart height in pixels (Y-axis + bars area)",
      gap: "Gap between bars in pixels. Auto-shrinks for dense datasets (60+ bars)",
      accent:
        "Override the bar fill color (any CSS color or var). Defaults to Brock orange",
      barRadius:
        "Top-corner radius in px. Common values: 0 (sharp), 2 (subtle), 6 (rounded)",
      header: "Title + subtitle block above the chart",
      xAxis: "X-axis configuration (title below ticks, hide tick labels)",
      yAxis:
        "Y-axis configuration. There is deliberately no min — a column chart's baseline is always zero (truncated bars lie). max is extend-only headroom: values below the data max are ignored with a dev warning",
      numberFormat:
        "Number formatter applied to Y-axis, tooltip, and data labels. Supports BCP-47 locale, Intl.NumberFormat notation ('compact' → 1.2K), style ('currency' / 'percent'), and ISO 4217 currency. Explicit formatValue/yAxisFormat win",
      dataLabels:
        "Direct value labels at each bar's outer end (Hack mono; mirrored below negative bars). 'auto' (the default) shows labels AND hides the Y axis when the chart has <= 8 bars — redundant ink once every value is printed. Explicit yAxis.hideTicks wins. format(value, datum) overrides numberFormat",
      pattern:
        "Default fill pattern for all bars. Per-point pattern on a data point wins over this. Hatched encodes historical/estimated/in-progress without spending a second color (Tufte)",
      hatchUntilIndex:
        "Convenience: bars with INPUT index < N render hatched (applied before sort/topN — the pattern travels with its datum). Classic historical-vs-projected encoding",
      hatchFromIndex:
        "Mirror of hatchUntilIndex: bars with index >= N render hatched. Useful for forecast bands and 'last N hatched' patterns. Combinable with hatchUntilIndex (union)",
      patternStyle:
        "Visual style of hatched bars (chart-level). Per-bar pattern still controls whether a bar is hatched; this controls how each hatched bar looks. Use 'dots' for grayscale/print",
      scroll:
        "Overflow behavior when bars don't fit. 'auto' enables horizontal scroll; Y-axis pins to the left while bars + X-axis scroll together",
      minBarWidth:
        "Minimum px per bar. Used with scroll='auto' to decide chart min-width: N*minBarWidth + (N-1)*gap. Ignored when scroll='none'",
      bands:
        "Plot bands — highlighted vertical zones over a range of DISPLAY positions. Editorial pattern ('Q3', 'deployment window'). Render behind bars at low opacity; indices clamp to the data range. Bands assume input order — combining bands with sort dev-warns (a 'Q3' zone is meaningless after re-ranking)",
      trend:
        "Decimal trend indicator e.g. 0.184 → ↗ +18.4%. Orange if positive, muted if negative",
      referenceLine:
        "Dashed reference line — a fixed threshold ('Q3 target') or a computed statistic over the ORIGINAL input data (sort/topN must not move a statistic). Stats auto-label Mean/Median. Participates in the scale on both sides, so negative and break-even (0) references stay visible",
      source: "Attribution line rendered below the chart (FT pattern)",
      animation:
        "Staggered bar-rise on mount. Disabled automatically when prefers-reduced-motion is set",
      loading:
        "Loading state. With no data → full skeleton (dashed ghost bars + LOADING badge, ARIA role=status). With data → dim overlay on top of the chart for background refresh. Honors prefers-reduced-motion",
      error:
        "Terminal error state. Replaces the chart even when data is present (stale data next to an error is misleading). Accepts an Error, a string message, or null. ARIA role=alert",
      onRetry:
        "Callback for the retry button in the default error state. The button is rendered only when this prop is provided",
      loadingLabel:
        "Label rendered next to the LOADING badge and used as the ARIA label for the skeleton state. Override for localization",
      errorLabel:
        "Label rendered above the error message and used as the ARIA label. Override for localization",
      retryLabel:
        "Label of the retry button in the default error state. Override for localization",
      loadingFallback:
        "Full override of the default skeleton + overlay UI. Use for a custom-branded loading experience",
      errorFallback:
        "Full override of the default error UI. May be a React node or a function that receives the normalized Error",
      exportable:
        "Show the export toolbar (top-right). true = all 4 actions; object form = enable specific ones. Imperative ref methods always work regardless",
      exportFileName:
        "Base file name for downloads. String for fixed, function for per-format. Right extension (.png/.svg/.csv) auto-appended",
      onExport:
        "Fires after an export completes. Receives format ('png'|'svg'|'csv'|'copy') and the artifact (Blob for png/copy, string for svg/csv). Useful for analytics or custom share flows",
      ref: "Imperative API: { exportSVG, exportPNG, exportCSV, copyImage, focusBar, getSelection }. Export methods work even in loading/error/empty. focusBar(target) takes a display index (clamped) OR a stable key string (unknown key → -1). getSelection() returns { index (display), key (stable), point } or null",
      onBarClick:
        "Fires on click, tap, or Enter/Space on a focused bar. Event is a MouseEvent or KeyboardEvent. Adds cursor-pointer to bars when provided",
      onBarHover:
        "Fires on mouse enter (point + index) and on leave of the bars area (null, null). Sync custom legends / detail panels with the hovered datum",
      onBarFocus:
        "Fires on keyboard focus changes between bars (arrow keys, Home/End, Tab in, and programmatic focusBar()). Tracks the roving-tabindex position",
      slots:
        "Headless slot dictionary. Each slot replaces a default sub-component: tooltip (per-bar), empty (no data), loading (skeleton), error (terminal), toolbar (export chips), caption (below source), watermark (figure overlay). Each slot receives typed props. Slots win over loadingFallback / errorFallback shortcuts",
      caption:
        "Short editorial caption — italic muted text with left border, rendered below the source line. FT/Stripe-Letters print-margin pattern. slots.caption wins over this",
      watermark:
        "Diagonal watermark text — faint pixel-font overlay (≈6% opacity) over the chart. A document-lifecycle marker (DRAFT, CONFIDENTIAL) — not branding (use source for attribution). Deliberately KEPT in print: a confidential paper report must carry its marking. slots.watermark wins over this",
      annotations:
        "Free-floating editorial annotations at (x, y) in data space. x: number = INPUT index (travels with its datum through sort/topN; dropped with a dev warning if that datum collapses into 'Other') or string = key/label match. y may be negative. { x, y, text, anchor?, arrow?, color? }; dashed connector optional. Reproduced in the SVG / PNG export",
      chartType:
        "Machine-readable identifier stamped on the figure as data-chart-type. Included in toJSON() output. AI/LLM tooling + analytics use it to reason about the chart shape",
      dataDescription:
        "Natural-language description of the data ('Daily active users, last 7 days'). Stamped as data-description. For AI prompts and editorial provenance. Distinct from `description` (which is the screen-reader auto-label)",
      "data-testid":
        "QA selector hook forwarded to the figure. Stable across className refactors — Testing Library / Playwright convention",
      description:
        "Accessible description for screen readers (figcaption + table caption). Defaults to 'Column chart with N data points. Source: ...'",
      formatValue:
        "Custom value formatter for tooltips, data labels, and the sr-only table. Receives the datum as a second argument (key, meta, isOther…) for context-aware formatting. Wins over numberFormat",
      yAxisFormat:
        "Format function for Y-axis tick labels. Wins over numberFormat",
    },
  },
  table: {
    name: "Name",
    type: "Type",
    default: "Default",
    description: "Description",
  },
  a11y: {
    title: "Accessibility",
    intro: [
      "Built to WCAG 2.2 AA. Keyboard navigable, screen-reader friendly, honors ",
      { code: "prefers-reduced-motion" },
      ".",
    ],
    localeNote: null,
    keyboardTitle: "Keyboard",
    keyboard: [
      { key: "Tab", action: "Move focus into the chart (single tab stop)" },
      { key: "← → ↑ ↓", action: "Navigate between bars (roving tabindex)" },
      { key: "Home", action: "Jump to first bar" },
      { key: "End", action: "Jump to last bar" },
    ],
    srTitle: "Screen reader markup",
    srItems: [
      [
        { code: '<figure role="figure">' },
        " wraps the chart with an ",
        { code: "aria-labelledby" },
        " pointing to the figcaption",
      ],
      [
        "Each bar uses ",
        { code: 'role="graphics-symbol"' },
        " with ",
        { code: 'aria-label="LABEL: value"' },
      ],
      [
        "A visually-hidden ",
        { code: '<table class="sr-only">' },
        " provides a tabular data summary (caption + rows for each data point)",
      ],
      [
        "Trend indicator gets a human-readable label (“Trend up 18.4 percent”) — arrows are aria-hidden",
      ],
    ],
  },
  designMoves: {
    title: "Design moves",
    items: [
      [
        "Monospace Y-axis numbers + tabular-nums (Hack font) — values align by digit width.",
      ],
      [
        "Single ",
        { code: "--brock-accent" },
        " (orange) for all bars — both sides of zero. No gradient, no glow, no palette coding; per-bar ",
        { code: "color" },
        " is reserved for single editorial exceptions (the anomaly, the current period).",
      ],
      ["No gridlines. Single 1px baseline at zero (Tufte data-ink)."],
      [
        "Hover-tooltip with value in Hack mono + period in Departure Mono pixel-font badge.",
      ],
      [
        "Staggered entry animation (30ms cascade, scale-Y from baseline). Disabled on ",
        { code: "prefers-reduced-motion" },
        ".",
      ],
      [
        "Built-in ",
        { code: "source" },
        " prop renders FT/Bloomberg-style attribution line below the chart.",
      ],
      [
        "ASCII empty state (",
        { code: "▒▒▒ no data" },
        ") when the dataset is empty; full state machine via ",
        { code: "loading" },
        " / ",
        { code: "error" },
        " (skeleton, refresh overlay, retry) in the same visual language.",
      ],
    ],
  },
  whenTo: {
    title: "When to use",
    body: "Column Chart fits ordered categories where each bar is a discrete bucket: temporal (hours, days, weeks, agent calls per minute) or ranked (traffic by channel via sort + topN, revenue by region, profit/loss by month — negatives are first-class). Best for showing volume, count, or activity rhythm at a glance with sparse axes that don’t compete with the data.",
  },
  whenNot: {
    title: "When not to use",
    body: "For continuous trends use Line Chart. For tiny embedded charts inside metric cards or prose use Sparkline. For categorical ranking with long labels (horizontal bars) use Bar Chart (coming soon). For composition over time use Stacked Column Chart (coming soon).",
  },
  inspiredBy: {
    title: "Inspired by",
    items: [
      [
        "Financial Times Visual Journalism — sparse axes, source-line attribution, single-color bars",
      ],
      ["Stripe Annual Letters — inline numerics in editorial flow"],
      ["The Pudding — interactive storytelling with restraint"],
      [
        "Edward Tufte, The Visual Display of Quantitative Information — data-ink discipline",
      ],
    ],
  },
};

const ru: ColumnChartPageContent = {
  kicker: "Графики · Column Chart",
  title: "Column Chart",
  intro:
    "Вертикальные столбцы для упорядоченных категорий — временных интервалов или рейтингов. Дисциплина data-ink (Тафти): один акцент, без сетки, моноширинные цифры, прямые подписи значений по умолчанию. Встроенная строка источника и ASCII-состояние «нет данных».",
  studio: {
    title: "Studio · Код, график, настройки",
    lead: "Трёхпанельный верстак. Меняйте любую настройку справа — график в центре обновляется вживую, а код слева перегенерируется, готовый к вставке в ваш проект.",
  },
  installation: "Установка",
  usage: "Использование",
  props: {
    title: "Пропы",
    descriptions: {
      data: "Значения столбцов. Две формы: number[] (с пропом labels) или { key?, label?, value, meta?, pattern?, color?, highlight?, note? }[] (объектная форма). key — стабильный адрес для аннотаций и focusBar (по умолчанию label); meta — ваши данные, возвращаются нетронутыми в каждом коллбэке; отрицательные значения рендерятся ниже нулевой базы. Синтетический столбец «Other» несёт isOther + items[] (только на выходе)",
      sort: "Сортировка столбцов по значению (стабильная). 'none' сохраняет исходный порядок — честный дефолт для временных интервалов; asc/desc превращает график в рейтинг",
      topN: "Оставить N крупнейших столбцов, свернув хвост в один агрегат «Other» (сумма). По умолчанию: закреплён последним независимо от sort, приглушённая заливка --brock-other. Коллбэки получают isOther + свёрнутые items[]. Число = все дефолты",
      labels:
        "Подписи оси X (пиксельный шрифт под столбцами + в тултипе). Используются только при data: number[]",
      height: "Высота графика в пикселях (ось Y + область столбцов)",
      gap: "Зазор между столбцами в пикселях. Сужается автоматически на плотных данных (60+ столбцов)",
      accent:
        "Переопределение цвета заливки (любой CSS-цвет или var). По умолчанию — оранжевый Brock",
      barRadius:
        "Радиус верхних углов в px. Типичные значения: 0 (острые), 2 (едва заметный), 6 (скруглённые)",
      header: "Блок заголовка и подзаголовка над графиком",
      xAxis:
        "Настройка оси X (заголовок под подписями, скрытие подписей делений)",
      yAxis:
        "Настройка оси Y. min намеренно отсутствует — база столбчатого графика всегда ноль (обрезанные столбцы лгут). max только расширяет шкалу: значения ниже максимума данных игнорируются с предупреждением в dev",
      numberFormat:
        "Форматирование чисел для оси Y, тултипа и подписей значений. Поддерживает локаль BCP-47, notation Intl.NumberFormat ('compact' → 1,2 тыс.), style ('currency' / 'percent') и валюту ISO 4217. Явные formatValue/yAxisFormat сильнее",
      dataLabels:
        "Прямые подписи значений у внешнего конца каждого столбца (Hack mono; у отрицательных — зеркально снизу). 'auto' (дефолт) показывает подписи И скрывает ось Y при ≤ 8 столбцах — ось избыточна, когда каждое значение напечатано. Явный yAxis.hideTicks сильнее. format(value, datum) переопределяет numberFormat",
      pattern:
        "Заливка всех столбцов по умолчанию. Per-bar pattern на точке данных сильнее. Штриховка кодирует «историческое/оценка/в работе» без второго цвета (Тафти)",
      hatchUntilIndex:
        "Шорткат: столбцы с ИСХОДНЫМ индексом < N штрихуются (применяется до sort/topN — паттерн едет со своим датумом). Классическое «факт vs прогноз»",
      hatchFromIndex:
        "Зеркало hatchUntilIndex: штрихуются столбцы с индексом >= N. Удобно для прогнозных хвостов. Совмещается с hatchUntilIndex (объединение)",
      patternStyle:
        "Вид штриховки (на уровне графика). Per-bar pattern решает, штрихуется ли столбец; этот проп — как выглядит штриховка. 'dots' — для печати и оттенков серого",
      scroll:
        "Поведение при нехватке ширины. 'auto' включает горизонтальный скролл; ось Y прижата слева, столбцы и ось X скроллятся вместе",
      minBarWidth:
        "Минимальная ширина столбца в px. Вместе со scroll='auto' задаёт min-width графика: N*minBarWidth + (N−1)*gap. При scroll='none' игнорируется",
      bands:
        "Плот-бенды — подсвеченные вертикальные зоны по ЭКРАННЫМ позициям. Редакционный паттерн («Q3», «окно деплоя»). Рисуются за столбцами с низкой непрозрачностью; индексы ограничиваются диапазоном данных. Бенды предполагают исходный порядок — сочетание с sort даёт предупреждение в dev (зона «Q3» после пересортировки бессмысленна)",
      trend:
        "Десятичный индикатор тренда: 0.184 → ↗ +18.4%. Оранжевый при росте, приглушённый при падении",
      referenceLine:
        "Пунктирная референсная линия — фиксированный порог («цель Q3») или статистика по ИСХОДНЫМ данным (sort/topN не должны двигать статистику). Статистики подписываются Mean/Median автоматически. Участвует в шкале с обеих сторон — отрицательные и нулевые (break-even) референсы остаются видимыми",
      source: "Строка атрибуции под графиком (паттерн FT)",
      animation:
        "Каскадный подъём столбцов при монтировании. Автоматически отключается при prefers-reduced-motion",
      loading:
        "Состояние загрузки. Без данных → полный скелетон (пунктирные столбцы-призраки + плашка LOADING, ARIA role=status). С данными → полупрозрачный оверлей поверх графика для фонового обновления. Уважает prefers-reduced-motion",
      error:
        "Терминальная ошибка. Замещает график даже при наличии данных (устаревшие данные рядом с ошибкой вводят в заблуждение). Принимает Error, строку или null. ARIA role=alert",
      onRetry:
        "Коллбэк кнопки повтора в дефолтном состоянии ошибки. Кнопка рендерится только когда проп передан",
      loadingLabel:
        "Подпись рядом с плашкой LOADING и ARIA-метка скелетона. Переопределите для локализации",
      errorLabel:
        "Подпись над сообщением об ошибке и ARIA-метка. Переопределите для локализации",
      retryLabel:
        "Надпись на кнопке повтора в дефолтном состоянии ошибки. Переопределите для локализации",
      loadingFallback:
        "Полная замена дефолтного скелетона и оверлея. Для брендированного состояния загрузки",
      errorFallback:
        "Полная замена дефолтного UI ошибки. React-нода или функция, получающая нормализованный Error",
      exportable:
        "Показать тулбар экспорта (справа сверху). true — все 4 действия; объектная форма — выборочно. Императивные методы ref работают в любом случае",
      exportFileName:
        "Базовое имя файла выгрузки. Строка — фиксированное, функция — по формату. Расширение (.png/.svg/.csv) добавляется автоматически",
      onExport:
        "Срабатывает после завершения экспорта. Получает формат ('png'|'svg'|'csv'|'copy') и артефакт (Blob для png/copy, строка для svg/csv). Для аналитики и своих share-сценариев",
      ref: "Императивный API: { exportSVG, exportPNG, exportCSV, copyImage, focusBar, getSelection }. Экспорт работает даже в loading/error/empty. focusBar(target) принимает экранный индекс (с ограничением) ИЛИ стабильный key (неизвестный key → -1). getSelection() возвращает { index (экранный), key (стабильный), point } или null",
      onBarClick:
        "Срабатывает на клик, тап или Enter/Space на сфокусированном столбце. Событие — MouseEvent или KeyboardEvent. При переданном пропе столбцы получают cursor-pointer",
      onBarHover:
        "Срабатывает при наведении (point + index) и при уходе из области столбцов (null, null). Синхронизируйте свои легенды и панели деталей",
      onBarFocus:
        "Срабатывает при смене клавиатурного фокуса между столбцами (стрелки, Home/End, Tab, программный focusBar()). Отслеживает позицию roving tabindex",
      slots:
        "Словарь headless-слотов. Каждый слот заменяет дефолтный саб-компонент: tooltip (per-bar), empty (нет данных), loading (скелетон), error (терминальная), toolbar (чипы экспорта), caption (под источником), watermark (оверлей фигуры). Каждый слот получает типизированные пропы. Слоты сильнее шорткатов loadingFallback / errorFallback",
      caption:
        "Короткая редакционная подпись-примечание — курсив с левой границей, под строкой источника. Паттерн полей FT/писем Stripe. slots.caption сильнее",
      watermark:
        "Диагональная вотермарка — едва заметный пиксельный текст (≈6% непрозрачности) поверх графика. Маркер жизненного цикла документа (DRAFT, CONFIDENTIAL) — не брендинг (для атрибуции есть source). Намеренно ПЕЧАТАЕТСЯ: бумажный конфиденциальный отчёт обязан нести маркировку. slots.watermark сильнее",
      annotations:
        "Свободные редакционные аннотации в точке (x, y) пространства данных. x: число = ИСХОДНЫЙ индекс (едет со своим датумом сквозь sort/topN; если датум свернулся в «Other» — пропускается с предупреждением в dev) или строка = совпадение по key/label. y может быть отрицательным. { x, y, text, anchor?, arrow?, color? }; пунктирная стрелка опциональна. Воспроизводится в SVG/PNG-экспорте",
      chartType:
        "Машиночитаемый идентификатор, проставляется на фигуре как data-chart-type. Входит в toJSON(). AI/LLM-инструменты и аналитика используют его, чтобы понимать тип графика",
      dataDescription:
        "Описание данных на естественном языке («Дневная аудитория, последние 7 дней»). Проставляется как data-description. Для AI-промптов и редакционной провенанс. Не путать с `description` (авто-метка для скринридера)",
      "data-testid":
        "QA-селектор, пробрасывается на фигуру. Стабилен при рефакторинге классов — конвенция Testing Library / Playwright",
      description:
        "Доступное описание для скринридеров (figcaption + подпись таблицы). По умолчанию: 'Column chart with N data points. Source: ...'",
      formatValue:
        "Свой форматтер значений для тултипов, подписей и sr-таблицы. Вторым аргументом получает датум (key, meta, isOther…) для контекстного форматирования. Сильнее numberFormat",
      yAxisFormat:
        "Функция форматирования подписей делений оси Y. Сильнее numberFormat",
    },
  },
  table: {
    name: "Имя",
    type: "Тип",
    default: "По умолчанию",
    description: "Описание",
  },
  a11y: {
    title: "Доступность",
    intro: [
      "Построен по WCAG 2.2 AA. Клавиатурная навигация, поддержка скринридеров, уважает ",
      { code: "prefers-reduced-motion" },
      ".",
    ],
    localeNote:
      "Честное ограничение: автогенерируемые ARIA-описания компонента («Column chart with 7 data points. Highest: …») — на английском. Если ваш продукт для русскоязычных пользователей, передайте собственный description и локализуйте loadingLabel/errorLabel/retryLabel — locale-pack компонента в планах.",
    keyboardTitle: "Клавиатура",
    keyboard: [
      { key: "Tab", action: "Фокус внутрь графика (одна точка останова)" },
      { key: "← → ↑ ↓", action: "Навигация между столбцами (roving tabindex)" },
      { key: "Home", action: "К первому столбцу" },
      { key: "End", action: "К последнему столбцу" },
    ],
    srTitle: "Разметка для скринридера",
    srItems: [
      [
        { code: '<figure role="figure">' },
        " оборачивает график; ",
        { code: "aria-labelledby" },
        " указывает на figcaption",
      ],
      [
        "Каждый столбец — ",
        { code: 'role="graphics-symbol"' },
        " с ",
        { code: 'aria-label="LABEL: value"' },
      ],
      [
        "Скрытая ",
        { code: '<table class="sr-only">' },
        " даёт табличную сводку данных (подпись + строка на каждую точку)",
      ],
      [
        "Индикатор тренда получает человекочитаемую метку («Trend up 18.4 percent») — стрелки скрыты от AT",
      ],
    ],
  },
  designMoves: {
    title: "Дизайн-ходы",
    items: [
      [
        "Моноширинные числа оси Y + tabular-nums (шрифт Hack) — значения выравниваются по ширине цифры.",
      ],
      [
        "Один ",
        { code: "--brock-accent" },
        " (оранжевый) для всех столбцов — по обе стороны нуля. Без градиентов, свечения и палитр; per-bar ",
        { code: "color" },
        " зарезервирован под единичные редакционные исключения (аномалия, текущий период).",
      ],
      ["Без сетки. Одна линия 1px на нулевой базе (data-ink, Тафти)."],
      [
        "Тултип при наведении: значение в Hack mono + период в пиксельной плашке Departure Mono.",
      ],
      [
        "Каскадная анимация появления (30 мс на столбец, scale-Y от базы). Отключается при ",
        { code: "prefers-reduced-motion" },
        ".",
      ],
      [
        "Встроенный проп ",
        { code: "source" },
        " рендерит строку атрибуции в стиле FT/Bloomberg под графиком.",
      ],
      [
        "ASCII-состояние «нет данных» (",
        { code: "▒▒▒ no data" },
        "); полная машина состояний через ",
        { code: "loading" },
        " / ",
        { code: "error" },
        " (скелетон, оверлей обновления, повтор) в том же визуальном языке.",
      ],
    ],
  },
  whenTo: {
    title: "Когда использовать",
    body: "Column Chart подходит для упорядоченных категорий, где каждый столбец — дискретный интервал: временной (часы, дни, недели, вызовы агента в минуту) или ранжированный (трафик по каналам через sort + topN, выручка по регионам, прибыль/убыток по месяцам — отрицательные значения полноправны). Лучше всего показывает объём, количество и ритм активности с первого взгляда — разреженные оси не спорят с данными.",
  },
  whenNot: {
    title: "Когда не использовать",
    body: "Для непрерывных трендов — Line Chart. Для крошечных графиков внутри метрик-карточек и текста — Sparkline. Для рейтингов с длинными подписями (горизонтальные полосы) — Bar Chart (скоро). Для состава во времени — Stacked Column Chart (скоро).",
  },
  inspiredBy: {
    title: "Источники",
    items: [
      [
        "Financial Times Visual Journalism — разреженные оси, строка источника, одноцветные столбцы",
      ],
      ["Годовые письма Stripe — числа внутри редакционного текста"],
      ["The Pudding — интерактивный сторителлинг со сдержанностью"],
      [
        "Эдвард Тафти, The Visual Display of Quantitative Information — дисциплина data-ink",
      ],
    ],
  },
};

export const columnChartContent: Record<Locale, ColumnChartPageContent> = {
  en,
  ru,
};
