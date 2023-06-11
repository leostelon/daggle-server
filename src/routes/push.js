const router = require("express").Router();
const PushAPI = require("@pushprotocol/restapi");
const ethers = require("ethers");

const PK = process.env.PVT_KEY; // channel private key
const Pkey = `0x${PK}`;
const _signer = new ethers.Wallet(Pkey);

function getShortAddress(address) {
    return `${address.substring(0, 4)}...${address.slice(-4)}`;
}

const sendNotification = async (recipient, status) => {
    try {
        const apiResponse = await PushAPI.payloads.sendNotification({
            signer: _signer,
            type: 3, // broadcast
            identityType: 2, // direct payload
            notification: {
                title: `${status} - ${getShortAddress(recipient)}`,
                body: `Job ${status} at ${new Date()}`
            },
            payload: {
                title: `${status} - ${getShortAddress(recipient)}`,
                body: `Job ${status} at ${new Date()}`,
                cta: '',
                img: ''
            },
            channel: 'eip155:5:0xaCc94cA65405546b1C299bd8DBd4aA11D41446F5', // your channel address
            recipients: "eip155:5:" + recipient,
            env: 'staging',
        }).catch(err => {
            console.log(err)
        });
        return apiResponse;
    } catch (err) {
        console.error('Error: ', err);
    }
}

// Should work on this
router.post("/push/opt", async (req, res) => {
    try {
        const jsonProvider = new ethers.providers.JsonRpcProvider(process.env.QUICK_NODE);
        console.loog(process.env.QUICK_NODE)
        const signer = jsonProvider.getSigner(["0x3b18dCa02FA6945aCBbE2732D8942781B410E0F9"])

        await PushAPI.channels.subscribe({
            signer,
            channelAddress: 'eip155:5:0xaCc94cA65405546b1C299bd8DBd4aA11D41446F5', // channel address in CAIP
            userAddress: 'eip155:5:0x3b18dCa02FA6945aCBbE2732D8942781B410E0F9', // user address in CAIP
            onSuccess: () => {
                console.log('opt in success');
            },
            onError: () => {
                console.error('opt in error');
            },
            env: 'staging'
        })
        res.send({ message: "Successfully opted for notification." })
    } catch (error) {
        res.status(500).send({ message: error.message })
    }
})

// Should work on this
router.get("/push", async (req, res) => {
    try {
        const notifications = await PushAPI.user.getFeeds({
            user: 'eip155:5:0x3b18dCa02FA6945aCBbE2732D8942781B410E0F9', // user address in CAIP
            env: 'staging'
        });
        res.send(notifications)
    } catch (error) {
        res.status(500).send({ message: error.message })
    }
})

module.exports = { push: router, sendNotification }
