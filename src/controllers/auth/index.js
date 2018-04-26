const joi = require("joi");
const path = require("path");

const dbPromise = require(path.join(process.cwd(), "src/db")).dbPromise;
const util = require(path.join(process.cwd(), "src/util"));

const loginSchema = joi.object().keys({
  email: joi
    .string()
    .email()
    .required(),
  password: joi.string().required()
});

exports.login = async (req, res) => {
  const validate = joi.validate(req.body, loginSchema);
  if (validate.error)
    return res
      .status(400)
      .json({ error: "You must provide an email and password" });
  const { email, password } = req.body;
  const user = await util.getUser(email);
  if (!user)
    return res.status(401).json({ error: "Invalid email or password" });
  const validPassword = await util.comparePassword(
    password,
    user.passwordHash || ""
  );
  if (!validPassword)
    return res.status(401).json({ error: "Invalid email or password" });
  const { passwordHash, ...userSanitized } = user;
  const token = util.signToken(userSanitized);
  userSanitized.token = token;
  return res.json({ user: userSanitized });
};
