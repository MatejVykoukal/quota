import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		setupFiles: ["./tests/setup.ts"],
		// Integration tests share one Postgres; run files sequentially.
		fileParallelism: false,
	},
	resolve: {
		alias: { "@": path.resolve(__dirname, "./src") },
	},
});
