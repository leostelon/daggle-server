const fs = require("fs");
const path = require("path");
const router = require("express").Router();
const { SpheronClient, ProtocolEnum } = require("@spheron/storage");
const { upload } = require("../middlewares/multer");
const { db } = require("../polybase");
const { auth } = require("../middlewares/auth");

const token = process.env.SPHERON_TOKEN;
const client = new SpheronClient({ token });
const dataReference = db.collection("Dataset");

router.post(
	"/upload/dataset",
	auth,
	upload.array("file"),
	async (req, res) => {
		try {
			if (req.files && req.files.length === 0) {
				return res.send({ message: "Please upload a file." });
			}
			const files = req.files;
			const name = req.body.name;
			const description = req.body.description;
			const stableDiffusionEnabled =
				req.body.stableDiffusionEnabled === "false" ? false : true;

			// Upload to Spheron
			let filePath;
			if (stableDiffusionEnabled) {
				filePath = path.join(__dirname, "../../uploads/");
			} else {
				filePath = path.join(__dirname, "../../uploads/" + files[0].filename);
			}
			let currentlyUploaded = 0;
			const response = await client.upload(filePath, {
				protocol: ProtocolEnum.IPFS,
				name: "hackfs",
				onUploadInitiated: (uploadId) => {
					console.log(`Upload with id ${uploadId} started...`);
				},
				onChunkUploaded: (uploadedSize, totalSize) => {
					currentlyUploaded += uploadedSize;
					console.log(`Uploaded ${currentlyUploaded} of ${totalSize} Bytes.`);
				},
			});

			// Upload to polybase
			repoImage = await dataReference.create([
				name,
				response.protocolLink,
				req.user.id,
				description,
				currentlyUploaded
			]);

			// Delete Files
			for (const file of files) {
				fs.rmSync(`${file.destination}/${file.filename}`);
			}

			res.send(response);
		} catch (error) {
			console.log(error);
			res.status(500).send({ message: error.message });
		}
	},
	(err, req, res, next) => {
		console.log(err);
		res.status(400).send({ error: err.message });
	}
);

router.post(
	"/upload/file",
	auth,
	upload.single("file"),
	async (req, res) => {
		try {
			if (!req.file) {
				return res.status(500).send({ message: "Please upload a file." });
			}
			const file = req.file;

			// Upload to Spheron
			let filePath;
			filePath = path.join(__dirname, "../../uploads/" + file.filename);
			let currentlyUploaded = 0;
			const response = await client.upload(filePath, {
				protocol: ProtocolEnum.IPFS,
				name: "hackfs",
				onUploadInitiated: (uploadId) => {
					console.log(`Upload with id ${uploadId} started...`);
				},
				onChunkUploaded: (uploadedSize, totalSize) => {
					currentlyUploaded += uploadedSize;
					console.log(`Uploaded ${currentlyUploaded} of ${totalSize} Bytes.`);
				},
			});

			// Delete Files
			fs.rmSync(`${file.destination}/${file.filename}`);

			res.send({ ...response, file });
		} catch (error) {
			console.log(error);
			res.status(500).send({ message: error.message });
		}
	},
	(err, req, res, next) => {
		console.log(err);
		res.status(400).send({ error: err.message });
	}
);

module.exports = router;
