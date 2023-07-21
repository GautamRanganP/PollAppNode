require("dotenv").config();
require("./config/database").connect();
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./model/user");
const Poll = require("./model/poll")
const auth = require("./middleware/auth");
const WebSocket = require('ws');
const cors = require('cors')
const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
const wss = new WebSocket.Server({ port: 8081 });


async function updateAllClient(){
    let pollresponse=[]
    try {
        pollresponse = await Poll.find({}).exec();
    } catch (error) {
        console.log('error', error);
    }
    const response = JSON.stringify(pollresponse)
    console.log("update client done")
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(response);
        }
    });
}

async function updateData(data) {
    if (data && data.id && data.countoptionone || data.countoptiontwo) {
        if (data.countoptionone) {
            let optiononevote = data.countoptionone;
            let votes = ++data.totalvote;
            let _id = data.id;
            try {
                await Poll.updateOne(
                    { _id },
                    {
                        $set: {
                            votes: votes,
                            optiononevote: optiononevote
                        }
                    }
                ).exec();
            } catch (error) {
                console.log('error', error);
            }
        }
        if (data.countoptiontwo) {
            let optiontwovote = data.countoptiontwo;
            let votes = ++data.totalvote;
            let _id = data.id;
            try {
                await Poll.updateOne(
                    { _id },
                    {
                        $set: {
                            votes: votes,
                            optiontwovote: optiontwovote
                        }
                    }
                ).exec();
            } catch (error) {
                console.log('error', error);
            }
        }
    }
    await updateAllClient();
}

wss.on('connection', function connection(ws) {
    console.log('New WebSocket connection established');
    ws.on('message', async function incoming(message) {
        let pollresponse = [];
        const data = JSON.parse(message);
        if (data.update === true) {
            await updateData(data);
        }
        else {
            try {
                pollresponse = await Poll.find({}).exec()
            } catch (error) {
                console.log('error', error);
            }
            const response = JSON.stringify(pollresponse)
            ws.send(response)
        }
    });
    ws.on('close', function close() {
        console.log('WebSocket connection closed');
    });
});


app.post("/register", async (req, res) => {
    try {
        // Get user input
        const { first_name, last_name, email, password } = req.body;

        // Validate user input
        if (!(email && password && first_name && last_name)) {
            res.status(400).send("All input is required");
        }

        // check if user already exist
        // Validate if user exist in our database
        const oldUser = await User.findOne({ email }).exec();

        if (oldUser) {
            return res.status(409).send("User Already Exist. Please Login");
        }

        //Encrypt user password
        const encryptedPassword = await bcrypt.hash(password, 10);

        // Create user in our database
        const user = await User.create({
            first_name,
            last_name,
            email: email.toLowerCase(), // sanitize: convert email to lowercase
            password: encryptedPassword,
        });

        // Create token
        const token = jwt.sign(
            { user_id: user._id, email },
            process.env.TOKEN_KEY,
            {
                expiresIn: "2h",
            }
        );
        // save user token
        user.token = token;

        // return new user
        res.status(201).json(user);
    } catch (err) {
        console.log(err);
    }
});

app.post("/login", async (req, res) => {
    try {
        // Get user input
        const { email, password } = req.body;

        // Validate user input
        if (!(email && password)) {
            res.status(400).send("All input is required");
        }
        // Validate if user exist in our database
        const user = await User.findOne({ email }).exec();

        if (user && (await bcrypt.compare(password, user.password))) {
            // Create token
            const token = jwt.sign(
                { user_id: user._id, email },
                process.env.TOKEN_KEY,
                {
                    expiresIn: "2h",
                }
            );

            // save user token
            user.token = token;
            // user
            res.status(200).json(user);
        }
        res.status(400).send("Invalid Credentials");
    } catch (err) {
        console.log(err);
    }
});

app.get("/welcome", auth, (req, res) => {
    res.status(200).send("Welcome 🙌 ");
});

app.get("/getuser/:id", auth, async (req, res) => {
    try {
        const userInfo = await User.findById(req.params.id).exec();
        res.status(200).send({
            "status": "success",
            "data": userInfo
        })
    } catch (error) {
        console.error(error);
        res.status(500).send("internal server error");
    }
})


app.post("/createpoll", auth, async (req, res) => {
    const { title, description, startdate, enddate, votes, optionone, optiontwo, optiononevote, optiontwovote } = req.body;
    try {
        const poll = new Poll({ title, description, startdate, enddate, votes, optionone, optiontwo, optiononevote, optiontwovote });
        await poll.save();
        await updateAllClient();
        res.status(200).send(poll)
    } catch (error) {
        console.error(error);
        res.status(500).send("internal server error");
    }

})

app.put('/updatepoll/:id', auth, async (req, res) => {
    const { title, description, startdate, enddate, optionone, optiontwo } = req.body;
    try {
        await Poll.findByIdAndUpdate(req.params.id, { title, description, startdate, enddate, optionone, optiontwo }).exec();
        console.log("update done")
        await updateAllClient();
        res.status(200).send({
            "status": "success",
            "message": "Poll was updated Succesfully"
        })
    } catch (error) {
        console.error(error);
        res.status(500).send("internal server error");
    }
});

app.delete("/deletepoll/:id", auth, async (req, res) => {
    try {
        await Poll.findByIdAndDelete(req.params.id).exec();
        await updateAllClient();
        res.status(200).send({
            "status": "success",
            "message": "Poll was Deleted Succesfully"
        })
    } catch (error) {
        console.error(error);
        res.status(500).send("internal server error");
    }
})

app.put('/reset/:id', auth, async (req, res) => {
    const votes = 0;
    const optiononevote = 0;
    const optiontwovote = 0;
    try {
         await Poll.updateOne(
            { _id: req.params.id },
            {
                $set: {
                    votes: votes,
                    optiononevote: optiononevote,
                    optiontwovote: optiontwovote,
                }
            }
        ).exec();
        await updateAllClient();
        res.status(200).send({
            "status": "success",
            "message": "Votes was reseted Succesfully"
        })
    } catch (error) {
        console.error(error);
        res.status(500).send("internal server error");
    }
});


//not used

app.get("/getallpoll", async (req, res) => {
    try {
        const poll = await Poll.find({}).exec();
        res.status(200).send(poll)
    } catch (error) {
        console.error(error);
        res.status(500).send("internal server error");
    }
})



app.put('/updatevote/:id', auth, async (req, res) => {
    const { votes } = req.body;
    try {
        await Poll.findByIdAndUpdate(req.params.id, { votes }).exec();
        res.status(200).send({
            "status": "success",
            "message": "Votes was updated Succesfully"
        })
    } catch (error) {
        console.error(error);
        res.status(500).send("internal server error");
    }
});

app.get('/getpoll/:id', async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id).exec();
        res.status(200).send(poll)
    } catch (error) {
        console.error(error);
        res.status(500).send("internal server error");
    }
});



// This should be the last route else any after it won't work
app.use("*", (req, res) => {
    res.status(404).json({
        success: "false",
        message: "Page not found",
        error: {
            statusCode: 404,
            message: "You reached a route that is not defined on this server",
        },
    });
});

module.exports = app;
