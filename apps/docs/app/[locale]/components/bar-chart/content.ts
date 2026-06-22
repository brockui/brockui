import type { Locale } from "@/i18n/routing";
import type { Rich } from "@/lib/rich-text";

/**
 * Bar Chart page content, both locales. TypeScript enforces structural parity
 * (drift-guard v1); the EN-hash manifest enforces freshness (v2).
 * RU: draft.
 */
export type BarChartPageContent = {
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
    localeNote: string | null;
    keyboardTitle: string;
    keyboard: { key: string; action: string }[];
  };
  designMoves: { title: string; items: Rich[] };
  whenTo: { title: string; body: string };
  whenNot: { title: string; body: string };
  inspiredBy: { title: string; items: Rich[] };
};

const en: BarChartPageContent = {
  kicker: "Charts · Bar Chart",
  title: "Bar Chart",
  intro:
    "Horizontal bars for ranked categories – the ranking shape. Long category labels read horizontally (the reason bar charts exist); height derives from the data; negatives grow to the left of an always-visible zero baseline. Same Tufte discipline as Column Chart: one accent, no gridlines, direct value labels by default.",
  studio: {
    title: "Studio · Code, chart, settings",
    lead: "A three-panel workbench. Tweak any setting on the right – the chart in the middle updates live, and the code on the left regenerates, ready to paste into your app.",
  },
  installation: "Installation",
  usage: "Usage",
  props: {
    title: "Props",
    descriptions: {
      data: "Bar values. Two forms: number[] (with labels prop) or { key?, label?, value, meta?, pattern?, color?, highlight?, note? }[] (object form). key = stable address for focusBar (defaults to label); meta = your payload, returned untouched in every callback; negatives grow LEFT of the zero baseline. The synthetic 'Other' bar carries isOther + items[] (output-only)",
      labels:
        "Category labels (left column + tooltip). Only used when data is number[]",
      barThickness:
        "Height of each bar in pixels (default 24 – the WCAG 2.5.8 pointer-target floor). Together with gap it DERIVES the chart height: there is no height prop, the data decides",
      gap: "Vertical gap between bars in pixels (default 8)",
      maxHeight:
        "Cap on the bars-area height. When the derived height exceeds it AND scroll='auto', rows scroll vertically in a keyboard-focusable container. Without scroll='auto' it is a documented no-op – every category stays visible",
      labelWidth:
        "Width of the left category-label column in pixels (default 96). Labels truncate with ellipsis – full text lives in the tooltip and sr-table; in narrow containers (≤420px) the column clamps, ≤240px it hides (CSS-only, canon §11)",
      referenceLine:
        "Dashed VERTICAL reference line – a fixed threshold ('Plan') or a computed statistic over the ORIGINAL input data (sort/topN must not move a statistic). Stats auto-label Mean/Median. Participates in the scale on both sides, so negative and break-even (0) references stay visible",
      source: "Attribution line rendered below the chart (FT pattern)",
      accent:
        "Override the bar fill color (any CSS color or var). Defaults to Brock orange",
      barRadius:
        "Outer-corner radius in px. Baseline-side corners stay flat; positive bars round their RIGHT corners, negative bars their LEFT",
      description:
        "Accessible description for screen readers (figcaption + table caption). Defaults to 'Bar chart with N data points. Highest: …; lowest: …'",
      xAxisFormat:
        "Format function for X-axis (value) tick labels. Wins over numberFormat",
      formatValue:
        "Custom value formatter for tooltips, data labels, and the sr-only table. Receives the datum as a second argument (key, meta, isOther…) for context-aware formatting. Wins over numberFormat",
      className: "Extra classes on the figure element",
      header: "Title + subtitle block above the chart",
      xAxis:
        "X-axis (VALUE axis) configuration. There is deliberately no min – a bar chart's baseline is always zero (truncated bars lie). max is extend-only headroom: values below the data max are ignored with a dev warning",
      yAxis: "Y-axis (CATEGORY axis) configuration – title, hide labels",
      numberFormat:
        "Number formatter applied to X-axis ticks, tooltip, and data labels. Supports BCP-47 locale, Intl.NumberFormat notation ('compact' → 1.2K), style ('currency' / 'percent'), and ISO 4217 currency. Explicit formatValue/xAxisFormat win",
      dataLabels:
        "Direct value labels at each bar's OUTER end (Hack mono; right of positive, left of negative; deep bars flip the label inside in background color). 'auto' (the default) shows labels AND hides the X-axis ticks when the chart has <= 8 bars. Explicit xAxis.hideTicks wins. format(value, datum) overrides numberFormat",
      animation:
        "Staggered bar-grow from the baseline on mount (scaleX; mirrored origin for negatives). Disabled automatically when prefers-reduced-motion is set",
      pattern:
        "Default fill pattern for all bars. Per-point pattern on a data point wins over this. Hatched encodes estimated/in-progress without spending a second color (Tufte)",
      patternStyle:
        "Visual style of hatched bars (chart-level). Per-bar pattern still controls whether a bar is hatched; this controls how each hatched bar looks. Use 'dots' for grayscale/print",
      scroll:
        "Overflow behavior when the derived height exceeds maxHeight. 'none' (default) – the chart is as tall as the data, every category visible. 'auto' – rows scroll vertically in a keyboard-focusable container",
      sort: "Reorder bars by value (stable). 'none' preserves input order; desc/asc turn the chart into a ranking – the bar chart's natural mode",
      topN: "Keep the N largest bars, roll the tail into one 'Other' aggregate (summed). Defaults: pinned last regardless of sort, muted --brock-other fill. Callbacks receive isOther + the collapsed items[]. Number shorthand = all defaults",
      loading:
        "Loading state. With no data → a full skeleton (solid placeholder rows + an accessible loading label, ARIA role=status). With data → a dim overlay with a small spinner for background refresh. Honors prefers-reduced-motion",
      error:
        "Terminal error state. Replaces the chart even when data is present (stale data next to an error is misleading). Accepts an Error, a string message, or null. ARIA role=alert",
      onRetry:
        "Callback for the retry button in the default error state. The button is rendered only when this prop is provided",
      loadingLabel:
        "Accessible label for the skeleton (loading) state, used as its ARIA label. Override for localization",
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
        "Fires after an export completes. Receives format ('png'|'svg'|'csv'|'copy') and the artifact (Blob for png/copy, string for svg/csv)",
      ref: "Imperative API: { exportSVG, exportPNG, exportCSV, copyImage, focusBar, getSelection }. Export methods work even in loading/error/empty. focusBar(target) takes a display index (clamped) OR a stable key string (unknown key → -1). getSelection() returns { index (display), key (stable), point } or null",
      onBarClick:
        "Fires on click, tap, or Enter/Space on a focused bar. Event is a MouseEvent or KeyboardEvent. Adds cursor-pointer to bars when provided",
      onBarHover:
        "Fires on mouse enter (point + index) and on leave of the bars area (null, null). Sync custom legends / detail panels with the hovered datum",
      onBarFocus:
        "Fires on keyboard focus changes between bars (arrow keys, Home/End, Tab in, and programmatic focusBar()). Tracks the roving-tabindex position",
      slots:
        "Headless slot dictionary: tooltip, empty, loading, error, toolbar, caption, watermark – each receives typed props. Slots win over loadingFallback / errorFallback shortcuts",
      caption:
        "Short editorial caption – italic muted text with a start border, rendered below the source line. FT/Stripe-Letters print-margin pattern. slots.caption wins over this",
      watermark:
        "Diagonal watermark text – faint pixel-font overlay over the chart. A document-lifecycle marker (DRAFT, CONFIDENTIAL) – not branding. Deliberately KEPT in print. slots.watermark wins over this",
      chartType:
        "Machine-readable identifier stamped on the figure as data-chart-type (default 'bar'). Included in toJSON() output",
      dataDescription:
        "Natural-language description of the data. Stamped as data-description. For AI prompts and editorial provenance",
      "data-testid":
        "QA selector hook forwarded to the figure. Stable across className refactors",
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
      ". Same baseline as Column Chart: sr-only data table with transform announcements, forced-colors support, auto description with highest/lowest insight.",
    ],
    localeNote: null,
    keyboardTitle: "Keyboard",
    keyboard: [
      { key: "Tab", action: "Move focus into the chart (single tab stop)" },
      { key: "↑ ↓ ← →", action: "Navigate between bars (roving tabindex; vertical is the primary axis)" },
      { key: "Home", action: "Jump to first bar" },
      { key: "End", action: "Jump to last bar" },
    ],
  },
  designMoves: {
    title: "Design moves",
    items: [
      [
        "Height derives from the data: N bars × ",
        { code: "barThickness" },
        " + gaps. No height prop – a ranking never crops its categories.",
      ],
      [
        "Category labels in a fixed-width left column (",
        { code: "labelWidth" },
        ") with an explicit truncation ladder: ellipsis → full text in tooltip + sr-table → container-query clamping. Long labels are WHY bar charts exist.",
      ],
      [
        "Single ",
        { code: "--brock-accent" },
        " on both sides of zero; negatives grow left from a vertical 1px baseline. No gridlines (Tufte data-ink).",
      ],
      [
        "Direct value labels at the outer end by default (",
        { code: "dataLabels: \"auto\"" },
        ") – the X axis hides when every value is printed; deep bars flip the label inside in background color.",
      ],
      [
        "Vertical reference line (fixed or mean/median over the original input) with its chip at the top.",
      ],
      [
        "Deliberate v1 scope cuts per canon §13: no bands / trend / hatch-index shortcuts (temporal, column-specific) and no free annotations – per-datum ",
        { code: "note" },
        " covers ranking callouts.",
      ],
    ],
  },
  whenTo: {
    title: "When to use",
    body: "Ranked categorical comparisons – traffic by channel, revenue by region, contribution by product (negatives are first-class). Reach for Bar over Column whenever category labels are words, not timestamps: horizontal labels read at any length. sort + topN turn raw data into an honest ranking with an explicit 'Other'.",
  },
  whenNot: {
    title: "When not to use",
    body: "For time buckets use Column Chart (time reads left-to-right). For continuous trends use Line Chart. For tiny embedded charts use Sparkline. For part-to-whole composition use Stacked Bar Chart (coming soon).",
  },
  inspiredBy: {
    title: "Inspired by",
    items: [
      [
        "Financial Times Visual Journalism – ranked bars with sparse axes and direct labels",
      ],
      ["Datawrapper – bars over columns whenever labels are words"],
      [
        "Edward Tufte, The Visual Display of Quantitative Information – data-ink discipline",
      ],
    ],
  },
};

