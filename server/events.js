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
var log = require('./log.js');
var config = require('./config.js');

var validate = {};
validate.auth = ajv.compile(schemas.auth);
validate.register = ajv.compile(schemas.register);
validate.fetch = ajv.compile(schemas.fetch);
validate.postEvent = ajv.compile(schemas.postEvent);
validate.postSnapshot = ajv.compile(schemas.postSnapshot);

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const CONFLICT = 409;
const TOO_MANY_REQUESTS = 429;
const INTERNAL_SERVER_ERROR = 500;

const PG_UNIQUE_VIOLATION = '23505';

var socketCount = {};

function getCurrentTimestamp()
{
    return Math.round(new Date().getTime() / 1000);
}

function SocketEvents(socket, io)
{
    this.onAuth = function(data)
    {
        log.inbound(socket.id, 'auth', data);
        if(!decreaseQuota()) return decline(TOO_MANY_REQUESTS);
        if(!validate.auth(data)) return decline(BAD_REQUEST);

        db.auth(data.groupKey, function(err, result)
        {
            if(err) return crash(err);
            if(!result) return decline(UNAUTHORIZED);

            socket.groupKey = data.groupKey;
            socket.clientId = data.clientId;
            socket.isAuthenticated = true;

            if(!incrementSocketCount()) return decline(TOO_MANY_REQUESTS);

            socket.join(socket.groupKey);
            log.outbound(socket.id, 'authOK');
            io.to(socket.id).emit('authOK');
        });
    };

    this.onPostEvent = function(data)
    {
        log.inbound(socket.id, 'postEvent', data);
        if(!decreaseQuota()) return decline(TOO_MANY_REQUESTS);
        if(!validate.postEvent(data)) return decline(BAD_REQUEST);
        if(!socket.isAuthenticated) return decline(UNAUTHORIZED);

        var timestamp = getCurrentTimestamp();
        data.timestamp = timestamp;
        db.events.put(timestamp, socket.groupKey, data, function(err)
        {
            if(err) return crash(err);
            log.outbound(socket.groupKey, 'execute', data);
            io.to(socket.groupKey).emit('execute', data);
        });
    };

    this.onFetch = function(data)
    {
        log.inbound(socket.id, 'fetch', data);
        if(!decreaseQuota()) return decline(TOO_MANY_REQUESTS);
        if(!validate.fetch(data)) return decline(BAD_REQUEST);
        if(!socket.isAuthenticated) return decline(UNAUTHORIZED);

        var key = socket.groupKey;
        var since = data.since;

        db.snapshots.get(key, since, function(err, result)
        {
            if(err) return crash(err);

            if(result)
            {
                result.content.timestamp = result.timestamp;
                log.outbound(socket.id, 'replace', result.content);
                io.to(socket.id).emit('replace', result.content);
            }

            db.events.get(key, since, function(err, result)
            {
                if(err) return crash(err);

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
        if(!decreaseQuota()) return decline(TOO_MANY_REQUESTS);
        if(!validate.postSnapshot(data)) return decline(BAD_REQUEST);
        if(!socket.isAuthenticated) return decline(UNAUTHORIZED);

        var timestamp = getCurrentTimestamp();
        data.timestamp = timestamp;
        
        db.snapshots.put(timestamp, socket.groupKey, data, function(err)
        {
            if(err) return crash(err);
            log.outbound(socket.groupKey, 'replace', data);
            io.to(socket.groupKey).emit('replace', data); 
        });
    };

    this.onRegister = function(data)
    {
        log.inbound(socket.id, 'register', data);
        if(!validate.register(data)) return decline(BAD_REQUEST);
        if(!decreaseQuota()) return decline(TOO_MANY_REQUESTS);

        db.register(data.groupKey, function(err)
        {
            if(err)
            {
                if(err.code === PG_UNIQUE_VIOLATION) return decline(CONFLICT);
                return crash(err);
            }

            log.outbound(socket.id, 'registerOK');
            io.to(socket.id).emit('registerOK');
        });
    };

    this.onDisconnect = function()
    {
        decrementSocketCount();
        socket.isConnected = false;
        log.event(socket.id, 'disconnected');
    };

    function decreaseQuota()
    {
        return --socket.remainingQuota >= 0;
    }

    this.setResetQuota = function resetQuota()
    {
        if(!socket.isConnected) return;
        socket.remainingQuota = config['rateLimitQuota'];
        setTimeout(resetQuota, config['rateLimitWindow']);
    };

    this.setAuthTimeout = function()
    {
        setTimeout(function()
        {
            if (socket.isConnected && !socket.isAuthenticated)
            {
                log.event(socket.id, "auth timeout");
                socket.disconnect();
            }
        }, config['authTimeout']);
    };

    function incrementSocketCount()
    {
        if(!socketCount[socket.groupKey]) socketCount[socket.groupKey] = 0;
        socketCount[socket.groupKey]++;

        return socketCount[socket.groupKey] <= config['maxConnectionsPerGroupKey'];
    }

    function decrementSocketCount()
    {
        socketCount[socket.groupKey]--;
        if (socketCount[socket.groupKey] == 0)
            delete socketCount[socket.groupKey];
    }

    function decline(errCode)
    {
        log.outbound(socket.id, 'err', {'code': errCode});
        io.to(socket.id).emit('err', {'code': errCode});
        socket.disconnect();
        return false;
    }

    function crash(err)
    {
        console.log(err);
        console.log(new Error().stack);
        return decline(INTERNAL_SERVER_ERROR);
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

        log.event(socket.id, 'connected from ' + socket.handshake.address);

        var socketEvents = new SocketEvents(socket, io);

        socketEvents.setResetQuota();
        socketEvents.setAuthTimeout();

        socket.on('auth', socketEvents.onAuth);
        socket.on('postEvent', socketEvents.onPostEvent);
        socket.on('postSnapshot', socketEvents.onPostSnapshot);
        socket.on('fetch', socketEvents.onFetch);
        socket.on('register', socketEvents.onRegister);
        socket.on('disconnect', socketEvents.onDisconnect);
    }
}

module.exports = (io => new Events(io));