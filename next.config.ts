import type { NextConfig } from "next";

/**
 * Static export only. There is no server in production: everything the app needs at
 * runtime it fetches from Technocore in the browser.
 *
 * BASE_PATH is supplied by the deploy workflow as "/<repo-name>" so the same build works
 * at https://<user>.github.io/<repo>/ without the GitHub username ever being hardcoded.
 * Locally it is empty and the app runs at http://localhost:3000.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  // GitHub Pages serves /relay/ as /relay/index.html; trailing slashes keep the two in step.
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // Next writes AGENTS.md / CLAUDE.md into the repo root on `next dev`. This project keeps
  // its guidance in README.md and BASE.md, so there is nothing for them to add.
  agentRules: false,
};

export default nextConfig;
