const joi = require("joi");
const path = require("path");
const pug = require("pug");
const SparkPost = require("sparkpost");

const client = new SparkPost(process.env.SPARKPOST_KEY);

const confirmAccountTemplate = pug.compileFile(
  path.join(process.cwd(), "src/mail/templates/ConfirmAccount.pug")
);
const confirmAccountSchema = joi.object().keys({
  email: joi
    .string()
    .email()
    .required(),
  registrationLink: joi.string().required()
});

exports.sendAccountConfirmationEmail = async params => {
  const validate = joi.validate(params, confirmAccountSchema);
  if (validate.error) return false;
  const html = confirmAccountTemplate(params);
  try {
    const email = await client.transmissions.send({
      options: {
        open_tracking: false,
        click_tracking: false
      },
      content: {
        from: {
          name: "QuickSend Account Management",
          email: "notifications@mail.quicksend.io"
        },
        subject: "QuickSend Registration",
        html
      },
      recipients: [{ address: process.env.TEST_EMAIL || params.email }]
    });
    return true;
  } catch (err) {
    console.log(err);
    return false;
  }
};
