const http = require("http");
const https = require('https');
const express = require('express');
const WebSocket = require("websocket").server;
const fs = require("fs");
const path = require("path");

const app = express();

// HTTP server
const httpServer = http.createServer(app);

httpServer.listen(3007, () => {
  console.log('HTTP server 🚀 on port 3007');
});

// HTTPS server
const httpsServer = https.createServer(
  {
    key: fs.readFileSync(path.join(__dirname, 'cert', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem')),
  },
  app
);

httpsServer.listen(3008, () => {
  console.log('HTTPS server 🚀🔑 on port 3008');
});

// Express middleware for serving static files
app.use(express.static(path.join(__dirname, 'public')));

// Express route for handling other requests
app.use('/', (req, res, next) => {
  res.send('Hello from SSL server');
});

const webSocket = new WebSocket({ httpServer: httpServer });

let users = [];

webSocket.on("request", (req) => {
    const connection = req.accept();

    connection.on("message", (message) => {
        const data = JSON.parse(message.utf8Data);

        const user = findUser(data.username);

        switch (data.type) {
            case "store_user":
                if (user != null) {
                    return;
                }

                const newUser = {
                    conn: connection,
                    username: data.username
                };

                users.push(newUser);
                console.log(newUser.username);
                break;
            case "store_offer":
                if (user == null)
                    return;
                user.offer = data.offer;
                break;
            case "store_candidate":
                if (user == null) {
                    return;
                }
                if (user.candidates == null)
                    user.candidates = [];

                user.candidates.push(data.candidate);
                break;
            case "send_answer":
                if (user == null) {
                    return;
                }

                sendData({
                    type: "answer",
                    answer: data.answer
                }, user.conn);
                break;
            case "send_candidate":
                if (user == null) {
                    return;
                }

                sendData({
                    type: "candidate",
                    candidate: data.candidate
                }, user.conn);
                break;
            case "join_call":
                if (user == null) {
                    return;
                }

                sendData({
                    type: "offer",
                    offer: user.offer
                }, connection);

                user.candidates.forEach(candidate => {
                    sendData({
                        type: "candidate",
                        candidate: candidate
                    }, connection);
                });

                break;
        }
    });

    connection.on("close", (reason, description) => {
        users.forEach(user => {
            if (user.conn == connection) {
                users.splice(users.indexOf(user), 1);
                return;
            }
        });
    });
});

function sendData(data, conn) {
    conn.send(JSON.stringify(data));
}

function findUser(username) {
    for (let i = 0;i < users.length;i++) {
        if (users[i].username == username)
            return users[i];
    }
}
