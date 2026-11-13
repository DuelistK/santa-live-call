import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        santa: {
          red: "#B81D24",
          crimson: "#8F141B",
          gold: "#E5C158",
          champagne: "#F3DC99",
          ivory: "#FAF7F2",
          pine: "#165B33",
          night: "#080E1E",
          navy: "#10192E",
          snow: "#F8FAFC",
        },
      },
      animation: {
        "pulse-slow": "pulse 3.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 4.5s ease-in-out infinite",
        "orbit-slow": "orbitSpin 18s linear infinite",
        "orbit-reverse": "orbitSpinReverse 24s linear infinite",
        "aurora-breathe": "auroraBreathe 9s ease-in-out infinite",
        "stage-breathe": "stageBreathe 7s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        orbitSpin: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        orbitSpinReverse: {
          "0%": { transform: "rotate(360deg)" },
          "100%": { transform: "rotate(0deg)" },
        },
        auroraBreathe: {
          "0%, 100%": { opacity: "0.55", transform: "translateY(0px) scale(1)" },
          "50%": { opacity: "0.85", transform: "translateY(6px) scale(1.06)" },
        },
        stageBreathe: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.025)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
