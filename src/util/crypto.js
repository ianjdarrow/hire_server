const crypto = require("crypto");
const IV_LENGTH = 16;

const encrypt = text => {
  const version = process.env.ENCRYPTION_KEY_VERSION;
  const ENCRYPTION_KEY = process.env[`ENCRYPTION_KEY_${version}`];
  let iv = crypto.randomBytes(IV_LENGTH);
  let cipher = crypto.createCipheriv(
    "aes-256-cbc",
    new Buffer(ENCRYPTION_KEY),
    iv
  );
  let encrypted = cipher.update(text);

  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return (
    version + ":" + iv.toString("base64") + ":" + encrypted.toString("base64")
  );
};

const decrypt = text => {
  let textParts = text.split(":");
  let version = textParts.shift();
  const ENCRYPTION_KEY = process.env[`ENCRYPTION_KEY_${version}`];
  let iv = new Buffer(textParts.shift(), "base64");
  let encryptedText = new Buffer(textParts.shift(), "base64");
  let decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    new Buffer(ENCRYPTION_KEY),
    iv
  );
  let decrypted = decipher.update(encryptedText);

  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
};

const hash = text => {
  return crypto
    .createHash("sha256")
    .update(text, "utf8")
    .digest("base64");
};

module.exports = { decrypt, encrypt, hash };
