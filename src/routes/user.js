const router = require("express").Router();
const { recoverPersonalSignature } = require("@metamask/eth-sig-util");
const { createUser, getUser } = require("../polybase/user");
const { auth } = require("../middlewares/auth");
const { db } = require("../polybase");
const collectionReference = db.collection("User");

router.post("/user/login", async (req, res) => {
    try {
        const { sign } = req.body;

        const recoveredAddress = recoverPersonalSignature({
            data: "Please approve this message.",
            signature: sign,
        });

        let token = await createUser(recoveredAddress);
        res.send({ token })
    } catch (error) {
        res.status(500).send({ message: error.message })
    }
})

router.post("/user/username", auth, async (req, res) => {
    try {
        const { username } = req.body;
        const usernameRegex = /^[a-z0-9_\.]+$/;
        const valid = usernameRegex.test(username)
        if (!valid) return res.status(500).send({ message: "Invalid username." })

        const response = await collectionReference
            .record(req.user.id)
            .call("updateUsername", [username]);

        res.send(response)
    } catch (error) {
        res.status(500).send({ message: error.message })
    }
})

router.get("/user/enablepremium", auth, async (req, res) => {
    try {
        const response = await collectionReference
            .record(req.user.id)
            .call("updatePremium", []);

        res.send(response.data)
    } catch (error) {
        res.status(500).send({ message: error.message })
    }
})

router.get("/user/:address", async (req, res) => {
    try {
        const { address } = req.params;

        const response = await getUser(address)
        delete response.data.token;

        res.send(response.data)
    } catch (error) {
        res.status(500).send({ message: error.message })
    }
})

module.exports = router 