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

var ajv = require('ajv')();
var schemas = require('./schemas.js');
var db = require('./db.js');

var validate = {};
validate.auth = ajv.compile(schemas.auth);
validate.post = ajv.compile(schemas.post);
validate.fetch = ajv.compile(schemas.fetch);

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;

function SocketEvents(socket, io)
{
    function fail(errCode)
    {
        io.to(socket.id).emit('err', {'code': errCode});
        socket.disconnect();
    }

    function isAuthenticated()
    {
        if(!socket.clientId) return false;
        if(!socket.groupKey) return false;
        return true;
    }

    this.onAuth = function(data)
    {
        if(!validate.auth(data))
            return fail(BAD_REQUEST);

        socket.groupKey = data['groupKey'];
        socket.clientId = data['clientId'];
        socket.join(socket.groupKey);
        io.to(socket.id).emit('authOK');
    }

    this.onPost = function(data)
    {
        if(!validate.post(data))
            return fail(BAD_REQUEST);

        if(!isAuthenticated())
            return fail(UNAUTHORIZED);

        var timestamp = getCurrentTime();
        data.timestamp = timestamp;
        db.put(timestamp, socket.groupKey, data);
        io.to(socket.groupKey).emit('execute', data);
    }

    this.onFetch = function(data)
    {
        if(!validate.fetch(data))
            return fail(BAD_REQUEST);

        if(!isAuthenticated())
            return fail(UNAUTHORIZED);

        var key = socket.groupKey;
        var since = data['since'];

        db.get(key, since, function(contents, timestamps)
        {
            for(var i=0; i < contents.length; i++)
            {
                contents[i].timestamp = timestamps[i];
                io.to(socket.id).emit(contents[i]);
            };

            okData = JSON.stringify({'timestamp': getCurrentTime()});
            io.to(socket.id).emit('fetchOK', okData);
        });
    }

    function getCurrentTime()
    {
        return Math.round(new Date().getTime() / 1000);
    }
}

function Events(io)
{
    this.onConnect = function(socket)
    {
        socket.groupKey = false;
        socket.clientId = false;

        var socketEvents = new SocketEvents(socket, io);

        socket.on('auth', socketEvents.onAuth);
        socket.on('post', socketEvents.onPost);
        socket.on('fetch', socketEvents.onFetch);
    }
}

module.exports = function(io)
{
    return new Events(io);
}

