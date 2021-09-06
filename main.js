require("modernscript/register");
const fs = require("fs");
const { handler } = require("./index");

const ENV_FILE = ".env.local.json";

async function main() {
  let env = process.env;
  try {
    const loaded = JSON.parse(fs.readFileSync(ENV_FILE, "utf-8"));
    env = { ...loaded, ...env };
  } catch (err) {
    console.warn(`WARN: `, err);
  }

  for (;;) {
    await handler();
    await new Promise((resolve) => setTimeout(resolve, 60000));
  }
}

main().then(
  () => console.log("done."),
  (err) => {
    console.error("FATAL: ", err);
    process.exit(1);
  }
);
