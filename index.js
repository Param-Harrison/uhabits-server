var express = require('express');
var fs = require('fs');
var https = require('https');
var pg = require('pg');
var socketio = require('socket.io');

var app = express();
var serverPort = 4000;
var server = https.createServer({
    key: fs.readFileSync('./ssl.key'),
    cert: fs.readFileSync('./ssl.crt'),
}, app);

var dbURL = "postgres://habits@localhost/habits";

app.disable('x-powered-by');
app.get('/', function(req, res) {
    res.send("");
});

server.listen(serverPort, function() {
    console.log("Listening on *:%d", serverPort);
});

var nUsers = 0;

var io = socketio(server);
io.set('heartbeat interval', 300000);
io.set('heartbeat timeout', 60000);
io.on('connection', onConnect);

function onConnect(socket)
{
    nUsers++;
    printUserCount();
    socket.groupKey = "";
    socket.clientId = "";

    socket.on('auth', onAuth);
    socket.on('post', onPost);
    socket.on('fetch', onFetch);
    socket.on('disconnect', onDisconnect);

    function onDisconnect()
    {
        nUsers--;
        printUserCount();
    }

    function onAuth(data)
    {
        logInbound("----", "auth", data);

        params = JSON.parse(data);
        socket.groupKey = params['groupKey'];
        socket.clientId = params['clientId'];
        socket.join(socket.groupKey);

        logOutbound(socket.clientId, "authOK", "");
        io.to(socket.id).emit('authOK');
    }

    function onPost(data)
    {
        logInbound(socket.clientId, "post", data);

        var timestamp = getCurrentTime();
        appendCommand(timestamp, socket.groupKey, data);
        broadcastCommand(timestamp, socket.groupKey, data);
    }

    function onFetch(data)
    {
        logInbound(socket.clientId, "fetch", data);

        data = JSON.parse(data);
        fetch(socket.groupKey, data['since'], function(contents, timestamps)
        {
            for(var i=0; i < contents.length; i++)
            {
                broadcastCommand(timestamps[i], socket.id, contents[i]);
            };

            okData = JSON.stringify({"timestamp": getCurrentTime()});
            logOutbound(socket.clientId, "fetchOK", okData);
            io.to(socket.id).emit('fetchOK', okData);
        });
    }
}

function broadcastCommand(timestamp, group_key, content)
{
    content = JSON.parse(content);
    content.timestamp = timestamp;
    content = JSON.stringify(content);

    logOutbound(group_key, "execute", content);
    io.to(group_key).emit("execute", content);
}

function logInbound(key, action, data)
{
    console.log("%s <-- %s %s", key.substring(0, 4),
            action, data);
}

function logOutbound(key, action, data)
{
    console.log("%s --> %s %s", key.substring(0, 4),
            action, data);
}

function printUserCount()
{
    console.log('Users: %d', nUsers);
}

function appendCommand(timestamp, key, data)
{
    pg.connect(dbURL, function(err, client, done)
    {
        if(err)
        {
            console.log(err);
            done(client);
            return;
        }

        var query = 'insert into commands(timestamp, group_key, content) ' +
            'values (to_timestamp($1), $2, $3)';

        client.query(query, [timestamp, key, data], function(err, result)
        {
            if(err)
            {
                console.log(err);
                done(client);
                return;
            }

            done(client);
        });
    });
}

function fetch(key, since, callback)
{
    pg.connect(dbURL, function(err, client, done)
    {
        if(err)
        {
            console.log(err);
            done(client);
            return;
        }

        var query = 'select timestamp, content from commands ' +
            'where timestamp > to_timestamp($1) and group_key = $2';

        client.query(query, [since, key], function(err, result)
        {
            if(err)
            {
                console.log(err);
                done(client);
                return;
            }

            done(client);

            var timestamps = result.rows.map(function(row) {
                return row.timestamp.getTime() / 1000;
            });

            var contents = result.rows.map(function(row) {
                return JSON.stringify(row.content);
            });


            callback(contents, timestamps);
        });
    });
}

function getCurrentTime()
{
    return Math.round(new Date().getTime() / 1000);
}
