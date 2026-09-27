import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repository root has its own lockfile (program tooling); this app is
  // self-contained in web/.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
