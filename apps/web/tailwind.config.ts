import type { Config } from "tailwindcss";

// slate/emerald/red/amber/sky são os únicos tons usados em toda a UI (~700
// ocorrências em 54 páginas). Em vez de prefixar cada classe com `dark:` —
// exigiria editar todo arquivo de página —, cada tom usado é redefinido aqui
// como uma var CSS (ver index.css), que troca de valor via `[data-theme]`.
// Nenhum className precisa mudar: `bg-slate-900` continua `bg-slate-900` em
// qualquer arquivo, só o hex por trás do token muda conforme o tema ativo.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: {
          50: "rgb(var(--c-slate-50) / <alpha-value>)",
          100: "rgb(var(--c-slate-100) / <alpha-value>)",
          200: "rgb(var(--c-slate-200) / <alpha-value>)",
          300: "rgb(var(--c-slate-300) / <alpha-value>)",
          400: "rgb(var(--c-slate-400) / <alpha-value>)",
          500: "rgb(var(--c-slate-500) / <alpha-value>)",
          600: "rgb(var(--c-slate-600) / <alpha-value>)",
          700: "rgb(var(--c-slate-700) / <alpha-value>)",
          800: "rgb(var(--c-slate-800) / <alpha-value>)",
          900: "rgb(var(--c-slate-900) / <alpha-value>)",
          950: "rgb(var(--c-slate-950) / <alpha-value>)",
        },
        // Só os tons usados como texto/borda "lida contra o fundo da página"
        // precisam variar por tema — bg-emerald-600, bg-red-600 etc. são
        // superfícies sólidas coloridas (botões) e ficam boas nos dois temas
        // sem ajuste, então não entram aqui.
        emerald: {
          300: "rgb(var(--c-emerald-300) / <alpha-value>)",
          400: "rgb(var(--c-emerald-400) / <alpha-value>)",
          800: "rgb(var(--c-emerald-800) / <alpha-value>)",
        },
        red: {
          400: "rgb(var(--c-red-400) / <alpha-value>)",
          800: "rgb(var(--c-red-800) / <alpha-value>)",
        },
        amber: {
          400: "rgb(var(--c-amber-400) / <alpha-value>)",
        },
        sky: {
          400: "rgb(var(--c-sky-400) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
