import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Pretty registry URLs: /r/column-chart -> /r/column-chart.json.
      // afterFiles, so existing .json files in public/ always win first.
      { source: "/r/:name", destination: "/r/:name.json" },
    ];
  },
};

export default withNextIntl(nextConfig);
