const router = require("express").Router();
const upload = require("./upload");
const dataset = require("./dataset");
const token = require("./token");
const user = require("./user");
const bacalhau = require("./bacalhau");
const {push} = require("./push");

router.use(upload);
router.use(dataset);
router.use(user);
router.use(token);
router.use(bacalhau);
router.use(push);

module.exports = router;
