import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [path.resolve(__dirname, "..")]
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [path.resolve(__dirname, "../others/tests/setup.ts").replace(/\\/g, "/")],
    server: {
      deps: {
        inline: ["react", "react-dom"]
      }
    },

    // Include all test directories
    include: [
      path.resolve(__dirname, "../others/tests/**/*.{test,spec}.{ts,tsx}").replace(/\\/g, "/"),
    ],

    // Coverage configuration (run with --coverage)
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      include: [
        // Scoring engine (pure TS)
        "../backend/supabase/functions/analyze-5s/scoring/**/*.ts",
        // AI modules (pure TS, no Deno globals)
        "../gemini/ai-engines/ObservationCache.ts",
        "../gemini/ai-engines/RuleEngine.ts",
        "../gemini/ai-engines/ConsistencyValidator.ts",
        "../gemini/ai-engines/ReliabilityClassifier.ts",
      ],
      exclude: [
        // Exclude Deno entry point (Deno globals, not runnable in Node)
        "../backend/supabase/functions/analyze-5s/index.ts",
        // Exclude AI call files (tested via integration, not unit)
        "../gemini/ai-engines/VisionAnalyzer.ts",
        "../gemini/ai-engines/RecommendationEngine.ts",
      ],
    },
  },
  resolve: {
    alias: {
      // @ → src (React app)
      "@": path.resolve(__dirname, "./src"),
      "react": path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      "@testing-library/react": path.resolve(__dirname, "./node_modules/@testing-library/react"),
      "@testing-library/jest-dom": path.resolve(__dirname, "./node_modules/@testing-library/jest-dom"),
    },
    // Allow .ts extensions in imports (Deno-style imports in supabase functions)
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },
});
