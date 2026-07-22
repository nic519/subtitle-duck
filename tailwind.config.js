const colorVariable = (name) => ({ opacityValue }) => {
  if (opacityValue === undefined) {
    return `var(${name})`;
  }

  return `color-mix(in oklch, var(${name}) calc(${opacityValue} * 100%), transparent)`;
};

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: colorVariable("--border"),
        input: colorVariable("--input"),
        ring: colorVariable("--ring"),
        background: colorVariable("--background"),
        foreground: colorVariable("--foreground"),
        primary: {
          DEFAULT: colorVariable("--primary"),
          foreground: colorVariable("--primary-foreground"),
        },
        secondary: {
          DEFAULT: colorVariable("--secondary"),
          foreground: colorVariable("--secondary-foreground"),
        },
        destructive: {
          DEFAULT: colorVariable("--destructive"),
          foreground: colorVariable("--primary-foreground"),
        },
        muted: {
          DEFAULT: colorVariable("--muted"),
          foreground: colorVariable("--muted-foreground"),
        },
        accent: {
          DEFAULT: colorVariable("--accent"),
          foreground: colorVariable("--accent-foreground"),
        },
        popover: {
          DEFAULT: colorVariable("--popover"),
          foreground: colorVariable("--popover-foreground"),
        },
        card: {
          DEFAULT: colorVariable("--card"),
          foreground: colorVariable("--card-foreground"),
        },
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          500: '#667eea',
          600: '#5568d3',
          700: '#764ba2',
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: "var(--font-ui)",
        mono: "var(--font-mono)",
      },
    },
  },
  plugins: [],
}






