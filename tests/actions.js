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

process.env.LOOP_ENV = 'test';
var config = require('../server/config.js');
var https = require('https');
var io = require('socket.io-client');
var serverURL = 'https://[::1]:' + config['serverPort'];
https.globalAgent.options.rejectUnauthorized = false;

var nextClientId = 0;

function connect()
{
    return io.connect(serverURL, {
        secure: true, transports: ['websocket'],
        agent: https.globalAgent
    });
}

function connectAndRegister()
{
    var socket = connect();
    socket.on('connect', function()
    {
        socket.emit('register');
    });

    socket.on('registerOK', function(data)
    {
        socket.groupKey = data['groupKey'];
        socket.emit('auth', {
            'groupKey': socket.groupKey,
            'clientId': (nextClientId++).toString()
        });
    });

    return socket;
}

function connectAndAuth(groupKey)
{
    var socket = connect();
    socket.on('connect', function(data)
    {
        socket.groupKey = groupKey;
        socket.emit('auth', {
            'groupKey': groupKey,
            'clientId': (nextClientId++).toString()
        })
    });

    return socket;
}

exports.connect = connect;
exports.connectAndAuth = connectAndAuth;
exports.connectAndRegister = connectAndRegister;
