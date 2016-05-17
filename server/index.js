/* Sync server for Loop Habit Tracker
 * Copyright (C) 2016 Álinson Santos Xavier <isoron@gmail.com>
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var express = require('express');
var fs = require('fs');
var https = require('https');
var pg = require('pg');
var socketio = require('socket.io');

var config = require('./config.js');
var db = require('./db.js');
var log = require('./log.js');

var app = express();
app.disable('x-powered-by');

app.get('/', function(req, res)
{
    res.send("");
});

var server = https.createServer({
    key: fs.readFileSync(config["sslKeyFile"]),
    cert: fs.readFileSync(config["sslCertFile"]),
}, app);

server.listen(config["serverPort"], function()
{
    console.log("Listening on *:%d", config["serverPort"]);
});

var nUsers = 0;

var io = socketio(server);
io.set('heartbeat interval', config['heartbeatInterval']);
io.set('heartbeat timeout', config['heartbeatTimeout']);

io.on('connection', function(socket)
{
    nUsers++;
    printUserCount();
    socket.groupKey = "";
    socket.clientId = "";

    socket.on('disconnect', function()
    {
        nUsers--;
        printUserCount();
    });

    socket.on('auth', function(data)
    {
        log.inbound("----", "auth", data);

        params = JSON.parse(data);
        socket.groupKey = params['groupKey'];
        socket.clientId = params['clientId'];
        socket.join(socket.groupKey);

        log.outbound(socket.clientId, "authOK", "");
        io.to(socket.id).emit('authOK');
    });

    socket.on('post', function(data)
    {
        log.outbound(socket.clientId, "post", data);

        var timestamp = getCurrentTime();
        db.put(timestamp, socket.groupKey, data);
        broadcast(timestamp, socket.groupKey, data);
    });

    socket.on('fetch', function(data)
    {
        log.inbound(socket.clientId, "fetch", data);

        data = JSON.parse(data);
        var key = socket.groupKey;
        var since = data['since'];

        db.get(key, since, function(contents, timestamps)
        {
            for(var i=0; i < contents.length; i++)
            {
                broadcast(timestamps[i], socket.id, contents[i]);
            };

            okData = JSON.stringify({"timestamp": getCurrentTime()});
            log.outbound(socket.clientId, "fetchOK", okData);
            io.to(socket.id).emit('fetchOK', okData);
        });
    });

    function broadcast(timestamp, group_key, content)
    {
        content = JSON.parse(content);
        content.timestamp = timestamp;
        content = JSON.stringify(content);

        log.outbound(group_key, "execute", content);
        io.to(group_key).emit("execute", content);
    }

    function printUserCount()
    {
        console.log('Users: %d', nUsers);
    }

    function getCurrentTime()
    {
        return Math.round(new Date().getTime() / 1000);
    }
});
