import type { Locale } from "@/i18n/routing";
import type { Rich } from "@/lib/rich-text";

/**
 * Line Chart page content, both locales. TypeScript enforces structural
 * parity (drift-guard v1); the EN-hash manifest enforces freshness (v2).
 * RU: draft – awaiting founder proofread (см. docs/glossary-ru.md).
 *
 * Prop NAMES/types/defaults stay in page.tsx (technical, never translated);
 * only the human descriptions live here.
 */
export type LineChartPageContent = {
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
     * its ARIA descriptions in English – Russian products must pass their own
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

const en: LineChartPageContent = {
  kicker: "Charts · Line Chart",
  title: "Line Chart",
  intro:
    "Multi-series lines for continuous time-series – change over time, indexed comparisons, forecasts. The FT / John Burn-Murdoch canon: direct line-end labels instead of a legend, one emphasized series in the accent while the rest mute to grey (never a rainbow), faint gridlines (the deliberate, correct deviation from the no-gridline bar rule), honest gaps where data is missing, and a Y domain that reads change – not magnitude-from-zero.",
  studio: {
    title: "Studio · Code, chart, settings",
    lead: "Three-panel workbench. Tweak any setting on the right – the multi-series chart in the middle updates live and the code on the left regenerates ready to paste into your app.",
  },
  installation: "Installation",
  usage: "Usage",
  props: {
    title: "Props",
    descriptions: {
      data: "Line data. Three forms: number[] (single series, paired with labels/x), LineChartDataPoint[] (single series, object form), or LineChartSeries[] (multiple series sharing one X domain). A null value (in number arrays or as y: null) renders a GAP – the line breaks rather than interpolating across missing data",
      labels:
        "X-axis labels / positions, used when data is a single series of plain numbers or points without their own x. Strings → point scale; numbers → linear/time",
      x: "Alias for labels. Reads naturally for a continuous X axis",
      height: "Chart height in pixels for the plot + Y-axis area",
      trend:
        "Decimal trend indicator e.g. 0.184 → ↗ +18.4%. Accent if positive, muted if negative. Rendered top-right above the chart",
      referenceLine:
        "Dashed HORIZONTAL reference line – a fixed value ('Target') or a statistic computed over the EMPHASIZED (or first) series ({ stat: 'mean' } / { stat: 'median' }). Stats auto-label Mean/Median. Participates in the Y domain so the line stays visible",
      source: "Attribution line rendered below the chart (FT/Bloomberg pattern)",
      accent:
        "Override the accent color (any CSS color or var). Defaults to --brock-accent. Paints the emphasized series + a positive trend",
      lineWidth: "Line stroke width in pixels",
      curve:
        "Line interpolation. 'linear' is a straight polyline; 'monotone' smooths it without overshooting – the safe smoothing that never invents a peak between two points",
      markers:
        "Marker (dot) policy. 'auto' shows dots only for sparse series (≤ ~20 points) or a lone point; 'always' / 'none' force the behavior",
      xScale:
        "X-axis scale. Inferred when omitted: 'point' for string x, else 'linear'. 'time' parses timestamps / ISO date strings deterministically (never Date.now())",
      yScale:
        "Y-axis scale. 'linear' (default) or 'log' (base-10, 1·2·5 ticks). Non-positive values are dropped on a log scale with a dev warning – they have no log position",
      gridlines:
        "Light horizontal gridlines. Default true – the deliberate, correct deviation from the bar canon's no-gridline rule: Tufte/FT permit faint gridlines for line / time-series reading",
      legend:
        "Where the series legend lives. 'direct' (default for multi-series) labels each line at its right end in the line's color – the FT signature, replaces a legend. 'top' renders a chip row above the chart; 'none' hides it",
      directLabels:
        "Direct line-end labels on/off. Defaults to true for multi-series (follows legend === 'direct'). Overlapping labels are nudged apart with a vertical collision-avoidance pass",
      directLabelValues:
        "Append each series' last value to its direct label",
      emphasisSeries:
        "Emphasize a single series by key or name: it takes the accent color at full weight while the others mute to grey. Per-series emphasis: true works too. When neither is set and there is one series, it is emphasized",
      lastValueDot:
        "Draw an emphasized dot at each series' latest defined point – the FT 'where it ended' marker",
      yBaselineZero:
        "Opt into a zero baseline in the Y domain. By default the Y domain is a 'nice' auto range NOT forced to zero – a line chart reads change, not magnitude-from-zero (the FT default). Set true for share/percent data",
      description:
        "Accessible description for screen readers (figcaption + sr-only table). Defaults to an auto Amy-Cesal summary: 'Line chart with N series. SERIES: high … at …, low … at …'",
      yAxisFormat:
        "Custom formatter for Y-axis tick labels. Wins over numberFormat",
      formatValue:
        "Custom formatter for tooltip / direct-label / reference-line values. Wins over numberFormat",
      className: "Pass-through className for the outer figure wrapper",
      header: "Title + subtitle block above the chart",
      xAxis:
        "X-axis configuration: title (below ticks), hideTicks, approximate tick count, custom tick label formatter (receives the resolved numeric x)",
      yAxis:
        "Y-axis configuration. Unlike a column chart, a line chart's Y domain is a nice auto range (NOT zero-anchored) by default – change is the story. Force min / max, hide ticks, set approximate tick count, add a rotated title",
      numberFormat:
        "Number formatter applied to Y-axis ticks, tooltip values, direct labels, and the reference line. Supports BCP-47 locale, Intl.NumberFormat notation ('compact' → 1.2K), style ('currency' / 'percent'), and ISO 4217 currency. Explicit formatValue/yAxisFormat win",
      animation:
        "Line-draw / fade entry animation on mount. Disabled automatically when prefers-reduced-motion is set",
      events:
        "Vertical event markers – thin dashed lines at x positions with optional rotated labels. The FT 'deployment / shock / announcement' call-out. Reproduced in the SVG / PNG export",
      bands:
        "Shaded x-range bands – low-opacity vertical zones (the FT recession-shading pattern). Sit behind the lines; reproduced in export",
      loading:
        "Loading state. With no data → full skeleton (dashed ghost line + LOADING badge, ARIA role=status). With data → dim overlay for background refresh. Honors prefers-reduced-motion",
      error:
        "Terminal error state. Replaces the chart even when data is present (stale data next to an error is misleading). Accepts an Error, a string message, or null. ARIA role=alert",
      onRetry:
        "Callback for the retry button in the default error state. The button is rendered only when this prop is provided",
      loadingLabel:
        "Label for the LOADING badge and the ARIA label of the skeleton state. Override for localization",
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
      ref: "Imperative API: { exportSVG, exportPNG, exportCSV, copyImage, focusPoint, getSelection }. Export methods work even in loading/error/empty. focusPoint(target) takes a point index (clamped) on the emphasized series OR a stable key string (unknown key → -1). getSelection() returns { series, point, index, key } or null",
      onPointClick:
        "Fires on click, tap, or Enter/Space on a focused point. Receives the full selection (series + point + index + key) and the originating event",
      onPointHover:
        "Fires on hover of the nearest x (selection is null on leave). Useful for syncing custom legend / detail panels with the hovered x",
      onPointFocus:
        "Fires when keyboard focus moves between points (Arrow / Home / End along x, Up / Down to switch series). Tracks the roving-tabindex position",
      slots:
        "Headless slot dictionary. Each slot replaces a default sub-component: tooltip (crosshair multi-series), empty (no data), loading (skeleton), error (terminal), toolbar (export chips), caption (below source), watermark (figure overlay). Each slot receives typed props. Slots win over loadingFallback / errorFallback shortcuts",
      caption:
        "Short editorial caption – italic muted text with left border, rendered below the source line. FT/Stripe-Letters print-margin pattern. slots.caption wins over this",
      watermark:
        "Diagonal watermark text – faint pixel-font overlay (DRAFT / CONFIDENTIAL) over the chart. A document-lifecycle marker, not branding (use source for attribution). Deliberately KEPT in print. slots.watermark wins over this",
      chartType:
        "Machine-readable identifier stamped on the figure as data-chart-type. Included in toJSON() output. AI/LLM tooling + analytics use it to reason about the chart shape",
      dataDescription:
        "Natural-language description of the data ('Revenue vs costs, last 6 months'). Stamped as data-description. For AI prompts and editorial provenance. Distinct from `description` (which is the screen-reader auto-label)",
      "data-testid":
        "QA selector hook forwarded to the figure. Stable across className refactors – Testing Library / Playwright convention",
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
      {
        key: "← →",
        action: "Move along x on the emphasized series (roving tabindex)",
      },
      { key: "↑ ↓", action: "Switch the focused series up / down" },
      { key: "Home", action: "Jump to the first point" },
      { key: "End", action: "Jump to the last point" },
      { key: "Enter / Space", action: "Invoke onPointClick on the focused point" },
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
        "Each focusable point uses ",
        { code: 'aria-roledescription="data point"' },
        " with ",
        { code: 'aria-label="SERIES, X: value"' },
      ],
      [
        "A visually-hidden ",
        { code: '<table class="sr-only">' },
        " provides a tabular summary – one column per series, one row per x value (gaps render as “–”)",
      ],
      [
        "Trend indicator gets a human-readable label (“Trend up 18.4 percent”) – arrows are aria-hidden",
      ],
    ],
  },
  designMoves: {
    title: "Design moves",
    items: [
      [
        "Direct line-end labels replace a legend (the FT signature), in each line's color, with vertical collision avoidance.",
      ],
      [
        "Emphasis, not rainbow: one series in ",
        { code: "--brock-accent" },
        " at full weight, the rest muted to a restrained greyscale ramp. No N-color spaghetti.",
      ],
      [
        "Faint horizontal gridlines – the deliberate, correct deviation from the bar canon's no-gridline rule. Tufte / FT permit them for time-series reading.",
      ],
      [
        "Honest gaps: a ",
        { code: "y: null" },
        " point BREAKS the line into sub-paths – never silently interpolated across missing data.",
      ],
      [
        "Y domain reads change, not magnitude – a 'nice' auto range NOT forced to zero by default (",
        { code: "yBaselineZero" },
        " opts in for share/percent data).",
      ],
      [
        "Crosshair + multi-series tooltip snaps to the nearest x and lists every series' value there, sorted descending.",
      ],
      [
        "Editorial layers: vertical ",
        { code: "events" },
        " markers, shaded ",
        { code: "bands" },
        " (recession shading), a ",
        { code: "dashed" },
        " series for forecasts – all reproduced in the SVG export.",
      ],
      [
        "ASCII empty state (",
        { code: "▒▒▒ no data" },
        ") and a dashed-line loading skeleton in the same Tufte-friendly visual language.",
      ],
    ],
  },
  whenTo: {
    title: "When to use",
    body: "Line Chart fits continuous series where the X axis is ordered and the story is the trend: metrics over time (revenue, latency, active users), indexed comparisons across entities (countries, cohorts rebased to 100), and fact-vs-forecast (a dashed projection line). Multiple series share one Y domain so they read against each other; emphasis keeps one in focus while the rest provide context.",
  },
  whenNot: {
    title: "When not to use",
    body: "For discrete ordered buckets where each value is independent (days of the week, channels) use Column Chart. For categorical ranking with long labels use Bar Chart. For tiny embedded charts inside metric cards or prose use Sparkline. For composition over time (parts of a whole) use Stacked Area / Stacked Column (coming soon).",
  },
  inspiredBy: {
    title: "Inspired by",
    items: [
      [
        "John Burn-Murdoch, Financial Times – direct labels, emphasis over rainbow, indexed lines, log scale where it tells the truth",
      ],
      ["Financial Times Visual Journalism – sparse axes, source-line attribution, recession shading"],
      ["Stripe Annual Letters – inline numerics in editorial flow"],
      [
        "Edward Tufte, The Visual Display of Quantitative Information – data-ink discipline, sparklines, small multiples",
      ],
    ],
  },
};

