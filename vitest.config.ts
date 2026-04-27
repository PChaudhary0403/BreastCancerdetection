import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["src/**/*.test.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            reportsDirectory: "./coverage",
            include: ["src/lib/**/*.ts"],
            exclude: ["src/lib/__tests__/**", "src/lib/useSocket.ts"],
            thresholds: {
                lines: 60,
                branches: 50,
                functions: 60,
                statements: 60,
            },
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
})
