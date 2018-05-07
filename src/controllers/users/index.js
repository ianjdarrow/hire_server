const joi = require("joi");

const dbPromise = require("../../db").dbPromise;

const userInfoSchema = joi.object({
  name: joi.string(),
  title: joi.string()
});
exports.setUserInfo = async (req, res) => {
  const validate = joi.validate(req.body, userInfoSchema);
  if (validate.error) return res.status(400).json({});
  const { name, title } = validate.value;
  const db = await dbPromise;
  const updatedUser = await db.run(
    `
  UPDATE users
  SET name = ?, title = ?
  WHERE email = ?
  `,
    name,
    title,
    req.user.email
  );
  if (!updatedUser.changes) {
    return res.status(500).json({ error: "Unable to update user" });
  }
  return res.json({});
};
