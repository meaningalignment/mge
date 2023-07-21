import type { Config } from "tailwindcss"

export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#FFFFFF",
        foreground: "#0A0D0F",
        muted: "#F2F2F5",
        "muted-foreground": "#767A7D",
        popover: "#FFFFFF",
        "popover-foreground": "#0A0D0F",
        card: "#FFFFFF",
        "card-foreground": "#0A0D0F",
        border: "#E6E7E8",
        input: "#E6E7E8",
        primary: "#1A1D1F",
        "primary-foreground": "#FAFAFA",
        secondary: "#F2F2F5",
        "secondary-foreground": "#1A1D1F",
        accent: "#F2F2F5",
        destructive: "#993333",
        "destructive-foreground": "#FAFAFA",
        ring: "#A6A8AB",
      },
    },
  },
  plugins: [],
} satisfies Config
