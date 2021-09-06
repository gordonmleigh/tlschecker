import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import builtin from "builtin-modules";
import { terser } from "rollup-plugin-terser";
import ignore from "rollup-plugin-ignore";

const DEBUGGING = !!process.env.DEBUGGING;

const external = [];
const noBundle = [...builtin, "aws-sdk", ...external];
const ignoreModules = ["stream/web"];

export default {
  input: "index.js",

  output: {
    file: "dist/bundle.js",
    format: "cjs",
    sourcemap: true,
  },

  plugins: [
    ignore(ignoreModules),
    resolve(),
    commonjs({
      ignore: ignoreModules,
    }),
    json(),
    !DEBUGGING &&
      terser({
        output: {
          comments: false,
        },
      }),
  ].filter(Boolean),

  external: (id) => noBundle.includes(id) || id.startsWith("aws-sdk/"),
};
