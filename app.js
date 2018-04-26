"use strict";

require("dotenv").config();
const bodyParser = require("body-parser");
const timeout = require("connect-timeout");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const express = require("express");
const path = require("path");

const db = require("./src/db");
db.initDB();

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(timeout(10000));
app.use(cookieParser());
app.use(cors());
app.use("/static", express.static("static"));

const router = require("./src/router");
app.use(process.env.BASE_API_ROUTE || "/", router);

app.listen(3000, () => {
  console.log("Listening on 3000");
});
