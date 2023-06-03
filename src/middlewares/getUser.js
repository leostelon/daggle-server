const jwt = require("jsonwebtoken");
const { db } = require("../polybase");

const collectionReference = db.collection("User");

async function getUser(req, _, next) {
	try {
		const token = req.header("Authorization").replace("Bearer ", "");
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		
		const user = await collectionReference.where("id", "==", decoded.wallet_address).get();

		req.user = user.data[0].data;
		next();
	} catch (e) {
		next();
	}
}

module.exports = getUser;
