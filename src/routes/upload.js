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
			const dataset = req.body.dataset;
			const description = req.body.description;
			const stableDiffusionEnabled =
				req.body.stableDiffusionEnabled === "false" ? false : true;
			const tag = dataset.split(":").pop();
			const name = dataset.split(":").slice(0, -1).join(":");

			// Upload to Spheron
			let filePath;
			if (stableDiffusionEnabled) {
				filePath = path.join(__dirname, "../../uploads/");
			} else {
				filePath = path.join(__dirname, "../../uploads/" + files[0].filename);
			}
			const response = await client.upload(filePath, {
				protocol: ProtocolEnum.IPFS,
				name: "testdaggle",
				onUploadInitiated: (uploadId) => {
					console.log(`Upload with id ${uploadId} started...`);
				},
				onChunkUploaded: (uploadedSize, totalSize) => {
					let currentlyUploaded;
					currentlyUploaded += uploadedSize;
					console.log(`Uploaded ${currentlyUploaded} of ${totalSize} Bytes.`);
				},
			});

			// Check for latest
			const dataSetList = await dataReference
				.where("name", "==", `${req.user.id}/${name}`)
				.where("latest", "==", true)
				.get();
			if (dataSetList.data.length > 0) {
				ds = dataSetList.data[0].data;
				await dataReference.record(ds.id).call("disableLatest", []);
			}
			// Upload to polybase
			repoImage = await dataReference.create([
				`${req.user.id}/${name}`,
				tag,
				response.protocolLink,
				req.user.id,
				description,
				stableDiffusionEnabled,
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

module.exports = router;
