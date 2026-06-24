import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        // test infrastructure
        "src/test/**",
        "src/main.tsx",
        "src/**/*.d.ts",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.stories.{ts,tsx}",
        // router / types — nothing to unit-test
        "src/routes/**",
        "src/types/**",
        // pure markup: layouts, static pages, home marketing components
        "src/layouts/**",
        "src/pages/home/**",
        "src/pages/policy/**",
        "src/pages/error/**",
        "src/pages/auth/**",       // auth logic is covered via AuthContext.test.tsx
        "src/components/home/**",
        "src/components/shared/**",
        "src/components/dashboard/**",
        "src/components/ui/**",
        "src/dashboard/**",
        "src/lib/utils.ts",        // shadcn cn() helper, no logic to test
        // infrastructure / config — no business logic
        "src/data/**",
        "src/i18n/**",
        "src/components/mode-toggle.tsx",
        "src/components/theme-provider.tsx",
      ],
      thresholds: {
        lines: 80,
        statements: 74,
        functions: 67,
        branches: 65,
      },
      reporter: ["text", "text-summary"],
    },
  },
})