const ru: BarChartPageContent = {
  kicker: "Графики · Bar Chart",
  title: "Bar Chart",
  intro:
    "Горизонтальные полосы для ранжированных категорий – форма рейтинга. Длинные подписи категорий читаются горизонтально (ради этого bar chart и существует), высота выводится из данных, отрицательные значения растут влево от всегда видимой нулевой базы. Та же дисциплина Тафти, что и в Column Chart: один акцент, без сетки, прямые подписи значений по умолчанию.",
  studio: {
    title: "Studio · Код, график, настройки",
    lead: "Трёхпанельный верстак. Меняйте любую настройку справа – график в центре обновляется вживую, а код слева перегенерируется, готовый к вставке в ваш проект.",
  },
  installation: "Установка",
  usage: "Использование",
  props: {
    title: "Пропы",
    descriptions: {
      data: "Значения полос. Две формы: number[] (с пропом labels) или { key?, label?, value, meta?, pattern?, color?, highlight?, note? }[] (объектная форма). key – стабильный адрес для focusBar (по умолчанию label); meta – ваши данные, возвращаются нетронутыми в каждом коллбэке; отрицательные растут ВЛЕВО от нулевой базы. Синтетическая полоса «Other» несёт isOther + items[] (только на выходе)",
      labels:
        "Подписи категорий (левая колонка + тултип). Используются только при data: number[]",
      barThickness:
        "Высота каждой полосы в пикселях (по умолчанию 24 – минимум pointer-target по WCAG 2.5.8). Вместе с gap ВЫВОДИТ высоту графика: пропа height нет, данные решают сами",
      gap: "Вертикальный зазор между полосами в пикселях (по умолчанию 8)",
      maxHeight:
        "Потолок высоты области полос. Когда выведенная высота превышает его И scroll='auto', строки скроллятся вертикально в фокусируемом с клавиатуры контейнере. Без scroll='auto' – документированный no-op: каждая категория остаётся видимой",
      labelWidth:
        "Ширина левой колонки подписей категорий в пикселях (по умолчанию 96). Подписи обрезаются многоточием – полный текст в тултипе и sr-таблице; в узких контейнерах (≤420px) колонка сжимается, ≤240px – скрывается (только CSS, канон §11)",
      referenceLine:
        "Пунктирная ВЕРТИКАЛЬНАЯ референсная линия – фиксированный порог («План») или статистика по ИСХОДНЫМ данным (sort/topN не должны двигать статистику). Статистики подписываются Mean/Median автоматически. Участвует в шкале с обеих сторон – отрицательные и нулевые референсы остаются видимыми",
      source: "Строка атрибуции под графиком (паттерн FT)",
      accent:
        "Переопределение цвета заливки (любой CSS-цвет или var). По умолчанию – оранжевый Brock",
      barRadius:
        "Радиус внешних углов в px. Углы у базовой линии остаются плоскими; позитивные полосы скругляют ПРАВЫЕ углы, негативные – ЛЕВЫЕ",
      description:
        "Доступное описание для скринридеров (figcaption + подпись таблицы). По умолчанию: 'Bar chart with N data points. Highest: …; lowest: …'",
      xAxisFormat:
        "Функция форматирования подписей делений оси X (значений). Сильнее numberFormat",
      formatValue:
        "Свой форматтер значений для тултипов, подписей и sr-таблицы. Вторым аргументом получает датум (key, meta, isOther…). Сильнее numberFormat",
      className: "Дополнительные классы на элементе figure",
      header: "Блок заголовка и подзаголовка над графиком",
      xAxis:
        "Настройка оси X (ЗНАЧЕНИЙ). min намеренно отсутствует – база bar chart всегда ноль (обрезанные полосы лгут). max только расширяет шкалу: значения ниже максимума данных игнорируются с предупреждением в dev",
      yAxis: "Настройка оси Y (КАТЕГОРИЙ) – заголовок, скрытие подписей",
      numberFormat:
        "Форматирование чисел для делений оси X, тултипа и подписей значений. Поддерживает локаль BCP-47, notation Intl.NumberFormat ('compact' → 1,2 тыс.), style ('currency' / 'percent') и валюту ISO 4217. Явные formatValue/xAxisFormat сильнее",
      dataLabels:
        "Прямые подписи значений у ВНЕШНЕГО конца полосы (Hack mono; справа у позитивных, слева у негативных; глубокие полосы переносят подпись внутрь цветом фона). 'auto' (дефолт) показывает подписи И скрывает деления оси X при ≤ 8 полосах. Явный xAxis.hideTicks сильнее. format(value, datum) переопределяет numberFormat",
      animation:
        "Каскадный рост полос от базовой линии при монтировании (scaleX; у негативных зеркальный origin). Автоматически отключается при prefers-reduced-motion",
      pattern:
        "Заливка всех полос по умолчанию. Per-bar pattern на точке данных сильнее. Штриховка кодирует «оценка/в работе» без второго цвета (Тафти)",
      patternStyle:
        "Вид штриховки (на уровне графика). Per-bar pattern решает, штрихуется ли полоса; этот проп – как выглядит штриховка. 'dots' – для печати",
      scroll:
        "Поведение при превышении maxHeight. 'none' (дефолт) – график высотой с данные, каждая категория видна. 'auto' – строки скроллятся вертикально в фокусируемом контейнере",
      sort: "Сортировка полос по значению (стабильная). 'none' сохраняет исходный порядок; desc/asc превращают график в рейтинг – естественный режим bar chart",
      topN: "Оставить N крупнейших полос, свернув хвост в агрегат «Other» (сумма). По умолчанию: закреплён последним независимо от sort, приглушённая заливка --brock-other. Коллбэки получают isOther + items[]. Число = все дефолты",
      loading:
        "Состояние загрузки. Без данных → полный скелетон (сплошные строки-плейсхолдеры + доступная подпись загрузки, ARIA role=status). С данными → полупрозрачный оверлей со спиннером для фонового обновления. Уважает prefers-reduced-motion",
      error:
        "Терминальная ошибка. Замещает график даже при наличии данных. Принимает Error, строку или null. ARIA role=alert",
      onRetry:
        "Коллбэк кнопки повтора в дефолтном состоянии ошибки. Кнопка рендерится только когда проп передан",
      loadingLabel:
        "Доступная подпись состояния загрузки (скелетона), используется как его ARIA-метка. Переопределите для локализации",
      errorLabel:
        "Подпись над сообщением об ошибке и ARIA-метка. Переопределите для локализации",
      retryLabel:
        "Надпись на кнопке повтора. Переопределите для локализации",
      loadingFallback:
        "Полная замена дефолтного скелетона и оверлея. Для брендированного состояния загрузки",
      errorFallback:
        "Полная замена дефолтного UI ошибки. React-нода или функция, получающая нормализованный Error",
      exportable:
        "Показать тулбар экспорта (справа сверху). true – все 4 действия; объектная форма – выборочно. Императивные методы ref работают в любом случае",
      exportFileName:
        "Базовое имя файла выгрузки. Строка – фиксированное, функция – по формату. Расширение добавляется автоматически",
      onExport:
        "Срабатывает после завершения экспорта. Получает формат ('png'|'svg'|'csv'|'copy') и артефакт (Blob или строку)",
      ref: "Императивный API: { exportSVG, exportPNG, exportCSV, copyImage, focusBar, getSelection }. Экспорт работает даже в loading/error/empty. focusBar(target) принимает экранный индекс ИЛИ стабильный key (неизвестный key → -1). getSelection() возвращает { index, key, point } или null",
      onBarClick:
        "Срабатывает на клик, тап или Enter/Space на сфокусированной полосе. При переданном пропе полосы получают cursor-pointer",
      onBarHover:
        "Срабатывает при наведении (point + index) и при уходе из области полос (null, null)",
      onBarFocus:
        "Срабатывает при смене клавиатурного фокуса между полосами (стрелки, Home/End, Tab, программный focusBar())",
      slots:
        "Словарь headless-слотов: tooltip, empty, loading, error, toolbar, caption, watermark – каждый получает типизированные пропы. Слоты сильнее шорткатов loadingFallback / errorFallback",
      caption:
        "Короткая редакционная подпись-примечание – курсив с боковой границей, под строкой источника. slots.caption сильнее",
      watermark:
        "Диагональная вотермарка – едва заметный пиксельный текст поверх графика. Маркер жизненного цикла документа (DRAFT, CONFIDENTIAL) – не брендинг. Намеренно ПЕЧАТАЕТСЯ. slots.watermark сильнее",
      chartType:
        "Машиночитаемый идентификатор на фигуре как data-chart-type (по умолчанию 'bar'). Входит в toJSON()",
      dataDescription:
        "Описание данных на естественном языке. Проставляется как data-description. Для AI-промптов и провенанс",
      "data-testid":
        "QA-селектор, пробрасывается на фигуру. Стабилен при рефакторинге классов",
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
      ". Тот же базис, что у Column Chart: sr-таблица с объявлением трансформаций, forced-colors, авто-описание с максимумом/минимумом.",
    ],
    localeNote:
      "Честное ограничение: автогенерируемые ARIA-описания компонента – на английском. Если ваш продукт для русскоязычных пользователей, передайте собственный description и локализуйте loadingLabel/errorLabel/retryLabel – locale-pack компонента в планах.",
    keyboardTitle: "Клавиатура",
    keyboard: [
      { key: "Tab", action: "Фокус внутрь графика (одна точка останова)" },
      {
        key: "↑ ↓ ← →",
        action: "Навигация между полосами (roving tabindex; вертикаль – основная ось)",
      },
      { key: "Home", action: "К первой полосе" },
      { key: "End", action: "К последней полосе" },
    ],
  },
  designMoves: {
    title: "Дизайн-ходы",
    items: [
      [
        "Высота выводится из данных: N полос × ",
        { code: "barThickness" },
        " + зазоры. Пропа height нет – рейтинг никогда не обрезает свои категории.",
      ],
      [
        "Подписи категорий в колонке фиксированной ширины (",
        { code: "labelWidth" },
        ") с явной лестницей обрезки: многоточие → полный текст в тултипе и sr-таблице → сжатие через container queries. Длинные подписи – причина существования bar chart.",
      ],
      [
        "Один ",
        { code: "--brock-accent" },
        " по обе стороны нуля; негативные растут влево от вертикальной базы 1px. Без сетки (data-ink, Тафти).",
      ],
      [
        "Прямые подписи значений у внешнего конца по умолчанию (",
        { code: "dataLabels: \"auto\"" },
        ") – ось X скрывается, когда каждое значение напечатано; глубокие полосы переносят подпись внутрь цветом фона.",
      ],
      [
        "Вертикальная референсная линия (фиксированная или mean/median по исходным данным) с плашкой сверху.",
      ],
      [
        "Осознанные вырезы v1 по канону §13: без bands / trend / hatch-шорткатов (временна́я семантика Column) и без свободных аннотаций – per-datum ",
        { code: "note" },
        " покрывает выноски рейтинга.",
      ],
    ],
  },
  whenTo: {
    title: "Когда использовать",
    body: "Ранжированные категориальные сравнения – трафик по каналам, выручка по регионам, вклад по продуктам (отрицательные значения полноправны). Берите Bar вместо Column всегда, когда подписи категорий – слова, а не временные метки: горизонтальные подписи читаются при любой длине. sort + topN превращают сырые данные в честный рейтинг с явным «Other».",
  },
  whenNot: {
    title: "Когда не использовать",
    body: "Для временных интервалов – Column Chart (время читается слева направо). Для непрерывных трендов – Line Chart. Для крошечных встроенных графиков – Sparkline. Для состава целого – Stacked Bar Chart (скоро).",
  },
  inspiredBy: {
    title: "Источники",
    items: [
      [
        "Financial Times Visual Journalism – ранжированные полосы с разреженными осями и прямыми подписями",
      ],
      ["Datawrapper – bars вместо columns всегда, когда подписи – слова"],
      [
        "Эдвард Тафти, The Visual Display of Quantitative Information – дисциплина data-ink",
      ],
    ],
  },
};

export const barChartContent: Record<Locale, BarChartPageContent> = { en, ru };
