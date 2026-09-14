import nextPlugin from "eslint-config-next";

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "coverage/**",
      "prisma/migrations/**",
      "src/generated/**",
    ],
  },
  ...nextPlugin,
];

export default eslintConfig;
