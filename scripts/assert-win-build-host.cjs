const nativeModules = ["better-sqlite3"];

if (process.platform === "win32") {
  process.exit(0);
}

console.error("");
console.error("Windows build blocked on non-Windows host.");
console.error("");
console.error(
  `This project depends on native modules (${nativeModules.join(", ")}), and the packaged Windows app would include Linux binaries.`,
);
console.error(
  'That produces errors like "is not a valid Win32 application" at runtime.',
);
console.error("");
console.error(
  "Build the Windows installer on a Windows machine or on a Windows CI runner.",
);
console.error("");
console.error("Suggested commands on Windows:");
console.error("  npm ci");
console.error("  npm run dist:win");
console.error("");
console.error(
  "If you prefer pnpm on Windows, reinstall dependencies there first:",
);
console.error("  pnpm install");
console.error("  pnpm approve-builds");
console.error("  pnpm rebuild electron better-sqlite3");
console.error("  pnpm run dist:win");
console.error("");

process.exit(1);
