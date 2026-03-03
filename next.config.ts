import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained .next/standalone build — required by the Dockerfile.
  output: "standalone",
  experimental: {
    // Tree-shake large icon/component libraries — only bundle what's actually imported.
    // Cuts first-load compilation significantly for lucide-react (575+ icons) and recharts.
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@hello-pangea/dnd",
      "date-fns",
    ],
  },
};

export default nextConfig;
