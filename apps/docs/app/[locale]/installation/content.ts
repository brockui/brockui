import type { Locale } from "@/i18n/routing";
import type { Rich } from "@/lib/rich-text";

/**
 * Installation page content, both locales. TypeScript enforces structural
 * parity (drift-guard v1); the EN-hash manifest enforces freshness (v2).
 * RU: draft — awaiting founder proofread (см. docs/glossary-ru.md).
 */
export type InstallationContent = {
  kicker: string;
  title: string;
  intro: string;
  quickStart: { title: string; lead: string };
  prerequisites: { title: string; items: Rich[] };
  themeSetup: { title: string; lead: Rich };
  tailwindToken: { title: string; lead: Rich };
  customizeAccent: { title: string; body: Rich };
  whatYouGet: {
    title: string;
    items: { strong: string; rest: string }[];
  };
};

const en: InstallationContent = {
  kicker: "Get Started · Installation",
  title: "Installation",
  intro:
    "Brock UI uses the shadcn registry format. Components are copied into your project — you own the code. No runtime dependency on a Brock UI package.",
  quickStart: {
    title: "Quick start",
    lead: "Add any component to your project with one command:",
  },
  prerequisites: {
    title: "Prerequisites",
    items: [
      [{ code: "Next.js" }, " 16+ (or React 19+ for other frameworks)"],
      [{ code: "Tailwind CSS" }, " v4"],
      [{ code: "shadcn" }, " CLI: ", { code: "npm i -D shadcn" }],
      [
        "A working ",
        { code: "components.json" },
        " (run ",
        { code: "npx shadcn init" },
        " if missing)",
      ],
    ],
  },
  themeSetup: {
    title: "Theme setup",
    lead: [
      "Add the Brock UI accent color to your ",
      { code: "globals.css" },
      ". Without it, components render in default grey.",
    ],
  },
  tailwindToken: {
    title: "Tailwind v4 token",
    lead: [
      "Expose the variable as a Tailwind token so you can use ",
      { code: "bg-brock-accent" },
      ", ",
      { code: "text-brock-accent" },
      " and ",
      { code: "border-brock-accent" },
      " throughout your project. Add inside your ",
      { code: "@theme inline" },
      " block:",
    ],
  },
  customizeAccent: {
    title: "Customize the accent",
    body: [
      "One variable controls all accents across every Brock UI component. Change ",
      { code: "--brock-accent" },
      " once — every chart, every highlight, every active state updates. We recommend a single, distinct color in OKLCH for predictable behavior across themes.",
    ],
  },
  whatYouGet: {
    title: "What you get",
    items: [
      {
        strong: "Source files in your repo",
        rest: " — fully editable, no black-box package",
      },
      {
        strong: "Typed props, zero runtime dependencies",
        rest: " beyond React and Tailwind",
      },
      {
        strong: "Dark mode and light mode parity",
        rest: " out of the box",
      },
      {
        strong: "MIT license, no attribution required",
        rest: "",
      },
    ],
  },
};

const ru: InstallationContent = {
  kicker: "Начало работы · Установка",
  title: "Установка",
  intro:
    "Brock UI использует формат shadcn registry: компоненты копируются прямо в ваш проект — код принадлежит вам. Никакой runtime-зависимости от пакета Brock UI.",
  quickStart: {
    title: "Быстрый старт",
    lead: "Любой компонент добавляется в проект одной командой:",
  },
  prerequisites: {
    title: "Требования",
    items: [
      [{ code: "Next.js" }, " 16+ (или React 19+ для других фреймворков)"],
      [{ code: "Tailwind CSS" }, " v4"],
      [{ code: "shadcn" }, " CLI: ", { code: "npm i -D shadcn" }],
      [
        "Настроенный ",
        { code: "components.json" },
        " (если его нет — выполните ",
        { code: "npx shadcn init" },
        ")",
      ],
    ],
  },
  themeSetup: {
    title: "Настройка темы",
    lead: [
      "Добавьте акцентный цвет Brock UI в ",
      { code: "globals.css" },
      ". Без него компоненты рендерятся в нейтральном сером.",
    ],
  },
  tailwindToken: {
    title: "Токен Tailwind v4",
    lead: [
      "Откройте переменную как Tailwind-токен, чтобы использовать ",
      { code: "bg-brock-accent" },
      ", ",
      { code: "text-brock-accent" },
      " и ",
      { code: "border-brock-accent" },
      " по всему проекту. Добавьте внутрь блока ",
      { code: "@theme inline" },
      ":",
    ],
  },
  customizeAccent: {
    title: "Свой акцентный цвет",
    body: [
      "Одна переменная управляет акцентами во всех компонентах Brock UI. Поменяйте ",
      { code: "--brock-accent" },
      " один раз — обновится каждый график, каждое выделение, каждое активное состояние. Рекомендуем один выразительный цвет в OKLCH: он предсказуемо ведёт себя в обеих темах.",
    ],
  },
  whatYouGet: {
    title: "Что вы получаете",
    items: [
      {
        strong: "Исходники в вашем репозитории",
        rest: " — правьте свободно, никакого «чёрного ящика»",
      },
      {
        strong: "Типизированные пропы, ноль runtime-зависимостей",
        rest: " кроме React и Tailwind",
      },
      {
        strong: "Тёмная и светлая темы наравне",
        rest: " из коробки",
      },
      {
        strong: "Лицензия MIT, атрибуция не требуется",
        rest: "",
      },
    ],
  },
};

export const installationContent: Record<Locale, InstallationContent> = {
  en,
  ru,
};
