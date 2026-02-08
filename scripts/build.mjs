import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

const watch = process.argv.includes("--watch");

function copyStatic() {
  fs.copyFileSync("src/popup/popup.html", "dist/popup.html");
  fs.copyFileSync("src/popup/popup.css", "dist/popup.css");
  
  // 아이콘 폴더 복사
  const iconsDir = "icons";
  const distIconsDir = "dist/icons";
  
  // dist/icons 폴더가 없으면 생성
  if (!fs.existsSync(distIconsDir)) {
    fs.mkdirSync(distIconsDir, { recursive: true });
  }
  
  // icons 폴더의 모든 파일 복사
  if (fs.existsSync(iconsDir)) {
    const files = fs.readdirSync(iconsDir);
    files.forEach(file => {
      fs.copyFileSync(
        path.join(iconsDir, file),
        path.join(distIconsDir, file)
      );
    });
    console.log(`✅ Copied ${files.length} icon files to dist/icons/`);
  }
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
