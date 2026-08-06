import type { Config } from "tailwindcss";

// Só tema escuro de propósito — não é um toggle, é a aparência única do
// produto (dashboards dark-mode), como pedido.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
