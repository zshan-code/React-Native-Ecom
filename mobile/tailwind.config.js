/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#6366F1", // Indigo
          light: "#818CF8",
          dark: "#4F46E5",
        },
        background: {
          DEFAULT: "#0F172A", // Slate 950 (Premium Dark)
          light: "#1E293B",
          lighter: "#334155",
        },
        surface: {
          DEFAULT: "#1E293B",
          light: "#334155",
        },
        text: {
          primary: "#F8FAFC",
          secondary: "#CBD5E1",
          tertiary: "#94A3B8",
        },
        accent: {
          DEFAULT: "#8B5CF6", // Violet
          red: "#F43F5E",
          yellow: "#F59E0B",
        },
      },
    },
  },
  plugins: [],
};
