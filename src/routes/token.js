const { db } = require("../polybase");
const router = require("express").Router();
const { auth } = require("../middlewares/auth");
const accessReference = db.collection("Access");
const datasetReference = db.collection("Dataset");
const accessTokenReference = db.collection("AccessToken");

router.post("/token/create", auth, async (req, res) => {
	try {
		const {
			datasetId,
			datasetName,
			name,
			tokenAddress,
			minimumPurchase,
			pricePerToken,
			maxSupply,
		} = req.body;
		const accessToken = await accessTokenReference.create([
			datasetId,
			datasetName,
			req.user.id,
			name,
			tokenAddress,
			parseInt(minimumPurchase),
			parseFloat(pricePerToken),
			parseInt(maxSupply),
		]);

		await datasetReference.record(datasetId).call("enableTokenAccess", []);

		res.send(accessToken.data);
	} catch (error) {
		console.log(error);
		res.status(500).send({ message: error.message });
	}
});

router.post("/token/access/create", auth, async (req, res) => {
	try {
		const { accessTokenId, tokenAddress, supply } = req.body;
		const access = await accessReference.create([
			accessTokenId,
			req.user.id,
			tokenAddress,
			parseInt(supply),
		]);

		res.send(access.data);
	} catch (error) {
		console.log(error);
		res.status(500).send({ message: error.message });
	}
});

router.get("/token", async (req, res) => {
	try {
		const accessToken = await accessTokenReference
			.where("datasetName", "==", req.query.datasetName)
			.get();

		if (accessToken.data.length === 0) {
			return res
				.status(404)
				.send({ message: "Access token not found with given id." });
		}

		res.send(accessToken.data[0].data);
	} catch (error) {
		console.log(error);
		res.status(500).send({ message: error.message });
	}
});

module.exports = router;
