const fs = require('fs');
const file = 'c:/Users/Vince/NEW/app/(tabs)/userlogin.tsx';
let content = fs.readFileSync(file, 'utf8');

// The StyleSheet block starts around line 1000
const parts = content.split('const styles = StyleSheet.create({');

if (parts.length === 2) {
    // Only replace inside the StyleSheet
    parts[1] = parts[1].replace(/isDark \? '#fff' : '#000'/g, "'#fff'");
    content = parts[0] + 'const styles = StyleSheet.create({' + parts[1];
    fs.writeFileSync(file, content);
}
console.log("Fixed styles");
