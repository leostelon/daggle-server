const router = require("express").Router();
const { db } = require("../polybase");
const { auth } = require("../middlewares/auth");
const getUser = require("../middlewares/getUser");

const datasetReference = db.collection("Dataset");
const modelReference = db.collection("Model");
const accessReference = db.collection("Access");
const accessTokenReference = db.collection("AccessToken");

router.get("/datasets", auth, async (req, res) => {
	try {
		const ds = await datasetReference.where("creator", "==", req.user.id).sort("timestamp", "desc").limit().get();
		res.send(ds.data);
	} catch (error) {
		res.status(500).send({ message: error.message });
	}
});

router.get("/models", auth, async (req, res) => {
	try {
		const ds = await modelReference.where("user", "==", req.user.id).sort("timestamp", "desc").limit().get();
		res.send(ds.data);
	} catch (error) {
		res.status(500).send({ message: error.message });
	}
});

router.get("/datasets/download", auth, async (req, res) => {
	try {
		const accessToken = await accessTokenReference
			.where("datasetId", "==", req.query.id)
			.get();
		if (accessToken.data.length === 0)
			return res.status(404).send({ message: "Invalid dataset id." });

		const access = await accessReference
			.where("user", "==", req.user.id)
			.where("accessTokenId", "==", accessToken.data[0].data.id)
			.get();

		if (access.data.length === 0)
			return res
				.status(401)
				.send({ message: "You don't have enough access token's." });

		const dataset = await datasetReference.record(req.query.id).get();
		res.send(dataset);
	} catch (error) {
		res.status(500).send({ message: error.message });
	}
});

// TODO: Add proper search method
router.get("/datasets/search", getUser, async (req, res) => {
	try {
		const ds = await datasetReference
			.where("name", "<=", req.query.name)
			.limit(20)
			.get();
		res.send({ repositories: ds.data });
	} catch (error) {
		res.status(500).send({ message: error.message });
	}
});

router.get("/datasets/versions", getUser, async (req, res) => {
	try {
		let rep = await datasetReference.where("name", "==", req.query.name).get();
		res.send({ repositories: rep.data });
	} catch (error) {
		res.status(500).send({ message: error.message });
	}
});

router.get("/datasets/user/:creator", getUser, async (req, res) => {
	try {
		let datasets = await datasetReference
			.where("creator", "==", req.params.creator)
			.sort("timestamp", "desc")
			.get();
		datasets.data = datasets.data.map((d) => {
			delete d.data.file;
			return d;
		});
		res.send({ repositories: datasets.data });
	} catch (error) {
		res.status(500).send({ message: error.message });
	}
});

module.exports = router;
