import esbuild from "esbuild";
import fs from "node:fs";

const watch = process.argv.includes("--watch");

function copyStatic() {
  fs.copyFileSync("src/popup/popup.html", "dist/popup.html");
  fs.copyFileSync("src/popup/popup.css", "dist/popup.css");
}

const config = {
  bundle: true,
  platform: "browser",
  target: "es2022",
  sourcemap: true,
  outdir: "dist",
  entryPoints: {
    content: "src/content/content.ts",
    background: "src/background/background.ts",
    popup: "src/popup/popup.ts"
  }
};

if (watch) {
  copyStatic();
  const ctx = await esbuild.context(config);
  await ctx.watch();
  fs.watch("src/popup", { recursive: true }, copyStatic);
  console.log("▶ Watching (esbuild + static assets)");
} else {
  copyStatic();
  await esbuild.build(config);
}
