
const jwt = require("jsonwebtoken");
const { db } = require("../polybase");

const collectionReference = db.collection("User");

async function auth(req, res, next) {
    try {
        const token = req.header("Authorization").replace("Bearer ", "");
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await collectionReference.where("id", "==", decoded.wallet_address).get();

        if (!user) {
            throw new Error();
        }
        req.user = user.data[0].data;
        next();
    } catch (e) {
        res
            .status(404)
            .send({ message: "Please authenticate", systemError: e.message });
    }
}

module.exports = { auth };
