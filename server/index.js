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
var log = require('./log.js');

var app = express();
app.disable('x-powered-by');

app.get('/', function(req, res)
{
    res.send('');
});

var server = https.createServer({
    key: fs.readFileSync(config['sslKeyFile']),
    cert: fs.readFileSync(config['sslCertFile']),
}, app);

server.listen(config['serverPort'], config['serverHostname'], function()
{
    console.log('Listening on [%s]:%d', config['serverHostname'],
            config['serverPort']);
});

var io = socketio(server);
io.set('heartbeat interval', config['heartbeatInterval']);
io.set('heartbeat timeout', config['heartbeatTimeout']);

var events = require('./events.js')(io);
io.on('connection', events.onConnect);
