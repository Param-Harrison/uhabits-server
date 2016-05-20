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
var config = require('./config.js');

var validate = {};
validate.auth = ajv.compile(schemas.auth);
validate.fetch = ajv.compile(schemas.fetch);
validate.postEvent = ajv.compile(schemas.postEvent);
validate.postSnapshot = ajv.compile(schemas.postSnapshot);

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const TOO_MANY_REQUESTS = 429;
const INTERNAL_SERVER_ERROR = 500;

var socketCount = {};

function SocketEvents(socket, io)
{
    this.onAuth = function(data)
    {
        log.inbound(socket.id, 'auth', data);
        if(!decreaseQuota()) return;
        if(!validate.auth(data)) return fail(BAD_REQUEST);

        db.auth(data['groupKey'], function(err, result)
        {
            if(err) return fail(INTERNAL_SERVER_ERROR);
            if(!result) return fail(UNAUTHORIZED);

            socket.groupKey = data['groupKey'];
            socket.clientId = data['clientId'];
            socket.isAuthenticated = true;

            if(!incrementSocketCount()) return;
            socket.join(socket.groupKey);
            log.outbound(socket.id, 'authOK');
            io.to(socket.id).emit('authOK');
        });
    };

    this.onPostEvent = function(data)
    {
        log.inbound(socket.id, 'postEvent', data);
        if(!decreaseQuota()) return;
        if(!validate.postEvent(data)) return fail(BAD_REQUEST);
        if(!socket.isAuthenticated) return fail(UNAUTHORIZED);

        var timestamp = getCurrentTimestamp();
        data.timestamp = timestamp;
        db.events.put(timestamp, socket.groupKey, data);

        log.outbound(socket.groupKey, 'execute', data);
        io.to(socket.groupKey).emit('execute', data);
    };

    function getCurrentTimestamp()
    {
        return Math.round(new Date().getTime() / 1000);
    }

    this.onFetch = function(data)
    {
        log.inbound(socket.id, 'fetch', data);
        if(!decreaseQuota()) return;
        if(!validate.fetch(data)) return fail(BAD_REQUEST);
        if(!socket.isAuthenticated) return fail(UNAUTHORIZED);

        var key = socket.groupKey;
        var since = data['since'];

        db.snapshots.get(key, since, function(err, result)
        {
            if(err) return fail(INTERNAL_SERVER_ERROR);

            if(result)
            {
                result.content.timestamp = result.timestamp;
                log.outbound(socket.id, 'replace', result.content);
                io.to(socket.id).emit('replace', result.content);
            }

            db.events.get(key, since, function(err, result)
            {
                if(err) return fail(INTERNAL_SERVER_ERROR);
                for(var i = 0; i < result.contents.length; i++)
                {
                    result.contents[i].timestamp = result.timestamps[i];
                    log.outbound(socket.id, 'execute', result.contents[i]);
                    io.to(socket.id).emit('execute', result.contents[i]);
                }

                var timestamp = getCurrentTimestamp();
                log.outbound(socket.id, 'fetchOK', {'timestamp': timestamp});
                io.to(socket.id).emit('fetchOK', {'timestamp': timestamp});
            });
        });
    };

    this.onPostSnapshot = function(data)
    {
        log.inbound(socket.id, 'postSnapshot', data);
        if(!decreaseQuota()) return;
        if(!validate.postSnapshot(data)) return fail(BAD_REQUEST);
        if(!socket.isAuthenticated) return fail(UNAUTHORIZED);

        var timestamp = getCurrentTimestamp();
        data.timestamp = timestamp;
        db.snapshots.put(timestamp, socket.groupKey, data);

        log.outbound(socket.groupKey, 'replace', data);
        io.to(socket.groupKey).emit('replace', data);
    };

    this.onGetSnapshot = function(data)
    {
        log.inbound(socket.id, 'getSnapshot', data);
        if(!decreaseQuota()) return;
        if(!validate.getGetSnapshot(data)) return fail(BAD_REQUEST);
        if(!socket.isAuthenticated) return fail(UNAUTHORIZED);

        var key = socket.groupKey;

        db.snapshots.get(key, function(err, result)
        {
            if(err) return fail(INTERNAL_SERVER_ERROR);
            
            result.content.timestamp = result.timestamp;
            log.outbound(socket.id, 'replace', result.content);
            io.to(socket.id).emit('replace', result.content);
        });
    };

    this.onRegister = function(data)
    {
        log.inbound(socket.id, 'register', data);
        if(!decreaseQuota()) return;

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
        if(socket.isConnected) decrementSocketCount();
        socket.isConnected = false;
        log.event(socket.id, 'disconnected');
    };

    function decreaseQuota()
    {
        if(--socket.remainingQuota < 0)
        {
            fail(TOO_MANY_REQUESTS);
            return false;
        }

        return true;
    }

    this.resetQuota = function resetQuota()
    {
        if(!socket.isConnected) return;
        socket.remainingQuota = config['rateLimitQuota'];
        setTimeout(resetQuota, config['rateLimitWindow']);
    };

    function incrementSocketCount()
    {
        if(!socketCount[socket.groupKey]) socketCount[socket.groupKey] = 0;
        socketCount[socket.groupKey]++;

        if(socketCount[socket.groupKey] > config['maxConnectionsPerKey'])
        {
            fail(429);
            return false;
        }

        return true;
    }

    function decrementSocketCount()
    {
        socketCount[socket.groupKey]--;
        if (socketCount[socket.groupKey] == 0)
            delete socketCount[socket.groupKey];
    }

    function fail(errCode)
    {
        log.outbound(socket.id, 'err', {'code': errCode});
        io.to(socket.id).emit('err', {'code': errCode});
        socket.disconnect();
    }
}

function Events(io)
{
    this.onConnect = function(socket)
    {
        socket.groupKey = false;
        socket.clientId = false;
        socket.isConnected = true;
        socket.isAuthenticated = false;
        socket.nRequests = 0;

        setTimeout(function()
        {
            if(socket.isConnected && !socket.isAuthenticated)
            {
                log.event(socket.id, "auth timeout");
                socket.disconnect();
            }
        }, config['authTimeout']);

        log.event(socket.id, 'connected from ' + socket.handshake.address);

        var socketEvents = new SocketEvents(socket, io);

        socketEvents.resetQuota();
        socket.on('auth', socketEvents.onAuth);
        socket.on('postEvent', socketEvents.onPostEvent);
        socket.on('postSnapshot', socketEvents.onPostSnapshot);
        socket.on('fetch', socketEvents.onFetch);
        socket.on('register', socketEvents.onRegister);
        socket.on('disconnect', socketEvents.onDisconnect);
    }
}

module.exports = (io => new Events(io));