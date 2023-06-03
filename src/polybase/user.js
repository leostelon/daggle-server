const { db } = require(".");
const jwt = require("jsonwebtoken");

const collectionReference = db.collection("User");

const createToken = async function (address) {
    try {
        const payload = {
            wallet_address: address,
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: "60 days",
        });

        await collectionReference
            .record(address)
            .call("updateToken", [token]);

        return token;
    } catch (error) {
        console.log(error.message)
    }
}

const createUser = async function (address) {
    try {
        let user;
        try {
            user = await collectionReference
                .record(address).get();
        } catch (err) { }

        if (!user) {
            await collectionReference.create([address]);
        }

        const token = await createToken(address)
        return token;
    } catch (error) {
        console.log(error.message)
    }
}

const getUser = async function (address) {
    try {
        let user;
        try {
            user = await collectionReference
                .record(address).get();
        } catch (err) { }
        return user;
    } catch (error) {
        console.log(error.message)
    }
}

module.exports = { createToken, createUser, getUser }