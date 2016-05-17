var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var pg = require('pg');

var httpPort = 4000;
var dbURL = "postgres://habits@localhost/habits";

io.set('heartbeat interval', 300000);
io.set('heartbeat timeout', 60000);

app.disable('x-powered-by');
app.get('/', function(req, res) {
    res.send("");
});

http.listen(httpPort, function() {
    console.log("Listening on *:%d", httpPort);
});

var nUsers = 0;
io.on('connection', onConnect);

function onConnect(socket)
{
    nUsers++;
    printUserCount();
    socket.groupKey = "";
    socket.clientId = "";

    socket.on('auth', data => onAuth(data));
    socket.on('post', data => onPost(data));
    socket.on('fetch', data => onFetch(data));
    socket.on('disconnect', () => onDisconnect());

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

        var timestamp = Math.round(new Date().getTime() / 1000);
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

            logOutbound(socket.clientId, "fetchOK", "");
            io.to(socket.id).emit('fetchOK');
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
