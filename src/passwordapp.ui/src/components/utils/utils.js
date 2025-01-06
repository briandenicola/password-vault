export default {
    generatePassword(length=13) {
        const uppercaseChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const lowercaseChars = "abcdefghijklmnopqrstuvwxyz";
        const digitChars = "0123456789";
        const specialChars = "!@#$%^&*()_+[]{}|;:',.<>?/`~\\-=";

        const allChars = uppercaseChars + lowercaseChars + digitChars + specialChars;

        const getRandomChar = (charset) => {
            const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % charset.length;
            return charset[randomIndex];
        };

        let password = "";

        password += getRandomChar(uppercaseChars);
        password += getRandomChar(lowercaseChars);
        password += getRandomChar(digitChars);
        password += getRandomChar(specialChars);

        for (let i = 4; i < length; i++) {
            password += getRandomChar(allChars);
        }

        password = function (str) {
            const array = str.split("");
            for (let i = array.length - 1; i > 0; i--) {
              const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
              [array[i], array[j]] = [array[j], array[i]];
            }
            return array.join("");
        }(password);

        return password;
    }
}