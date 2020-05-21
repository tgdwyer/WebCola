import dts from "rollup-plugin-dts";

export default [
  {
    input: "./tmp/index.d.ts",
    output: [{
      file: "dist/core.d.ts",
      format: "esm"
    }],
    plugins: [dts()],
  },
];