const multer = require("multer");

const storage = multer.diskStorage({
	destination: function (req, file, callBack) {
		callBack(null, "./uploads");
	},
	filename: function (req, file, callBack) {
		callBack(null, file.originalname);
	},
});

const upload = multer({
	storage: storage,
	limits: {
		fileSize: 1024 * 1024 * 5,
	},
});

module.exports = { upload };
