const fs = require('fs');
const path = require('path');
const file = 'c:/Users/Vince/NEW/app/(tabs)/userlogin.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes("import { useTheme }")) {
  content = content.replace("import { useRouter }", "import { useRouter } from 'expo-router';\nimport { useTheme } from './ThemeContext';");
}

if (!content.includes("const { colors, theme } = useTheme()")) {
  content = content.replace("const router = useRouter();", "const router = useRouter();\n  const { colors, theme } = useTheme();\n  const isDark = theme === 'dark';\n  const dyn = {\n    bg: { backgroundColor: colors.background },\n    text: { color: colors.text },\n    sub: { color: colors.subText },\n    card: { backgroundColor: colors.card },\n    inputBg: { backgroundColor: isDark ? '#1A1A1A' : '#FAFAFA', borderColor: colors.border, color: colors.text }\n  };");
}

content = content.replace(/<StatusBar barStyle="light-content" \/>/g, '<StatusBar barStyle={isDark ? "light-content" : "dark-content"} />');

content = content.replace(/style=\{styles\.container\}/g, "style={[styles.container, dyn.bg]}");
content = content.replace(/style=\{styles\.headerTitle\}/g, "style={[styles.headerTitle, dyn.text]}");
content = content.replace(/style=\{styles\.headerSubtitle\}/g, "style={[styles.headerSubtitle, dyn.sub]}");

content = content.replace(/style=\{styles\.label(?:,?\s*\{[^\}]+\})?\}/g, (match) => {
    if (match.includes("marginTop")) return "style={[styles.label, dyn.sub, { marginTop: 15 }]}";
    return "style={[styles.label, dyn.sub]}";
});

content = content.replace(/style=\{styles\.input\}/g, "style={[styles.input, dyn.inputBg]}");
content = content.replace(/style=\{\[styles\.input, styles\.datePickerButton\]\}/g, "style={[styles.input, dyn.inputBg, styles.datePickerButton]}");
content = content.replace(/style=\{styles\.passwordContainer\}/g, "style={[styles.passwordContainer, dyn.inputBg]}");
content = content.replace(/style=\{styles\.passwordInput\}/g, "style={[styles.passwordInput, { color: colors.text }]}");

content = content.replace(/placeholderTextColor="#666"/g, 'placeholderTextColor={isDark ? "#666" : "#A0A0A0"}');

content = content.replace(/color: '#fff'/g, "color: isDark ? '#fff' : '#000'");

fs.writeFileSync(file, content);
console.log("Refactored UserLogin successfully");
