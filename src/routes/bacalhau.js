const fs = require("fs");
const util = require("util");
const path = require("path");
const exec = util.promisify(require("child_process").exec);
const { SpheronClient, ProtocolEnum } = require("@spheron/storage");
const router = require("express").Router();
const { auth } = require("../middlewares/auth");
const { db } = require("../polybase");
const { query } = require("express");

const jobReference = db.collection("Job");
const modelReference = db.collection("Model");

const token = process.env.SPHERON_TOKEN;
const client = new SpheronClient({ token });

router.post("/bacalhau/fileupload", auth, async (req, res) => {
	try {
		const { url } = req.body;
		if (!url)
			return res
				.status(500)
				.send({ message: "Please send url!" });

		// Create upload file job
		const command = `bacalhau docker run -i ${url} --id-only alpine -- sh -c "cp -r /inputs/* /outputs/"`;
		const { stdout, stderr } = await exec(command);
		if (stderr) return console.log("Error", stderr);
		const jobId = stdout.replace(/(\r\n|\n|\r)/gm, "");

		// Upload job id to polybase
		const response = await jobReference.create([jobId, req.user.id, "file-upload"]);

		res.send(response.data);
	} catch (error) {
		console.log(error.message);
	}
});

router.post("/bacalhau/pythonscript", auth, async (req, res) => {
	try {
		const { script } = req.body;
		if (!script)
			return res
				.status(500)
				.send({ message: "Please send script!" });

		// Create File
		var writeStream = fs.createWriteStream(`model-${Date.now()}.py`);
		writeStream.write(script);
		writeStream.end();

		// Upload File
		let currentlyUploaded = 0;
		const fileUploadResponse = await client.upload(path.join(__dirname, `../../${writeStream.path}`), {
			protocol: ProtocolEnum.FILECOIN,
			name: "hackfs",
			onUploadInitiated: (uploadId) => {
				console.log(`Upload with id ${uploadId} started...`);
			},
			onChunkUploaded: (uploadedSize, totalSize) => {
				currentlyUploaded += uploadedSize;
				console.log(`Uploaded ${currentlyUploaded} of ${totalSize} Bytes.`);
			},
		});

		// Delete file
		fs.rmSync(path.join(__dirname, `../../${writeStream.path}`));

		res.send({ ...fileUploadResponse, filename: writeStream.path });
	} catch (error) {
		console.log(error.message);
	}
});

router.post("/bacalhau/traintensorflow", auth, async (req, res) => {
	try {
		let { scriptUrl, datasetUrl, filename } = req.body;
		if (!scriptUrl || !filename || !datasetUrl)
			return res
				.status(500)
				.send({ message: "Please send scriptUrl, datasetUrl & filename!" });

		// Create upload file job
		datasetUrl = datasetUrl.replace(".ipfs.sphn.link", "").replace("https", "ipfs");
		const command = `bacalhau docker run --wait=false --id-only -w /inputs  -i ${scriptUrl}/${filename} -i ${datasetUrl} tensorflow/tensorflow -- python ${filename}`;
		const { stdout, stderr } = await exec(command);
		if (stderr) return res.status(500).send({ message: stderr });
		const jobId = stdout.replace(/(\r\n|\n|\r)/gm, "");

		// Upload job id to polybase
		const response = await jobReference.create([jobId, req.user.id, "train-tensorflow"]);

		res.send(response.data);
	} catch (error) {
		console.log(error.message);
	}
});

router.get("/bacalhau", auth, async (req, res) => {
	try {
		const response = await jobReference
			.where("user", "==", req.user.id)
			.sort("timestamp", "desc")
			.get();

		res.send(response.data);
	} catch (error) {
		console.log(error.message);
	}
});

router.get("/bacalhau/job", auth, async (req, res) => {
	try {
		// Get job
		const command = `bacalhau describe ${req.query.id} --json`;
		const { stdout, stderr } = await exec(command);
		if (stderr) return res.status(500).send({ message: stderr });
		const parsedOutput = JSON.parse(stdout);
		const cid = parsedOutput.State.Executions[1].PublishedResults.CID;
		const state = parsedOutput.State.State;

		await jobReference.record(req.query.id).call("updateStatus", [state]);
		if (state === "Completed") {
			await jobReference.record(req.query.id).call("updateResult", [cid]);
			if (req.query.type === "train-tensorflow") {
				// Create new model
				await modelReference.create([req.query.id, req.user.id, cid, new Date(parsedOutput.State.UpdateTime).valueOf()]);
			}
		}
		res.send(parsedOutput);
	} catch (error) {
		console.log(error.message);
	}
});

module.exports = router;

// bacalhau docker run -i ipfs://QmRKnvqvpFzLjEoeeNNGHtc7H8fCn9TvNWHFnbBHkK8Mhy jsacex/dreambooth:full --id-only -- bash finetune.sh /inputs /outputs "a photo of sbf man" 3000
// bacalhau docker run \ --gpu 1 \ -i ipfs://QmRKnvqvpFzLjEoeeNNGHtc7H8fCn9TvNWHFnbBHkK8Mhy \ jsacex/dreambooth:full \ -- bash finetune.sh /inputs /outputs "a photo of sbf man" "a photo of man" 3000 "/man"  "/model"

// bacalhau docker run -i
// https://camo.githubusercontent.com/86f745f3132302e706e67
// --wait alpine -- sh -c "cp -r /inputs/* /outputs/"

// bacalhau docker run leostelon/test:0.4 -- sh -c "cp -r /results/* /outputs/"

// bacalhau get f3098d34-41cc-4e13-b30c-be16b4eced57 --output-dir data

// bacalhau docker run --id-only -w /inputs -i https://gist.githubusercontent.com/js-ts/e7d32c7d19ffde7811c683d4fcb1a219/raw/ff44ac5b157d231f464f4d43ce0e05bccb4c1d7b/train.py -i https://storage.googleapis.com/tensorflow/tf-keras-datasets/mnist.npz tensorflow/tensorflow -- python train.py