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

var event =
{
    'id': '123',
    'command': 'ToggleRepetition',
    'data': { 'timestamp': 1000000}
};

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

describe('Live broadcast', function()
{
    it('should reach other clients in the group', function(done)
    {
        var socket1 = actions.connectAndRegister();
        socket1.on('authOK', function(data)
        {
            connectAnother();
        });

        socket1.on('execute', function(data)
        {
            data.command.should.equal(event.command);
            data.data.timestamp.should.equal(event.data.timestamp);
            socket1.disconnect();
            done();
        });

        function connectAnother()
        {
            var socket2 = actions.connectAndAuth(socket1.groupKey);
            socket2.on('authOK', function(data)
            {
                socket2.emit('post', event);
                socket2.disconnect();
            });
        }
    });

    it('should not reach clients outside of the group', function(done)
    {
        var socket1 = actions.connectAndRegister();
        socket1.on('authOK', function(data)
        {
            createAnotherClient();
            setTimeout(function() {
                socket1.disconnect();
                done();
            }, 250); // wait to receive message
        });

        socket1.on('execute', function(data)
        {
            throw 'Should not receive execute event';
        });

        function createAnotherClient()
        {
            var socket2 = actions.connectAndRegister();
            socket2.on('authOK', function(data)
            {
                socket2.emit('post', event);
                socket2.disconnect();
            });
        }
    });
});

describe('Delayed broadcast', function()
{
    it('should reach other client as they become online', function(done)
    {
        var since = null;
        var socket1 = actions.connectAndRegister();
        socket1.on('authOK', function()
        {
            socket1.emit('post', event);
        });

        socket1.on('execute', function(data)
        {
            since = data['timestamp'];
            socket1.disconnect();
            createAnotherClient();
        });

        function createAnotherClient()
        {
            var socket2 = actions.connectAndAuth(socket1.groupKey);
            socket2.on('authOK', function ()
            {
                socket2.emit('fetch', {'since': since});
            });

            socket2.on('execute', function(data)
            {
                data.command.should.equal(event.command);
                socket2.disconnect();
                done();
            });
        }
    });
});
