export default {
    generatePassword() {
        var pwdChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%^&(){}[]<>,./!";
        var pwdLen = 4;
        return Math.random().toString(36).substr(2,8) + Array(pwdLen).fill(pwdChars).map(function(x) { return x[Math.floor(Math.random() * x.length)] }).join('');
    }
}