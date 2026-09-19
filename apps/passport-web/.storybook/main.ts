import type { StorybookConfig } from "@storybook/react-vite";
import path from "path";

const config: StorybookConfig = {
  stories: ["../components/**/*.stories.@(js|jsx|ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-links",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  typescript: {
    check: false,
    reactDocgen: false,
  },
  viteFinal: async (config) => {
    // Alias Next.js specific modules to Storybook mocks so components can run
    // outside of the Next.js runtime.
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "next/image": path.resolve(__dirname, "./mocks/next-image.ts"),
      "next/link": path.resolve(__dirname, "./mocks/next-link.ts"),
      "next/navigation": path.resolve(__dirname, "./mocks/next-navigation.ts"),
      "next/head": path.resolve(__dirname, "./mocks/next-head.ts"),
    };
    
    // Configure esbuild to automatically inject React for JSX
    config.esbuild = {
      ...(config.esbuild ?? {}),
      jsxInject: `import React from 'react'`,
    };
    
    return config;
  },
};

export default config;