const ru: LineChartPageContent = {
  kicker: "Графики · Line Chart",
  title: "Line Chart",
  intro:
    "Многорядные линии для непрерывных временных рядов – изменение во времени, индексированные сравнения, прогнозы. Канон FT / Джона Бёрн-Мёрдока: прямые подписи у концов линий вместо легенды, один акцентный ряд в цвете акцента, остальные приглушены до серого (никакой радуги), бледная сетка (намеренное и верное отступление от правила «без сетки» для столбцов), честные разрывы там, где данных нет, и шкала Y, которая показывает изменение – а не величину от нуля.",
  studio: {
    title: "Studio · Код, график, настройки",
    lead: "Трёхпанельный верстак. Меняйте любую настройку справа – многорядный график в центре обновляется вживую, а код слева перегенерируется, готовый к вставке в ваш проект.",
  },
  installation: "Установка",
  usage: "Использование",
  props: {
    title: "Пропы",
    descriptions: {
      data: "Данные линий. Три формы: number[] (один ряд, в паре с labels/x), LineChartDataPoint[] (один ряд, объектная форма) или LineChartSeries[] (несколько рядов с общей осью X). Значение null (в массивах чисел или как y: null) рисует РАЗРЫВ – линия прерывается, а не интерполируется через пропуск",
      labels:
        "Подписи/позиции оси X, используются когда data – один ряд из чисел или точек без собственного x. Строки → шкала point; числа → linear/time",
      x: "Псевдоним для labels. Читается естественнее для непрерывной оси X",
      height: "Высота графика в пикселях (область графика + ось Y)",
      trend:
        "Десятичный индикатор тренда: 0.184 → ↗ +18.4%. Акцент при росте, приглушённый при падении. Рендерится справа сверху над графиком",
      referenceLine:
        "Пунктирная ГОРИЗОНТАЛЬНАЯ референсная линия – фиксированное значение («Цель») или статистика по АКЦЕНТНОМУ (или первому) ряду ({ stat: 'mean' } / { stat: 'median' }). Статистики подписываются Mean/Median автоматически. Участвует в шкале Y, чтобы линия оставалась видимой",
      source: "Строка атрибуции под графиком (паттерн FT/Bloomberg)",
      accent:
        "Переопределение акцентного цвета (любой CSS-цвет или var). По умолчанию – --brock-accent. Красит акцентный ряд и положительный тренд",
      lineWidth: "Толщина линии в пикселях",
      curve:
        "Интерполяция линии. 'linear' – прямая ломаная; 'monotone' сглаживает без выброса – безопасное сглаживание, которое не выдумывает пик между двумя точками",
      markers:
        "Политика маркеров (точек). 'auto' показывает точки только для разрежённых рядов (≤ ~20 точек) или одиночной точки; 'always' / 'none' задают поведение принудительно",
      xScale:
        "Шкала оси X. По умолчанию определяется: 'point' для строковых x, иначе 'linear'. 'time' детерминированно парсит таймстемпы / ISO-даты (никогда Date.now())",
      yScale:
        "Шкала оси Y. 'linear' (дефолт) или 'log' (по основанию 10, деления 1·2·5). Неположительные значения отбрасываются на лог-шкале с предупреждением в dev – у них нет позиции на логарифме",
      gridlines:
        "Бледная горизонтальная сетка. По умолчанию true – намеренное и верное отступление от правила «без сетки» для столбцов: Тафти/FT допускают слабую сетку для линий и временных рядов",
      legend:
        "Где находится легенда рядов. 'direct' (дефолт для нескольких рядов) подписывает каждую линию у правого конца её цветом – подпись FT, заменяет легенду. 'top' – строка чипов над графиком; 'none' скрывает",
      directLabels:
        "Прямые подписи у концов линий вкл/выкл. По умолчанию true для нескольких рядов (следует за legend === 'direct'). Пересекающиеся подписи раздвигаются проходом против коллизий по вертикали",
      directLabelValues:
        "Добавлять последнее значение каждого ряда к его прямой подписи",
      emphasisSeries:
        "Выделить один ряд по key или name: он берёт акцентный цвет на полную, остальные приглушаются до серого. Per-series emphasis: true тоже работает. Если ничего не задано и ряд один – он выделяется",
      lastValueDot:
        "Рисовать акцентную точку у последней определённой точки каждого ряда – маркер FT «где закончилось»",
      yBaselineZero:
        "Включить нулевую базу в шкалу Y. По умолчанию шкала Y – «красивый» авто-диапазон, НЕ привязанный к нулю: линия показывает изменение, а не величину от нуля (дефолт FT). Включайте для долей/процентов",
      description:
        "Доступное описание для скринридеров (figcaption + sr-таблица). По умолчанию – авто-сводка по Эми Сезал: 'Line chart with N series. SERIES: high … at …, low … at …'",
      yAxisFormat:
        "Свой форматтер подписей делений оси Y. Сильнее numberFormat",
      formatValue:
        "Свой форматтер значений тултипа / прямых подписей / референсной линии. Сильнее numberFormat",
      className: "Проброс className на внешнюю обёртку figure",
      header: "Блок заголовка и подзаголовка над графиком",
      xAxis:
        "Настройка оси X: title (под делениями), hideTicks, примерное число делений, свой форматтер подписей (получает разрешённый числовой x)",
      yAxis:
        "Настройка оси Y. В отличие от столбчатого графика, шкала Y линии по умолчанию – красивый авто-диапазон (НЕ от нуля): история – это изменение. Задать min / max, скрыть деления, число делений, повёрнутый заголовок",
      numberFormat:
        "Форматирование чисел для делений оси Y, значений тултипа, прямых подписей и референсной линии. Поддерживает локаль BCP-47, notation Intl.NumberFormat ('compact' → 1,2 тыс.), style ('currency' / 'percent') и валюту ISO 4217. Явные formatValue/yAxisFormat сильнее",
      animation:
        "Анимация прорисовки/появления линий при монтировании. Автоматически отключается при prefers-reduced-motion",
      events:
        "Вертикальные маркеры событий – тонкие пунктирные линии в позициях x с опциональными повёрнутыми подписями. Выноска FT «деплой / шок / анонс». Воспроизводится в SVG/PNG-экспорте",
      bands:
        "Затенённые зоны по диапазону x – вертикальные зоны низкой непрозрачности (паттерн FT с затенением рецессий). За линиями; воспроизводится в экспорте",
      loading:
        "Состояние загрузки. Без данных → полный скелетон (пунктирная линия-призрак + плашка LOADING, ARIA role=status). С данными → полупрозрачный оверлей для фонового обновления. Уважает prefers-reduced-motion",
      error:
        "Терминальная ошибка. Замещает график даже при наличии данных (устаревшие данные рядом с ошибкой вводят в заблуждение). Принимает Error, строку или null. ARIA role=alert",
      onRetry:
        "Коллбэк кнопки повтора в дефолтном состоянии ошибки. Кнопка рендерится только когда проп передан",
      loadingLabel:
        "Подпись плашки LOADING и ARIA-метка скелетона. Переопределите для локализации",
      errorLabel:
        "Подпись над сообщением об ошибке и ARIA-метка. Переопределите для локализации",
      retryLabel:
        "Надпись на кнопке повтора в дефолтном состоянии ошибки. Переопределите для локализации",
      loadingFallback:
        "Полная замена дефолтного скелетона и оверлея. Для брендированного состояния загрузки",
      errorFallback:
        "Полная замена дефолтного UI ошибки. React-нода или функция, получающая нормализованный Error",
      exportable:
        "Показать тулбар экспорта (справа сверху). true – все 4 действия; объектная форма – выборочно. Императивные методы ref работают в любом случае",
      exportFileName:
        "Базовое имя файла выгрузки. Строка – фиксированное, функция – по формату. Расширение (.png/.svg/.csv) добавляется автоматически",
      onExport:
        "Срабатывает после завершения экспорта. Получает формат ('png'|'svg'|'csv'|'copy') и артефакт (Blob для png/copy, строка для svg/csv). Для аналитики и своих share-сценариев",
      ref: "Императивный API: { exportSVG, exportPNG, exportCSV, copyImage, focusPoint, getSelection }. Экспорт работает даже в loading/error/empty. focusPoint(target) принимает индекс точки (с ограничением) на акцентном ряду ИЛИ стабильный key (неизвестный key → -1). getSelection() возвращает { series, point, index, key } или null",
      onPointClick:
        "Срабатывает на клик, тап или Enter/Space на сфокусированной точке. Получает полный selection (ряд + точка + индекс + key) и исходное событие",
      onPointHover:
        "Срабатывает при наведении на ближайший x (selection = null при уходе). Удобно для синхронизации своих легенд и панелей деталей с наведённым x",
      onPointFocus:
        "Срабатывает при смене клавиатурного фокуса между точками (Arrow / Home / End по x, Up / Down – смена ряда). Отслеживает позицию roving tabindex",
      slots:
        "Словарь headless-слотов. Каждый слот заменяет дефолтный саб-компонент: tooltip (перекрестье, несколько рядов), empty (нет данных), loading (скелетон), error (терминальная), toolbar (чипы экспорта), caption (под источником), watermark (оверлей фигуры). Каждый слот получает типизированные пропы. Слоты сильнее шорткатов loadingFallback / errorFallback",
      caption:
        "Короткая редакционная подпись-примечание – курсив с левой границей, под строкой источника. Паттерн полей FT/писем Stripe. slots.caption сильнее",
      watermark:
        "Диагональная вотермарка – едва заметный пиксельный текст (DRAFT / CONFIDENTIAL) поверх графика. Маркер жизненного цикла документа, не брендинг (для атрибуции есть source). Намеренно ПЕЧАТАЕТСЯ. slots.watermark сильнее",
      chartType:
        "Машиночитаемый идентификатор, проставляется на фигуре как data-chart-type. Входит в toJSON(). AI/LLM-инструменты и аналитика используют его, чтобы понимать тип графика",
      dataDescription:
        "Описание данных на естественном языке («Выручка и расходы, последние 6 месяцев»). Проставляется как data-description. Для AI-промптов и редакционной провенанс. Не путать с `description` (авто-метка для скринридера)",
      "data-testid":
        "QA-селектор, пробрасывается на фигуру. Стабилен при рефакторинге классов – конвенция Testing Library / Playwright",
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
      "Честное ограничение: автогенерируемые ARIA-описания компонента («Line chart with 2 series. …») – на английском. Если ваш продукт для русскоязычных пользователей, передайте собственный description и локализуйте loadingLabel/errorLabel/retryLabel – locale-pack компонента в планах.",
    keyboardTitle: "Клавиатура",
    keyboard: [
      { key: "Tab", action: "Фокус внутрь графика (одна точка останова)" },
      {
        key: "← →",
        action: "Движение по x на акцентном ряду (roving tabindex)",
      },
      { key: "↑ ↓", action: "Переключение сфокусированного ряда вверх / вниз" },
      { key: "Home", action: "К первой точке" },
      { key: "End", action: "К последней точке" },
      {
        key: "Enter / Space",
        action: "Вызвать onPointClick на сфокусированной точке",
      },
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
        "Каждая фокусируемая точка – ",
        { code: 'aria-roledescription="data point"' },
        " с ",
        { code: 'aria-label="SERIES, X: value"' },
      ],
      [
        "Скрытая ",
        { code: '<table class="sr-only">' },
        " даёт табличную сводку – колонка на ряд, строка на значение x (разрывы – «–»)",
      ],
      [
        "Индикатор тренда получает человекочитаемую метку («Trend up 18.4 percent») – стрелки скрыты от AT",
      ],
    ],
  },
  designMoves: {
    title: "Дизайн-ходы",
    items: [
      [
        "Прямые подписи у концов линий заменяют легенду (подпись FT), в цвете каждой линии, с защитой от коллизий по вертикали.",
      ],
      [
        "Акцент, не радуга: один ряд в ",
        { code: "--brock-accent" },
        " на полную, остальные приглушены до сдержанной серой шкалы. Никакой разноцветной «лапши».",
      ],
      [
        "Бледная горизонтальная сетка – намеренное и верное отступление от правила «без сетки» для столбцов. Тафти / FT допускают её для чтения временных рядов.",
      ],
      [
        "Честные разрывы: точка ",
        { code: "y: null" },
        " РАЗРЫВАЕТ линию на под-пути – пропуск никогда не интерполируется молча.",
      ],
      [
        "Шкала Y показывает изменение, а не величину – «красивый» авто-диапазон, по умолчанию НЕ от нуля (",
        { code: "yBaselineZero" },
        " включает ноль для долей/процентов).",
      ],
      [
        "Перекрестье + тултип на несколько рядов привязывается к ближайшему x и перечисляет значение каждого ряда там, по убыванию.",
      ],
      [
        "Редакционные слои: вертикальные маркеры ",
        { code: "events" },
        ", затенённые ",
        { code: "bands" },
        " (затенение рецессий), ",
        { code: "dashed" },
        "-ряд для прогнозов – всё воспроизводится в SVG-экспорте.",
      ],
      [
        "ASCII-состояние «нет данных» (",
        { code: "▒▒▒ no data" },
        ") и скелетон загрузки из пунктирной линии в том же визуальном языке Тафти.",
      ],
    ],
  },
  whenTo: {
    title: "Когда использовать",
    body: "Line Chart подходит для непрерывных рядов, где ось X упорядочена, а история – это тренд: метрики во времени (выручка, задержка, активные пользователи), индексированные сравнения сущностей (страны, когорты, приведённые к 100) и факт-vs-прогноз (пунктирная линия прогноза). Несколько рядов делят одну ось Y, чтобы читаться друг против друга; акцент держит один в фокусе, остальные дают контекст.",
  },
  whenNot: {
    title: "Когда не использовать",
    body: "Для дискретных упорядоченных интервалов, где каждое значение независимо (дни недели, каналы) – Column Chart. Для рейтингов с длинными подписями – Bar Chart. Для крошечных графиков внутри метрик-карточек и текста – Sparkline. Для состава во времени (части целого) – Stacked Area / Stacked Column (скоро).",
  },
  inspiredBy: {
    title: "Источники",
    items: [
      [
        "Джон Бёрн-Мёрдок, Financial Times – прямые подписи, акцент вместо радуги, индексированные линии, лог-шкала там, где она говорит правду",
      ],
      ["Financial Times Visual Journalism – разреженные оси, строка источника, затенение рецессий"],
      ["Годовые письма Stripe – числа внутри редакционного текста"],
      [
        "Эдвард Тафти, The Visual Display of Quantitative Information – дисциплина data-ink, спарклайны, малые множества",
      ],
    ],
  },
};

export const lineChartContent: Record<Locale, LineChartPageContent> = {
  en,
  ru,
};
