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
const userReference = db.collection("User");

const token = process.env.SPHERON_TOKEN;
const client = new SpheronClient({ token });
const { sendNotification } = require("./push")

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
		// Update Credit
		await userReference.record(req.user.id).call("subCredit", []);

		res.send(response.data);
		sendNotification(req.user.id, "File upload started")
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
		sendNotification(req.user.id, "Uploaded python script")
	} catch (error) {
		console.log(error.message);
	}
});

router.post("/bacalhau/runpython", auth, async (req, res) => {
	try {
		let { scriptUrl, filename } = req.body;
		if (!scriptUrl || !filename)
			return res
				.status(500)
				.send({ message: "Please send scriptUrl,  & filename!" });

		// Create upload file job
		const command = `bacalhau docker run --wait=false --id-only -w /inputs  -i ${scriptUrl}/${filename} python:alpine3.18 -- python ${filename}`;
		const { stdout, stderr } = await exec(command);
		if (stderr) return res.status(500).send({ message: stderr });
		const jobId = stdout.replace(/(\r\n|\n|\r)/gm, "");

		// Upload job id to polybase
		const response = await jobReference.create([jobId, req.user.id, "script-python"]);
		// Update Credit
		await userReference.record(req.user.id).call("subCredit", []);

		res.send(response.data);
		sendNotification(req.user.id, "Created python job")
	} catch (error) {
		console.log(error.message);
	}
});

router.post("/bacalhau/nodescript", auth, async (req, res) => {
	try {
		const { script } = req.body;
		if (!script)
			return res
				.status(500)
				.send({ message: "Please send script!" });

		// Create File
		var writeStream = fs.createWriteStream(`code-${Date.now()}.js`);
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
		sendNotification(req.user.id, "Uploaded node.js script")
	} catch (error) {
		console.log(error.message);
	}
});

router.post("/bacalhau/runnodejs", auth, async (req, res) => {
	try {
		let { scriptUrl, filename } = req.body;
		if (!scriptUrl || !filename)
			return res
				.status(500)
				.send({ message: "Please send scriptUrl,  & filename!" });

		// Create upload file job
		const command = `bacalhau docker run --wait=false --id-only -w /inputs  -i ${scriptUrl}/${filename} node:alpine -- node ${filename}`;
		const { stdout, stderr } = await exec(command);
		if (stderr) return res.status(500).send({ message: stderr });
		const jobId = stdout.replace(/(\r\n|\n|\r)/gm, "");

		// Upload job id to polybase
		const response = await jobReference.create([jobId, req.user.id, "script-nodejs"]);
		// Update Credit
		await userReference.record(req.user.id).call("subCredit", []);

		res.send(response.data);
		sendNotification(req.user.id, "Created node.js job")
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
		// Update Credit
		await userReference.record(req.user.id).call("subCredit", []);

		res.send(response.data);
		sendNotification(req.user.id, "Created Tensorflow job")
	} catch (error) {
		console.log(error.message);
	}
});

router.get("/bacalhau", auth, async (req, res) => {
	try {
		let response;
		if (req.query.query !== "undefined" && req.query.query !== "") {
			response = await jobReference
				.where("user", "==", req.user.id)
				.where("id", "==", req.query.query)
				.get();
		} else
			response = await jobReference
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
		const state = parsedOutput.State.State;

		let job = await jobReference.record(req.query.id).call("updateStatus", [state]);
		if (state === "Completed") {
			const cidObj = parsedOutput.State.Executions.filter(e => Object.keys(e.PublishedResults).length !== 0 && e.PublishedResults.hasOwnProperty("CID"))[0]
			const cid = cidObj.PublishedResults.CID;
			job = await jobReference.record(req.query.id).call("updateResult", [cid]);
			if (req.query.type === "train-tensorflow") {
				// Create new model
				await modelReference.create([req.query.id, req.user.id, cid, new Date(parsedOutput.State.UpdateTime).valueOf()]);
			}
		}
		res.send(job.data);
		sendNotification(req.user.id, `${state} ${req.query.type} job`, "")
	} catch (error) {
		console.log(error.message);
	}
});

router.post("/bacalhau/removebg", auth, async (req, res) => {
	try {
		let { fileUrl, filename } = req.body;
		if (!fileUrl || !filename)
			return res
				.status(500)
				.send({ message: "Please send CID & filename!" });

		// Create upload file job
		const command = `bacalhau docker run --wait=false --id-only -w /inputs -i ${fileUrl}/${filename} leostelon/removebg:0.4 -- python script.py ${filename}`;
		const { stdout, stderr } = await exec(command);
		if (stderr) return res.status(500).send({ message: stderr });
		const jobId = stdout.replace(/(\r\n|\n|\r)/gm, "");

		// Upload job id to polybase
		const response = await jobReference.create([jobId, req.user.id, "removebg"]);
		// Update Credit
		await userReference.record(req.user.id).call("subCredit", []);

		res.send(response.data);
		sendNotification(req.user.id, "Created Removebg job")
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

// bacalhau docker run -w /inputs -i https://bafybeidrumapv4xahqoic7iywjf6p63r6jk2ojqjo2ek275bjquablxnyu.ipfs.sphn.link/model-1686215740168.py python:alpine3.18 -- python model-1686215740168.py

// bacalhau docker run -w /inputs -i https://bafybeib3vbog2fhyyinn5yqu7w7hzo4ifkk222cc6nqosgaqpakqzgnxyq.ipfs.sphn.link/sample.png leostelon/removebg:0.4 -- python script.py sample.png