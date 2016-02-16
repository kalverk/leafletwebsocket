var WebSocketServer = require("ws").Server;
var http = require("http");
var express = require("express");
var app = express();
var port = process.env.PORT || 5000;
var __dirname = 'public';
var clientId = 1, message, drawings = [], commonId = 0;

app.use(express.static(__dirname + "/"));

var server = http.createServer(app);
server.listen(port);

console.log("http server listening on %d", port);

var wss = new WebSocketServer({server: server});
console.log("websocket server created");

wss.on("connection", function(ws) {

    var color = '#'+Math.floor(Math.random()*16777215).toString(16);

    ws.on('message', function(message) {
        console.log('received: %s', message);

        message = JSON.parse(message);
        if (message.type === 'draw:created') {
            if (drawings.length > 100) {
                var removedDrawing = drawings.splice(0,1);
                commonId = removedDrawing[0].commonId;
            }
            message.data.commonId = commonId;
            drawings.push(message.data);
            commonId += 1;
        }else if (message.type === 'draw:deleted') {
            deleteDrawings(message);
        }

        wss.broadcast(JSON.stringify(message));
    });

    ws.on("close", function() {
        console.log("websocket connection close");
    });

    console.log("websocket connection open");
    ws.send(JSON.stringify({type: 'conf', data: {color: color, id: clientId}}), function() {  });
    ws.send(JSON.stringify({type: 'history', data: drawings}), function() {  });
    clientId += 1;
});

wss.broadcast = function broadcast(data) {
    wss.clients.forEach(function each(client) {
        client.send(data);
    });
};

function deleteDrawings (message) {
    for (var i = 0, len = drawings.length; i < len; i += 1) {
        if (drawings[i].commonId === message.data) {
            drawings.splice(i,1);
        }
    }
}
