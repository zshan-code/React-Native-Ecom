import { useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";

const THEME_KEY = "user-theme-preference";

export const useAppTheme = () => {
    const systemColorScheme = useColorScheme();
    const [theme, setTheme] = useState<"light" | "dark">(systemColorScheme || "dark");

    useEffect(() => {
        // Load saved preference
        const loadTheme = async () => {
            const savedTheme = await SecureStore.getItemAsync(THEME_KEY);
            if (savedTheme === "light" || savedTheme === "dark") {
                setTheme(savedTheme);
            }
        };
        loadTheme();
    }, []);

    const toggleTheme = async () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
        await SecureStore.setItemAsync(THEME_KEY, newTheme);
    };

    return {
        theme,
        isDark: theme === "dark",
        toggleTheme,
    };
};
