// vite.config.js
import { defineConfig } from "vite";
import anywidget from "@anywidget/vite";
import react from "@vitejs/plugin-react";

export default defineConfig(() => {
  // Read the component name passed after Vite's `--` argument separator.
  const isProd = process.env.NODE_ENV === "production";
  const inputArg = process.argv.find((arg) => arg.startsWith("--input="));
  if (!inputArg) {
    throw new Error("No input argument provided.");
  }
  const inputFile = inputArg.slice("--input=".length);
  if (!inputFile) {
    throw new Error("The --input argument must name a file in the js directory.");
  }
  const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
  let target = "anywidget";
  if (targetArg) {
    target = targetArg.slice("--target=".length);
    if (target !== "anywidget" && target !== "streamlit") {
      throw new Error("The --target argument must be either 'anywidget' or 'streamlit'.");
    }
  }

  return {
    build: {
      minify: isProd ? "oxc" : false,
      sourcemap: !isProd,
      outDir: "src/neoscope/static",
      emptyOutDir: false,
      lib: {
        entry: {
          [inputFile]: `js/${inputFile}.tsx`,
        },
        formats: ["es"],
      },
      rollupOptions: {
        output: {
          entryFileNames: `${inputFile}-${target}.js`,
          assetFileNames: `${inputFile}.[ext]`,
        },
      },
      ...(isProd && {
        rolldownOptions: {
          output: {
            minify: {
              compress: {
                dropConsole: true,
                dropDebugger: true,
              },
            },
          },
        },
      }),
    },
    plugins: [anywidget(), react()],
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
      __FRAMEWORK__: JSON.stringify(target),
    },
  };
});
