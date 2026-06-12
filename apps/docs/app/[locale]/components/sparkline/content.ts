import type { Locale } from "@/i18n/routing";
import type { Rich } from "@/lib/rich-text";

/** Sparkline page content. RU: draft — awaiting founder proofread. */
export type SparklineContent = {
  kicker: string;
  title: string;
  intro: string;
  preview: string;
  inlineDemo: { title: string; before: string; after: string };
  installation: string;
  usage: string;
  inlineUsage: string;
  props: { title: string; descriptions: Record<string, string> };
  table: { name: string; type: string; default: string; description: string };
  whenTo: { title: string; body: string };
  whenNot: { title: string; body: string };
  designPrinciple: { title: string; body: Rich };
  inspiredBy: { title: string; items: string[] };
};

const en: SparklineContent = {
  kicker: "Charts · Sparkline",
  title: "Sparkline",
  intro:
    "Word-sized chart for inline data context. Tufte canon — “data at the point where it is read.” Designed to live inside paragraphs, metric cards, and table cells.",
  preview: "Preview",
  inlineDemo: {
    title: "Inline (Tufte pattern)",
    before: "Daily signups have trended up ",
    after:
      " over the last 12 days. The chart sits at word-scale, not as a separate figure.",
  },
  installation: "Installation",
  usage: "Usage",
  inlineUsage: "Inline usage",
  props: {
    title: "Props",
    descriptions: {
      data: "Array of values to render as bars",
      width: "Chart width in pixels",
      height: "Chart height in pixels",
      gap: "Gap between bars in pixels",
    },
  },
  table: {
    name: "Name",
    type: "Type",
    default: "Default",
    description: "Description",
  },
  whenTo: {
    title: "When to use",
    body: "Inside metric cards, table cells, paragraphs of prose, or anywhere a trend is secondary context — not the main figure. Word-sized so it doesn’t demand attention; embedded so it provides instant context without forcing a glance away.",
  },
  whenNot: {
    title: "When not to use",
    body: "For standalone charts with axes and tooltips use Bar Chart or Line Chart. Sparklines have no axis, no labels, no legend — only the shape of the trend. If readers need exact values, pair the sparkline with a number next to it.",
  },
  designPrinciple: {
    title: "Design principle",
    body: [
      "Word-sized graphics (Tufte). Same accent color as everywhere else via ",
      { code: "--brock-accent" },
      ". No axes, no annotations — the bars are the data. The component renders as inline SVG so it sits inside flowing text without breaking line height.",
    ],
  },
  inspiredBy: {
    title: "Inspired by",
    items: [
      "Edward Tufte — “word-sized graphics”",
      "Stripe annual letters — embedded trend bars in prose",
      "Financial Times graphics — inline charts alongside narrative",
    ],
  },
};

const ru: SparklineContent = {
  kicker: "Графики · Sparkline",
  title: "Sparkline",
  intro:
    "График размером со слово — данные прямо в тексте. Канон Тафти: «данные там, где их читают». Создан жить внутри абзацев, метрик-карточек и ячеек таблиц.",
  preview: "Превью",
  inlineDemo: {
    title: "В строке текста (паттерн Тафти)",
    before: "Ежедневные регистрации растут ",
    after:
      " последние 12 дней. График стоит в масштабе слова — не отдельной фигурой.",
  },
  installation: "Установка",
  usage: "Использование",
  inlineUsage: "Использование в строке",
  props: {
    title: "Пропы",
    descriptions: {
      data: "Массив значений — по столбику на каждое",
      width: "Ширина графика в пикселях",
      height: "Высота графика в пикселях",
      gap: "Зазор между столбиками в пикселях",
    },
  },
  table: {
    name: "Имя",
    type: "Тип",
    default: "По умолчанию",
    description: "Описание",
  },
  whenTo: {
    title: "Когда использовать",
    body: "В метрик-карточках, ячейках таблиц, абзацах текста — везде, где тренд служит контекстом, а не главной фигурой. Размер слова не требует внимания; встроенность даёт мгновенный контекст, не заставляя отводить взгляд.",
  },
  whenNot: {
    title: "Когда не использовать",
    body: "Для самостоятельных графиков с осями и тултипами берите Bar Chart или Line Chart. У спарклайна нет оси, подписей и легенды — только форма тренда. Если читателю нужны точные значения, поставьте рядом число.",
  },
  designPrinciple: {
    title: "Принцип дизайна",
    body: [
      "Графика размером со слово (Тафти). Тот же акцентный цвет, что и везде, — через ",
      { code: "--brock-accent" },
      ". Без осей и аннотаций — столбики и есть данные. Компонент рендерится как inline SVG и стоит в потоке текста, не ломая межстрочный интервал.",
    ],
  },
  inspiredBy: {
    title: "Источники",
    items: [
      "Эдвард Тафти — «word-sized graphics»",
      "Годовые письма Stripe — трендовые столбики внутри прозы",
      "Графика Financial Times — inline-графики рядом с нарративом",
    ],
  },
};

export const sparklineContent: Record<Locale, SparklineContent> = { en, ru };
