const util = require("util");
const exec = util.promisify(require("child_process").exec);
const router = require("express").Router();
const { auth } = require("../middlewares/auth");
const { db } = require("../polybase");

const jobReference = db.collection("Job");
const datasetReference = db.collection("Dataset");
const accessTokenReference = db.collection("AccessToken");
const accessReference = db.collection("Access");

router.post("/bacalhau", auth, async (req, res) => {
	try {
		const { prompt, datasetId } = req.body;
		if (!datasetId || !prompt)
			return res
				.status(500)
				.send({ message: "Please send datasetId and prompt!" });

		const accessToken = await accessTokenReference
			.where("datasetId", "==", datasetId)
			.get();
		if (accessToken.data.length === 0)
			return res.status(404).send({ message: "Invalid dataset id." });

		// Authentication
		const access = await accessReference
			.where("user", "==", req.user.id)
			.where("accessTokenId", "==", accessToken.data[0].data.id)
			.get();

		if (access.data.length === 0)
			return res
				.status(401)
				.send({ message: "You don't have enough access token's." });

		// Get dataset
		const dataset = await datasetReference.record(datasetId).get();
		let link = dataset.data.file;
		link = link.replace(".ipfs.sphn.link", "").replace("https", "ipfs");

		// Create a job
		const command = `bacalhau docker run -i ${link} jsacex/dreambooth:full --id-only -- bash finetune.sh /inputs /outputs "${prompt}" 100`;
		const { stdout, stderr } = await exec(command);
		if (stderr) return console.log("Error", stderr);
		const jobId = stdout.replace(/(\r\n|\n|\r)/gm, "");
		console.log(jobId);

		// Upload job id to polybase
		const response = await jobReference.create([jobId, req.user.id, prompt]);

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

router.get("/bacalhau/job", async (req, res) => {
	try {
		// Get job
		const command = `bacalhau describe ${req.query.id} --json`;
		const { stdout, stderr } = await exec(command);
		if (stderr) return console.log("Error", stderr);
		const parsedOutput = JSON.parse(stdout);
		const cid = parsedOutput.State.Executions[2].PublishedResults.CID;
		const state = parsedOutput.State.Executions[2].State;

		await jobReference.record(req.query.id).call("updateStatus", [state]);
		res.send({ cid, state });
	} catch (error) {
		console.log(error.message);
	}
});

module.exports = router;

// bacalhau docker run -i ipfs://QmRKnvqvpFzLjEoeeNNGHtc7H8fCn9TvNWHFnbBHkK8Mhy jsacex/dreambooth:full --id-only -- bash finetune.sh /inputs /outputs "a photo of sbf man" 3000
// bacalhau docker run \ --gpu 1 \ -i ipfs://QmRKnvqvpFzLjEoeeNNGHtc7H8fCn9TvNWHFnbBHkK8Mhy \ jsacex/dreambooth:full \ -- bash finetune.sh /inputs /outputs "a photo of sbf man" "a photo of man" 3000 "/man"  "/model"
