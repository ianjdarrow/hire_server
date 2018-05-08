const joi = require("joi");
const path = require("path");
const uuid = require("short-uuid");

const dbPromise = require(path.join(process.cwd(), "src/db")).dbPromise;
const mail = require(path.join(process.cwd(), "src/mail"));
const util = require(path.join(process.cwd(), "src/util"));

const genRegistrationLink = link =>
  `${process.env.ABS_PATH}/signup/confirm/${link}`;

const loginSchema = joi.object().keys({
  email: joi
    .string()
    .email()
    .lowercase()
    .required(),
  password: joi.string().required()
});

exports.login = async (req, res) => {
  const validate = joi.validate(req.body, loginSchema, { allowUnknown: true });
  if (validate.error) {
    return res
      .status(400)
      .json({ error: "You must provide an email and password" });
  }
  const { email, password } = validate.value;
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

exports.signup = async (req, res) => {
  const validate = joi.validate(req.body, loginSchema);
  if (validate.error) {
    return res
      .status(400)
      .json({ error: "You must provide an email and password" });
  }
  const { email, password } = validate.value;
  const hashed = await util.hashPassword(password);
  const registrationLink = uuid.uuid();

  const db = await dbPromise;
  try {
    const addUser = await db.run(
      `
      INSERT INTO users (
        email,
        passwordHash,
        registrationLink
      ) VALUES (?,?,?)
    `,
      email,
      hashed,
      registrationLink
    );
    if (!addUser.lastID) {
      console.log(addUser);
      return res.status(401).json({ error: "Unable to create account" });
    }
    const registrationLinkURL = genRegistrationLink(registrationLink);
    mail.sendAccountConfirmationEmail({
      email,
      registrationLink: registrationLinkURL
    });
    const user = await util.getUser(email);
    const { passwordHash, ...userSanitized } = user;
    const token = util.signToken(userSanitized);
    userSanitized.token = token;
    return res.json({ user: userSanitized });
  } catch (err) {
    console.log(err);
    return res.status(401).json({ error: "Unable to create account" });
  }
};

exports.confirmRegistration = async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({});
  const db = await dbPromise;
  const validate = await db.run(
    `
    UPDATE users
    SET hasRegistered = 1
    WHERE registrationLink = ?
    AND hasRegistered = 0
  `,
    id
  );
  if (validate.changes) {
    const user = await db.get(
      `
      SELECT email, hasRegistered
      FROM users
      WHERE registrationLink = ?
    `,
      id
    );
    user.token = util.signToken(user);
    return res.json({ user });
  }
  return res.status(401).json({ error: "Error confirming account" });
};

exports.sendRegistrationLink = async (req, res) => {
  try {
    const { email } = req.user;
    const db = await dbPromise;
    const user = await db.get(
      `
      SELECT
        email,
        registrationLink
      FROM users
      WHERE email = ?
      AND hasRegistered = 0
    `,
      email
    );
    const registrationLink = genRegistrationLink(user.registrationLink);
    mail.sendAccountConfirmationEmail({ email, registrationLink });
    res.json({});
  } catch (err) {
    res.status(400).json({});
  }
};

exports.checkToken = (req, res) => {
  return res.json({ user: req.user });
};
