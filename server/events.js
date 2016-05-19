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
var crypto = require('crypto');
var schemas = require('./schemas.js');
var db = require('./db.js');
var log = require('./log.js');

var validate = {};
validate.auth = ajv.compile(schemas.auth);
validate.post = ajv.compile(schemas.post);
validate.fetch = ajv.compile(schemas.fetch);

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const INTERNAL_SERVER_ERROR = 500;

function SocketEvents(socket, io)
{
    function fail(errCode)
    {
        log.outbound(socket.id, 'err', {'code': errCode});
        io.to(socket.id).emit('err', {'code': errCode});
        socket.disconnect();
    }

    function isAuthenticated()
    {
        if(!socket.clientId || !socket.groupKey) return false;
        return true;
    }

    this.onAuth = function(data)
    {
        log.inbound(socket.id, 'auth', data);

        if(!validate.auth(data))
            return fail(BAD_REQUEST);

        db.auth(data['groupKey'], function(err, result)
        {
            if(err) return fail(INTERNAL_SERVER_ERROR);
            if(!result) return fail(UNAUTHORIZED);

            socket.groupKey = data['groupKey'];
            socket.clientId = data['clientId'];
            socket.join(socket.groupKey);

            log.outbound(socket.id, 'authOK');
            io.to(socket.id).emit('authOK');
        });
    };

    this.onPost = function(data)
    {
        log.inbound(socket.id, 'post', data);

        if(!validate.post(data))
            return fail(BAD_REQUEST);

        if(!isAuthenticated())
            return fail(UNAUTHORIZED);

        var timestamp = getCurrentTime();
        data.timestamp = timestamp;
        db.put(timestamp, socket.groupKey, data);

        log.outbound(socket.groupKey, 'execute', data);
        io.to(socket.groupKey).emit('execute', data);
    };

    this.onFetch = function(data)
    {
        log.inbound(socket.id, 'fetch', data);

        if(!validate.fetch(data))
            return fail(BAD_REQUEST);

        if(!isAuthenticated())
            return fail(UNAUTHORIZED);

        var key = socket.groupKey;
        var since = data['since'];

        db.get(key, since, function(err, result)
        {
            if(err) return fail(INTERNAL_SERVER_ERROR);

            for(var i = 0; i < result.contents.length; i++)
            {
                result.contents[i].timestamp = result.timestamps[i];
                log.outbound(socket.id, 'execute', result.contents[i]);
                io.to(socket.id).emit('execute', result.contents[i]);
            }

            log.outbound(socket.id, 'fetchOK', {'timestamp': getCurrentTime()});
            io.to(socket.id).emit('fetchOK', {'timestamp': getCurrentTime()});
        });
    };

    this.onRegister = function(data)
    {
        log.inbound(socket.id, 'register', data);
        crypto.randomBytes(24, function(ex, buf)
        {
            var token = buf.toString('base64');
            db.register(token, function(err, result)
            {
                if(err) return fail(INTERNAL_SERVER_ERROR);
                log.outbound(socket.id, 'registerOK', {'groupKey': token});
                io.to(socket.id).emit('registerOK', {'groupKey': token});
            });
        });
    };

    this.onDisconnect = function()
    {
        log.event(socket.id, 'disconnected');
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

        log.event(socket.id, 'connected');

        var socketEvents = new SocketEvents(socket, io);

        socket.on('auth', socketEvents.onAuth);
        socket.on('post', socketEvents.onPost);
        socket.on('fetch', socketEvents.onFetch);
        socket.on('register', socketEvents.onRegister);
        socket.on('disconnect', socketEvents.onDisconnect);
    }
}

module.exports = function(io)
{
    return new Events(io);
};

