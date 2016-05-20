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
var db = require('../server/db.js');
var actions = require('./actions.js');
var should = require('chai').should();

beforeEach(function() {
    db.purge();
});

describe('Authentication', function()
{
    it('should allow registration and auth', function(done)
    {
        var socket = actions.connectAndRegister();
        socket.on('authOK', function(data)
        {
            socket.disconnect();
            done();
        });
    });

    it('should reject with bogus auth', function(done)
    {
        var socket = actions.connect();
        socket.on('connect', function(data)
        {
            socket.emit('auth', '<h1>HELLO WORLD</h1>');
        });

        socket.on('err', function(data)
        {
            data['code'].should.equal(400);
            socket.disconnect();
            done();
        });
    });

    it('should reject with invalid key', function(done)
    {
        var socket = actions.connectAndAuth('123456789bogus');
        socket.on('err', function(data)
        {
            data['code'].should.equal(401);
            socket.disconnect();
            done();
        });
    });

    it('should disconnect idle non-authenticated clients', function(done)
    {
       var socket = actions.connect();
        socket.on('disconnect', function()
        {
            done();
        });
    });

    it('should disconnect fast clients', function(done)
    {
        var keepGoing = true;
        var socket = actions.connectAndRegister();

        function flood()
        {
            socket.emit('fetch', { 'since': 0 });
            if(keepGoing) setTimeout(flood, 5);
        }

        socket.on('authOK', function ()
        {
            flood();
        });

        socket.on('err', function(data)
        {
            data['code'].should.equal(429);
            keepGoing = false;
            socket.disconnect();
            done();
        });
    });

    it('should refuse too many clients per key', function(done)
    {
        var keepGoing = true;
        var socket1 = actions.connectAndRegister();
        var sockets = [socket1];

        socket1.on('authOK', function()
        {
            flood();
        });

        function flood()
        {
            if(!keepGoing) return;
            var socketx = actions.connectAndAuth(socket1.groupKey);
            sockets.push(socketx);

            socketx.on('err', function(data)
            {
                for(var i = 0; i < sockets.length; i++)
                    sockets[i].disconnect();

                data['code'].should.equal(429);
                keepGoing = false;
                done();
            });

            setTimeout(flood, 10);
        }
    });
});